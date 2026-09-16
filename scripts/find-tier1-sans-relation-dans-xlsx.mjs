/**
 * find-tier1-sans-relation-dans-xlsx.mjs
 *
 * Recherche parmi les contacts Tier 1 avec persona/hierarchie mais sans relation membre,
 * lesquels apparaissent dans les fichiers xlsx des membres Digilityx.
 * Génère un fichier SQL d'insertion à valider avant exécution.
 *
 * Usage:
 *   node scripts/find-tier1-sans-relation-dans-xlsx.mjs
 *   node scripts/find-tier1-sans-relation-dans-xlsx.mjs --insert   ← exécute en base
 */

import { readFileSync, writeFileSync } from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const args = process.argv.slice(2)
const doInsert = args.includes('--insert')

// Charger les credentials
const envContent = readFileSync('.env', 'utf8')
const env = Object.fromEntries(
  envContent.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)

const SUPABASE_URL = env.VITE_SUPABASE_URL
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Credentials manquants dans .env (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)')
  process.exit(1)
}

// Fichiers PhantomBuster → vmid (Prospect Linkedin ID URL)
const PB_FILES = {
  'Alexandre Auger.xlsx':    'Alexandre Auger',
  'Alexandre Koch.xlsx':     'Alexandre Koch',
  'Clément Schoofs.xlsx':    'Clément Schoofs',
  'Endza Djergaian.xlsx':    'Endza Djergaian',
}

// Fichiers Relations → linkedin url (URL publique)
const REL_FILES = {
  'Alexandre-Ambada-Relations-1e-niv-simple.xlsx': 'Alexandre Ambada',
  'Casilde-Bonnefoy-Relations-1e-niv.xlsx':        'Casilde Bonnefoy',
  'Cl-ment-Maria-Relations-1e-niv.xlsx':           'Clément Maria',
  'Elliot-Zimmermann-Relations-1e-niv-simple.xlsx':'Elliot Zimmermann',
  'Fiona-Roux-Relations-1e-niv-simple.xlsx':       'Fiona Roux',
  'In-s-Rafrafi-Relations-1e-niv.xlsx':            'Inès Rafrafi',
  'Jacky-Van-Relations-1e-niv.xlsx':               'Jacky Van',
  'Julie-Lecomte-Relations-1e-niv.xlsx':           'Julie Lecomte',
  'Marie-Jard-Relations-1e-niv-simple.xlsx':       'Marie Jard',
  'Raphaelle-Scher-Relations-1e-niv-simple.xlsx':  'Raphaëlle Scher',
  'Yanis-Sif-Relations-1e-niv.xlsx':               'Yanis Sif',
}

// Fichiers Pronto → Linkedin Id Url (vmid) + Linkedin Profile Url (url publique)
// Nom du membre déduit du nom de fichier
const PRONTO_FILES = {
  'Pronto_lead_export_dimitri_12062026.xlsx':       'Dimitri Thibaut',
  'Pronto_lead_export_francois-coulon_04062026.xlsx':'François Coulon',
  'Pronto_lead_export_julie-melet_12062026.xlsx':   'Julie Melet',
  'Pronto_lead_export_thibault-d_12062026.xlsx':    'Thibault Dequeker',
}

// Normalise une URL LinkedIn pour comparaison : lowercase + sans slash final
const normalizeUrl = u => u ? u.toLowerCase().replace(/\/+$/, '').trim() : null

async function fetchAll(url) {
  const PAGE = 1000
  let all = []
  let offset = 0
  while (true) {
    const sep = url.includes('?') ? '&' : '?'
    const resp = await fetch(`${url}${sep}order=id&offset=${offset}&limit=${PAGE}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    })
    if (!resp.ok) throw new Error(`${resp.status} ${await resp.text()}`)
    const rows = await resp.json()
    all = all.concat(rows)
    if (rows.length < PAGE) break
    offset += PAGE
  }
  return all
}

function loadXlsxMaps() {
  const vmidToMembres = new Map()
  for (const [file, membre] of Object.entries(PB_FILES)) {
    try {
      const wb = XLSX.readFile(file)
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null })
      for (const r of rows) {
        const vmid = normalizeUrl(r['Prospect Linkedin ID URL'])
        if (!vmid) continue
        const list = vmidToMembres.get(vmid) || []
        if (!list.includes(membre)) list.push(membre)
        vmidToMembres.set(vmid, list)
      }
    } catch { console.warn(`Fichier introuvable: ${file}`) }
  }

  const urlToMembres = new Map()
  for (const [file, membre] of Object.entries(REL_FILES)) {
    try {
      const wb = XLSX.readFile(file)
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null })
      for (const r of rows) {
        const url = normalizeUrl(r['linkedin url'])
        if (!url) continue
        const list = urlToMembres.get(url) || []
        if (!list.includes(membre)) list.push(membre)
        urlToMembres.set(url, list)
      }
    } catch { console.warn(`Fichier introuvable: ${file}`) }
  }

  // Fichiers Pronto : deux colonnes utilisables
  for (const [file, membre] of Object.entries(PRONTO_FILES)) {
    try {
      const wb = XLSX.readFile(file)
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null })
      for (const r of rows) {
        const vmid = normalizeUrl(r['Linkedin Id Url'])
        if (vmid) {
          const list = vmidToMembres.get(vmid) || []
          if (!list.includes(membre)) list.push(membre)
          vmidToMembres.set(vmid, list)
        }
        const url = normalizeUrl(r['Linkedin Profile Url'])
        if (url) {
          const list = urlToMembres.get(url) || []
          if (!list.includes(membre)) list.push(membre)
          urlToMembres.set(url, list)
        }
      }
    } catch { console.warn(`Fichier introuvable: ${file}`) }
  }

  return { vmidToMembres, urlToMembres }
}

async function main() {
  console.log('Chargement des fichiers xlsx...')
  const { vmidToMembres, urlToMembres } = loadXlsxMaps()
  console.log(`  ${vmidToMembres.size} vmids uniques (PhantomBuster)`)
  console.log(`  ${urlToMembres.size} linkedin urls uniques (Relations)`)

  console.log('\nRécupération des données Supabase...')

  process.stdout.write('  membres Digilityx... ')
  const membres = await fetchAll(`${SUPABASE_URL}/rest/v1/membres_digilityx?select=id,full_name`)
  console.log(membres.length)

  process.stdout.write('  entreprises Tier 1... ')
  const tier1Companies = await fetchAll(`${SUPABASE_URL}/rest/v1/entreprises?select=company_id_linkedin,company_name,tier,secteur_digi,id&tier=eq.Tier 1`)
  console.log(tier1Companies.length)

  process.stdout.write('  contacts avec persona+hierarchie... ')
  const allContacts = await fetchAll(`${SUPABASE_URL}/rest/v1/contacts?select=id,first_name,last_name,position,persona,hierarchie,id_url_linkedin,linkedin_url,company_name,company_id_linkedin&persona=not.is.null&hierarchie=not.is.null`)
  console.log(allContacts.length)

  process.stdout.write('  relations existantes (contact_id seulement)... ')
  const existingRelations = await fetchAll(`${SUPABASE_URL}/rest/v1/contacts_membres_relations?select=contact_id`)
  console.log(existingRelations.length)

  // Maps utiles
  const tier1CompanyIds = new Set(tier1Companies.map(e => e.company_id_linkedin))
  const tier1CompanyMap = Object.fromEntries(tier1Companies.map(e => [e.company_id_linkedin, e]))
  const membreByName = Object.fromEntries(membres.map(m => [m.full_name, m.id]))
  const existingRelSet = new Set(existingRelations.map(r => r.contact_id))

  // Vérifier la correspondance des noms de membres
  const allXlsxMembres = [
    ...Object.values(PB_FILES),
    ...Object.values(REL_FILES),
  ]
  console.log('\n=== Correspondance noms membres ===')
  for (const name of [...new Set(allXlsxMembres)]) {
    const id = membreByName[name]
    console.log(`  ${name.padEnd(25)} → ${id ? id : '❌ NON TROUVÉ EN BASE'}`)
  }

  // Filtrer contacts Tier 1 sans aucune relation membre
  const contactsSansRelation = allContacts.filter(c =>
    tier1CompanyIds.has(c.company_id_linkedin) &&
    !existingRelSet.has(c.id)
  )
  console.log(`\n${contactsSansRelation.length} contacts Tier 1 sans relation membre`)

  // Croiser avec les xlsx et construire les paires à insérer
  const toInsert = [] // { contact_id, membre_id, contact_name, membre_name, company_name, source }
  for (const c of contactsSansRelation) {
    const fromVmid = c.id_url_linkedin ? vmidToMembres.get(normalizeUrl(c.id_url_linkedin)) : null
    const fromUrl  = c.linkedin_url    ? urlToMembres.get(normalizeUrl(c.linkedin_url))     : null
    const allMembresForContact = [...new Set([...(fromVmid || []), ...(fromUrl || [])])]

    for (const membreName of allMembresForContact) {
      const membreId = membreByName[membreName]
      if (!membreId) continue
      // Pas besoin de vérif supplémentaire : on a déjà filtré les contacts sans aucune relation

      const entreprise = tier1CompanyMap[c.company_id_linkedin]
      toInsert.push({
        contact_id:   c.id,
        membre_id:    membreId,
        contact_name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
        membre_name:  membreName,
        company_name: c.company_name || entreprise?.company_name,
        position:     c.position,
        source:       fromVmid?.includes(membreName) ? 'PhantomBuster' : 'Relations',
      })
    }
  }

  console.log(`\n=== RÉSULTATS ===`)
  console.log(`${toInsert.length} relations à créer (pour ${[...new Set(toInsert.map(r => r.contact_id))].length} contacts uniques)\n`)

  // Résumé par membre
  const byMembre = {}
  for (const r of toInsert) {
    if (!byMembre[r.membre_name]) byMembre[r.membre_name] = []
    byMembre[r.membre_name].push(r)
  }
  console.log('Résumé par membre :')
  for (const [mb, rows] of Object.entries(byMembre).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${mb.padEnd(25)} : ${rows.length} relations`)
  }

  if (toInsert.length === 0) {
    console.log('\nRien à insérer.')
    return
  }

  // Générer le SQL
  const esc = s => s ? String(s).replace(/'/g, "''") : ''
  const sqlLines = toInsert.map(r =>
    `  ('${esc(r.contact_id)}', '${esc(r.membre_id)}') -- ${esc(r.contact_name)} ↔ ${esc(r.membre_name)} | ${esc(r.company_name)}`
  )
  const sql = `-- ============================================================
-- INSERT contacts_membres_relations
-- ${toInsert.length} relations pour ${[...new Set(toInsert.map(r => r.contact_id))].length} contacts uniques
-- Générées depuis les fichiers xlsx des membres Digilityx
-- Seulement les contacts Tier 1 avec persona+hierarchie sans relation existante
-- ============================================================

INSERT INTO contacts_membres_relations (contact_id, membre_id)
VALUES
${sqlLines.join(',\n')}
ON CONFLICT DO NOTHING;
`

  const sqlFile = 'scripts/generated-sql/insert_contacts_membres_relations_xlsx.sql'
  writeFileSync(sqlFile, sql)
  console.log(`\nSQL généré : ${sqlFile}`)
  console.log(`Taille : ${(sql.length / 1024).toFixed(1)} KB`)

  if (!doInsert) {
    console.log('\n⚠️  Mode lecture seule. Pour insérer en base :')
    console.log('   node scripts/find-tier1-sans-relation-dans-xlsx.mjs --insert')
    return
  }

  // Insertion en base par lots de 200
  console.log('\nInsertion en base...')
  const BATCH = 200
  let inserted = 0
  let errors = 0
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH).map(r => ({
      contact_id: r.contact_id,
      membre_id:  r.membre_id,
    }))
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/contacts_membres_relations`, {
      method: 'POST',
      headers: {
        apikey:         SUPABASE_KEY,
        Authorization:  `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer:         'resolution=ignore-duplicates,return=minimal',
      },
      body: JSON.stringify(batch),
    })
    if (resp.ok || resp.status === 201) {
      inserted += batch.length
      process.stdout.write(`\r  ${inserted}/${toInsert.length} insérées...`)
    } else {
      const text = await resp.text()
      console.error(`\n  Erreur batch ${i}: ${resp.status} ${text}`)
      errors++
    }
  }
  console.log(`\n\nTerminé ! ${inserted} relations insérées, ${errors} erreurs de batch.`)
}

main().catch(err => { console.error(err); process.exit(1) })
