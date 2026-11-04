import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'

const supabase = createClient(
  'https://pcxcdhhxnqbxfrqxnikj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjeGNkaGh4bnFieGZycXhuaWtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMDA4NTYsImV4cCI6MjA4OTU3Njg1Nn0.4SprCFwXqXzTE9C-pedVdiIrr0IQHxfD9EXztUbtnO8'
)

function normalize(name) {
  return (name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const PLACEHOLDER_GENERIC = new Set(['confidential', 'independant', 'indepenant', 'freelance', 'self employed'])

const PAGE_SIZE = 1000
let all = []
let offset = 0
for (;;) {
  const { data, error } = await supabase
    .from('entreprises')
    .select('id, company_name, company_id_linkedin, company_website, company_employee_count, is_placeholder, parent_company_id, is_subsidiary, is_parent_entity, tier, secteur_digi')
    .range(offset, offset + PAGE_SIZE - 1)
  if (error) { console.error(error); process.exit(1) }
  all = all.concat(data)
  if (data.length < PAGE_SIZE) break
  offset += PAGE_SIZE
}

let countMap = new Map()
const allIds = all.map(e => e.id)
for (let i = 0; i < allIds.length; i += 500) {
  const chunk = allIds.slice(i, i + 500)
  const { data: contactCounts } = await supabase.rpc('contact_counts_for_entreprises', { ids: chunk })
  if (contactCounts) for (const row of contactCounts) countMap.set(row.entreprise_id ?? row.id, row.cnt ?? row.count)
}

const byNorm = new Map()
for (const e of all) {
  const key = normalize(e.company_name)
  if (!key) continue
  if (!byNorm.has(key)) byNorm.set(key, [])
  byNorm.get(key).push(e)
}

const groups = []
for (const [key, group] of byNorm) {
  if (group.length < 2) continue
  if (PLACEHOLDER_GENERIC.has(key)) continue
  const distinctLinkedinIds = new Set(group.map(g => g.company_id_linkedin).filter(Boolean))
  if (distinctLinkedinIds.size < 2 && group.filter(g => !g.company_id_linkedin).length === 0) continue
  if (group.some(g => g.is_placeholder)) continue

  const fiches = group.map(g => ({
    id: g.id,
    linkedin_id: g.company_id_linkedin,
    website: g.company_website,
    employees: g.company_employee_count,
    contacts: countMap.get(g.id) ?? null,
    parent_company_id: g.parent_company_id,
    is_subsidiary: g.is_subsidiary,
    is_parent_entity: g.is_parent_entity,
    tier: g.tier,
    secteur: g.secteur_digi,
  }))

  // Heuristique de suspicion
  const linked = fiches.some(f => f.parent_company_id) || fiches.some(f => f.is_parent_entity)
  const employeeValues = fiches.map(f => f.employees).filter(v => v != null)
  let verdict
  if (linked) {
    verdict = 'déjà lié parent/filiale — à trancher (doublon probable ou vraie filiale)'
  } else if (employeeValues.length === 2 && Math.max(...employeeValues) / Math.min(...employeeValues) > 3) {
    verdict = 'effectifs très différents — probablement 2 sociétés distinctes'
  } else if (fiches.some(f => f.website) && fiches.filter(f => f.website).length >= 2 &&
    new Set(fiches.map(f => (f.website || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split('.').slice(-2).join('.'))).size > 1) {
    verdict = 'domaines web différents — probablement 2 sociétés distinctes'
  } else {
    verdict = 'à vérifier manuellement'
  }

  groups.push({ name: group[0].company_name, verdict, fiches })
}

groups.sort((a, b) => a.name.localeCompare(b.name))

writeFileSync(
  '/private/tmp/claude-501/-Users-cyriellefoures-Documents-DIGI-LEADS/8e5725f9-f62a-4d5f-8033-a0ef61715682/scratchpad/duplicate-candidates.json',
  JSON.stringify(groups, null, 2)
)
console.log(`Total groupes : ${groups.length}`)
const byVerdict = {}
for (const g of groups) byVerdict[g.verdict] = (byVerdict[g.verdict] ?? 0) + 1
console.log(byVerdict)
