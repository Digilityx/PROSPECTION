/**
 * merge-from-xlsx.mjs
 *
 * Fusionne les doublons validés manuellement dans le fichier xlsx.
 * Seules les lignes avec une colonne "check" renseignée sont traitées.
 *
 * Usage :
 *   node scripts/merge-from-xlsx.mjs --file=doublon-meme-id-linkedin.xlsx
 *   node scripts/merge-from-xlsx.mjs --file=doublon-meme-id-linkedin.xlsx --dry-run
 *
 * Logique "check" :
 *   "url 1"                          → keeper = id1, dup = id2
 *   "url 2"                          → keeper = id2, dup = id1
 *   "url 1 (mais entreprise Pluxee)" → keeper = id1, MAIS on prend l'entreprise de id2
 *   undefined / vide                 → ligne skippée (pas encore validée)
 *
 * Logique entreprise_id :
 *   - Override explicite dans le check ("mais entreprise ...") → prend celle du dup
 *   - Keeper sans entreprise, dup en a une → prend celle du dup
 *   - Les deux ont des entreprises différentes → garde celle du keeper, signale conflit
 *   - Sinon → pas de changement
 */

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import XLSX from 'xlsx'

const envContent = readFileSync('.env', 'utf8')
const env = Object.fromEntries(
  envContent.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_SERVICE_KEY || env.VITE_SUPABASE_ANON_KEY)

const cliArgs = process.argv.slice(2)
const dryRun = cliArgs.includes('--dry-run')
const fileArg = cliArgs.find(a => a.startsWith('--file='))?.split('=').slice(1).join('=')

if (!fileArg) {
  console.error('❌ Argument --file= manquant')
  process.exit(1)
}

// ── Lire le xlsx ─────────────────────────────────────────────────────
const wb = XLSX.readFile(fileArg)
const ws = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(ws)

console.log(`📂 ${fileArg} — ${rows.length} lignes`)

// ── Parser la colonne "check" ─────────────────────────────────────────
function parseCheck(checkVal) {
  const val = String(checkVal || '').trim().toLowerCase()
  if (!val) return null

  // Détecter un override entreprise : "url 1 (mais entreprise Pluxee)"
  const overrideMatch = val.match(/^url\s*(\d)\s*\(mais entreprise (.+)\)$/i)
  if (overrideMatch) {
    return {
      keeperNum: parseInt(overrideMatch[1]),   // 1 ou 2
      forceEntrepriseFromDup: true,
      overrideLabel: overrideMatch[2].trim(),   // ex: "Pluxee"
    }
  }

  // "url 1" ou "url 2"
  const simpleMatch = val.match(/^url\s*(\d)/)
  if (simpleMatch) {
    return { keeperNum: parseInt(simpleMatch[1]), forceEntrepriseFromDup: false }
  }

  return null // pas de check reconnu → skip
}

// ── Filtrer les lignes validées ───────────────────────────────────────
const toProcess = []
let skipped = 0

for (const row of rows) {
  const parsed = parseCheck(row.check)
  if (!parsed) { skipped++; continue }

  const keeperId = parsed.keeperNum === 1 ? row.id1 : row.id2
  const dupId    = parsed.keeperNum === 1 ? row.id2 : row.id1

  if (!keeperId || !dupId) { skipped++; continue }

  toProcess.push({ row, keeperId, dupId, parsed })
}

console.log(`\n✅ ${toProcess.length} lignes à traiter, ${skipped} skippées (check vide ou non reconnu)`)
if (dryRun) console.log('🔸 DRY RUN — aucune modification\n')

// ── RELATION_RANK ─────────────────────────────────────────────────────
const RELATION_RANK = {
  'Ami': 7, 'Cercle familial': 6, 'Ancien collègue': 5, 'Alumni': 5,
  'Partenaire business': 4, 'Connaissance': 3, 'Non renseigné': 1, 'Inconnu': 0,
}
const HIERARCHIE_RANK = {
  'COMEX': 4, 'Directeur': 3, 'Manager': 2, 'Opérationnel': 1, 'Stagiaire/Alternant': 0,
}
const STATUT_RANK = {
  'Client': 5, 'Intéressé': 4, 'Contacté': 3, 'À contacter': 2, 'Pas intéressé': 1,
}

// ── Fusionner chaque paire ────────────────────────────────────────────
let totalMerged = 0
let totalRelationsMoved = 0

for (const { row, keeperId, dupId, parsed } of toProcess) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`👤 ${row.nom?.toUpperCase()} — keeper=${keeperId.slice(0, 8)} dup=${dupId.slice(0, 8)}`)
  if (parsed.forceEntrepriseFromDup) {
    console.log(`   → override entreprise : prend celle du dup (${parsed.overrideLabel})`)
  }

  if (dryRun) continue

  // ── Charger les deux contacts ─────────────────────────────────────
  const [{ data: keeper }, { data: dup }] = await Promise.all([
    supabase.from('contacts').select('*').eq('id', keeperId).single(),
    supabase.from('contacts').select('*').eq('id', dupId).single(),
  ])

  if (!keeper || !dup) {
    console.log(`   ⚠️  Contact introuvable en base, skippé`)
    continue
  }

  // ── Transférer les relations ──────────────────────────────────────
  const [{ data: dupRels }, { data: keeperRels }] = await Promise.all([
    supabase.from('contacts_membres_relations').select('membre_id, niveau_de_relation').eq('contact_id', dupId),
    supabase.from('contacts_membres_relations').select('membre_id, niveau_de_relation').eq('contact_id', keeperId),
  ])

  const keeperRelMap = new Map((keeperRels || []).map(r => [r.membre_id, r]))
  let relMoved = 0

  for (const rel of (dupRels || [])) {
    const existing = keeperRelMap.get(rel.membre_id)
    if (!existing) {
      const { error } = await supabase.from('contacts_membres_relations')
        .insert({ contact_id: keeperId, membre_id: rel.membre_id, niveau_de_relation: rel.niveau_de_relation, entreprise_id: keeper.entreprise_id ?? null })
      if (!error) relMoved++
      else console.error(`   ❌ erreur transfert relation:`, error.message)
    } else {
      const dupRank  = RELATION_RANK[rel.niveau_de_relation] ?? -1
      const keepRank = RELATION_RANK[existing.niveau_de_relation] ?? -1
      if (dupRank > keepRank) {
        await supabase.from('contacts_membres_relations')
          .update({ niveau_de_relation: rel.niveau_de_relation })
          .eq('contact_id', keeperId).eq('membre_id', rel.membre_id)
        console.log(`   → relation ${rel.membre_id.slice(0, 8)}: "${existing.niveau_de_relation}" → "${rel.niveau_de_relation}"`)
      }
    }
  }

  if (relMoved > 0) console.log(`   → ${relMoved} relation(s) transférée(s)`)
  totalRelationsMoved += relMoved

  // ── Supprimer les relations du dup ────────────────────────────────
  await supabase.from('contacts_membres_relations').delete().eq('contact_id', dupId)

  // ── Transférer scraping_snapshots et notifications ────────────────
  await supabase.from('scraping_snapshots').update({ contact_id: keeperId }).eq('contact_id', dupId)
  await supabase.from('notifications').update({ contact_id: keeperId }).eq('contact_id', dupId)

  // ── Patch keeper ──────────────────────────────────────────────────
  const patch = {}
  const conflicts = []

  if (!keeper.email && dup.email)                     patch.email = dup.email
  if (!keeper.linkedin_url && dup.linkedin_url)       patch.linkedin_url = dup.linkedin_url
  if (!keeper.id_url_linkedin && dup.id_url_linkedin) patch.id_url_linkedin = dup.id_url_linkedin
  if (!keeper.owner_membre_id && dup.owner_membre_id) patch.owner_membre_id = dup.owner_membre_id
  if (!keeper.contact_digi && dup.contact_digi)       patch.contact_digi = true

  // Entreprise
  if (parsed.forceEntrepriseFromDup && dup.entreprise_id) {
    // Override explicite : prendre l'entreprise du dup (+ champs entreprise cohérents)
    patch.entreprise_id = dup.entreprise_id
    if (dup.company_name)         patch.company_name = dup.company_name
    if (dup.company_id_linkedin)  patch.company_id_linkedin = dup.company_id_linkedin
    console.log(`   → entreprise forcée depuis dup: ${dup.company_name || dup.entreprise_id.slice(0, 8)}`)
  } else if (!keeper.entreprise_id && dup.entreprise_id) {
    patch.entreprise_id = dup.entreprise_id
    if (dup.company_name && !keeper.company_name)        patch.company_name = dup.company_name
    if (dup.company_id_linkedin && !keeper.company_id_linkedin) patch.company_id_linkedin = dup.company_id_linkedin
    console.log(`   → entreprise prise depuis dup: ${dup.company_name || dup.entreprise_id.slice(0, 8)}`)
  } else if (keeper.entreprise_id && dup.entreprise_id && keeper.entreprise_id !== dup.entreprise_id) {
    conflicts.push(`entreprise: keeper="${keeper.company_name}" vs dup="${dup.company_name}" → keeper conservé, à vérifier`)
  }

  // Hiérarchie, statut, persona
  function normalizeName(s) {
    if (!s) return ''
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  }
  const samePosition = normalizeName(keeper.position || '') === normalizeName(dup.position || '')

  if (!samePosition && keeper.position && dup.position) {
    const keeperDate = new Date(keeper.created_at || 0)
    const dupDate    = new Date(dup.created_at || 0)
    const ref = dupDate > keeperDate ? dup : keeper
    conflicts.push(`postes différents : "${keeper.position}" vs "${dup.position}" → données du plus récent (${ref.created_at?.slice(0, 10)})`)
    if (ref === dup) {
      if (dup.hierarchie)     patch.hierarchie     = dup.hierarchie
      if (dup.statut_contact) patch.statut_contact = dup.statut_contact
      if (dup.persona)        patch.persona        = dup.persona
      if (dup.position)       patch.position       = dup.position
    }
  } else {
    if (dup.hierarchie) {
      if (!keeper.hierarchie) patch.hierarchie = dup.hierarchie
      else if (keeper.hierarchie !== dup.hierarchie) {
        const keepRank = HIERARCHIE_RANK[keeper.hierarchie] ?? -1
        const dupRank  = HIERARCHIE_RANK[dup.hierarchie]   ?? -1
        if (dupRank > keepRank) patch.hierarchie = dup.hierarchie
      }
    }
    if (dup.statut_contact) {
      if (!keeper.statut_contact) patch.statut_contact = dup.statut_contact
      else if (keeper.statut_contact !== dup.statut_contact) {
        const keepRank = STATUT_RANK[keeper.statut_contact] ?? -1
        const dupRank  = STATUT_RANK[dup.statut_contact]   ?? -1
        if (dupRank > keepRank) patch.statut_contact = dup.statut_contact
      }
    }
    if (dup.persona && !keeper.persona) patch.persona = dup.persona
    else if (dup.persona && keeper.persona && dup.persona !== keeper.persona) {
      conflicts.push(`persona: "${keeper.persona}" vs "${dup.persona}" → keeper conservé`)
    }
  }

  if (conflicts.length > 0) {
    console.log(`   ⚠️  À vérifier :`)
    conflicts.forEach(c => console.log(`      • ${c}`))
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from('contacts').update(patch).eq('id', keeperId)
    if (!error) console.log(`   → champs enrichis: ${Object.keys(patch).join(', ')}`)
    else console.error(`   ❌ erreur patch keeper:`, error.message)
  }

  // Recalculer nb_personnes_digi_relation → trigger scoring
  const { count: nbRel } = await supabase
    .from('contacts_membres_relations')
    .select('id', { count: 'exact', head: true })
    .eq('contact_id', keeperId)

  if (nbRel !== null) {
    await supabase.from('contacts').update({ nb_personnes_digi_relation: nbRel }).eq('id', keeperId)
  }

  // Masquer le dup
  const { error: maskErr } = await supabase.from('contacts').update({ masque: true }).eq('id', dupId)
  if (maskErr) console.error(`   ❌ erreur masquage:`, maskErr.message)
  else console.log(`   → doublon masqué`)

  totalMerged++
}

console.log(`\n${'═'.repeat(60)}`)
console.log(`📋 RÉSUMÉ${dryRun ? ' (DRY RUN)' : ''}`)
console.log(`  Paires fusionnées     : ${dryRun ? toProcess.length : totalMerged}`)
console.log(`  Relations transférées : ${totalRelationsMoved}`)
console.log(`  Lignes skippées       : ${skipped}`)
console.log(`${'═'.repeat(60)}`)
