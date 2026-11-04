/**
 * merge-entreprise-duplicates.mjs
 *
 * Fusionne des fiches entreprises qui sont en réalité la même société,
 * détectées comme "parent/filiale" par erreur (nom LinkedIn strictement
 * identique, mais deux company_id_linkedin différents car un contact ne
 * s'est pas associé à la bonne page LinkedIn — ex. EFICIA).
 *
 * Pour chaque paire { keeper, loser } :
 *   1. contacts.entreprise_id       loser -> keeper
 *      (contacts_membres_relations.entreprise_id + company_name suivent
 *       automatiquement via les triggers trg_sync_cmr_entreprise /
 *       trg_cmr_set_company_name_upd)
 *   2. entreprises.parent_company_id loser -> keeper
 *      (si d'autres entreprises étaient (à tort ou à raison) rattachées
 *       au loser comme filiales, elles sont réattachées au keeper)
 *   3. qualification_logs.entity_id (entity_type='entreprise') loser -> keeper
 *   4. DELETE FROM entreprises WHERE id = loser
 *
 * Usage :
 *   node scripts/merge-entreprise-duplicates.mjs --dry-run
 *   node scripts/merge-entreprise-duplicates.mjs
 */

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const envContent = readFileSync('.env', 'utf8')
const env = Object.fromEntries(
  envContent.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_SERVICE_KEY || env.VITE_SUPABASE_ANON_KEY)

const dryRun = process.argv.includes('--dry-run')

// keeper = fiche gardée (celle qui a le plus de contacts rattachés — on
// garde la fiche la "plus utilisée" plutôt que l'étiquette parent/filiale,
// qui ne reflète que l'ordre de détection du script précédent)
// loser  = fiche fusionnée puis supprimée
const PAIRS = [
  { name: 'EFICIA',          keeper: '622016de-c370-467c-8d96-6ed80fdeda67', loser: 'ec7a23e2-1304-44bd-a6aa-6936052f75b2' },
  { name: 'EQUANS',          keeper: 'e20e5408-01fb-4703-8da9-1227a194652b', loser: '42eff73f-12bf-48f5-8970-80b04d8ccecb' },
  { name: 'CNP Assurances',  keeper: '8d5d018f-7194-40c2-b035-9ee62d5a1eaf', loser: '09fbaf1c-8421-4b19-bec9-4d375e9f738b' },
  { name: 'Carrefour',       keeper: '0682e0f9-4e4c-41a2-84be-83d97ac2a88c', loser: 'c36fa2f3-dc8d-44f5-b99e-3cf3e8fb9864' },
  { name: 'Accenture',       keeper: 'ebd3a78e-3203-4048-aad2-d868076a28e0', loser: '57042a6c-33cb-4936-bd0c-f83f10dcdb6c' },
  { name: 'Air Liquide',     keeper: '3fc1f471-aea4-4a77-8d92-c69776a97791', loser: 'fe308886-7bfc-49f7-8db5-0427a78f072b' },
  { name: 'GL events',       keeper: 'd2da17b5-51bd-4beb-a126-29d8942c6a97', loser: '8948082e-8fd5-442f-b81d-4ab06e5bcc16' },
  { name: 'Immersive',       keeper: 'd6e38399-40fb-4cbb-87f5-8c3a8389bbe5', loser: '5af2d3f9-6c2a-492d-b1b0-48ac9cd43f89' },
]
// Banque Populaire volontairement exclue (la "filiale" pointe vers bpaura.fr —
// probablement une vraie filiale régionale, à vérifier manuellement).
// CEGEDIM et Ogilvy volontairement exclus (cas à trancher séparément, voir discussion).

// Champs à rapatrier du loser vers le keeper si le keeper ne les a pas déjà
// (évite de perdre des données d'enrichissement en supprimant le loser).
const FILLABLE_FIELDS = [
  'company_employee_count', 'company_employee_range', 'company_website',
  'company_website_from_linkedin', 'company_domain', 'company_location',
  'linkedin_industry', 'company_specialties', 'company_description',
  'source_acquisition', 'justification',
]

async function mergePair({ name, keeper, loser }) {
  if (keeper === loser) {
    console.log(`⚠️  ${name} : keeper == loser, skip`)
    return
  }

  const { data: keeperRow } = await supabase.from('entreprises').select('*').eq('id', keeper).single()
  const { data: loserRow } = await supabase.from('entreprises').select('*').eq('id', loser).single()
  if (!keeperRow || !loserRow) {
    console.log(`⚠️  ${name} : keeper ou loser introuvable, skip`)
    return
  }

  const fillPatch = {}
  for (const field of FILLABLE_FIELDS) {
    if ((keeperRow[field] === null || keeperRow[field] === undefined) && loserRow[field] !== null && loserRow[field] !== undefined) {
      fillPatch[field] = loserRow[field]
    }
  }

  const { count: nbContacts } = await supabase
    .from('contacts')
    .select('id', { count: 'exact', head: true })
    .eq('entreprise_id', loser)

  const { count: nbChildren } = await supabase
    .from('entreprises')
    .select('id', { count: 'exact', head: true })
    .eq('parent_company_id', loser)

  const { count: nbLogs } = await supabase
    .from('qualification_logs')
    .select('id', { count: 'exact', head: true })
    .eq('entity_type', 'entreprise')
    .eq('entity_id', loser)

  console.log(`\n— ${name}`)
  console.log(`    keeper=${keeper}  loser=${loser}`)
  console.log(`    à transférer : ${nbContacts ?? 0} contact(s), ${nbChildren ?? 0} sous-filiale(s), ${nbLogs ?? 0} log(s)`)
  if (Object.keys(fillPatch).length) {
    console.log(`    champs à rapatrier sur le keeper : ${Object.keys(fillPatch).join(', ')}`)
  }

  if (dryRun) return

  if (Object.keys(fillPatch).length) {
    const { error } = await supabase.from('entreprises').update(fillPatch).eq('id', keeper)
    if (error) throw new Error(`fill keeper fields: ${error.message}`)
  }
  if (nbContacts) {
    const { error } = await supabase.from('contacts').update({ entreprise_id: keeper }).eq('entreprise_id', loser)
    if (error) throw new Error(`contacts: ${error.message}`)
  }
  if (nbChildren) {
    const { error } = await supabase.from('entreprises').update({ parent_company_id: keeper }).eq('parent_company_id', loser)
    if (error) throw new Error(`entreprises(parent_company_id): ${error.message}`)
  }
  if (nbLogs) {
    const { error } = await supabase.from('qualification_logs').update({ entity_id: keeper }).eq('entity_type', 'entreprise').eq('entity_id', loser)
    if (error) throw new Error(`qualification_logs: ${error.message}`)
  }

  const { error: delErr } = await supabase.from('entreprises').delete().eq('id', loser)
  if (delErr) throw new Error(`delete entreprises: ${delErr.message}`)

  console.log(`    ✅ fusionné et supprimé`)
}

console.log(dryRun ? '🔎 DRY RUN — aucune écriture\n' : '🚀 FUSION EN COURS\n')
for (const pair of PAIRS) {
  await mergePair(pair)
}
console.log('\nTerminé.')
