import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://pcxcdhhxnqbxfrqxnikj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjeGNkaGh4bnFieGZycXhuaWtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMDA4NTYsImV4cCI6MjA4OTU3Njg1Nn0.4SprCFwXqXzTE9C-pedVdiIrr0IQHxfD9EXztUbtnO8'
)

// Normalise un nom d'entreprise pour comparaison (minuscules, sans accents, sans ponctuation)
function normalize(name) {
  return (name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const PAGE_SIZE = 1000
let all = []
let offset = 0
for (;;) {
  const { data, error } = await supabase
    .from('entreprises')
    .select('id, company_name, company_id_linkedin, company_website, company_employee_count, is_placeholder, parent_company_id, is_subsidiary, is_parent_entity, tier')
    .range(offset, offset + PAGE_SIZE - 1)
  if (error) { console.error(error); process.exit(1) }
  all = all.concat(data)
  if (data.length < PAGE_SIZE) break
  offset += PAGE_SIZE
}

// Compte les contacts par entreprise (pour juger quelle "page" est la vraie / la plus active)
let countMap = new Map()
const allIds = all.map(e => e.id)
for (let i = 0; i < allIds.length; i += 500) {
  const chunk = allIds.slice(i, i + 500)
  const { data: contactCounts, error: ccErr } = await supabase.rpc('contact_counts_for_entreprises', { ids: chunk })
  if (contactCounts && !ccErr) {
    for (const row of contactCounts) countMap.set(row.entreprise_id ?? row.id, row.cnt ?? row.count)
  }
}

const byNorm = new Map()
for (const e of all) {
  const key = normalize(e.company_name)
  if (!key) continue
  if (!byNorm.has(key)) byNorm.set(key, [])
  byNorm.get(key).push(e)
}

console.log('=== Groupes avec exactement le même nom normalisé mais company_id_linkedin différents ===\n')
let found = 0
for (const [key, group] of byNorm) {
  if (group.length < 2) continue
  const distinctLinkedinIds = new Set(group.map(g => g.company_id_linkedin).filter(Boolean))
  if (distinctLinkedinIds.size < 2 && group.filter(g => !g.company_id_linkedin).length === 0) continue
  found++
  console.log(`— "${group[0].company_name}" (${group.length} fiches)`)
  for (const g of group) {
    console.log(`    id=${g.id}  linkedin_id=${g.company_id_linkedin ?? '∅'}  website=${g.company_website ?? '∅'}  employees=${g.company_employee_count ?? '?'}  placeholder=${g.is_placeholder}  parent_company_id=${g.parent_company_id ?? '∅'}  is_subsidiary=${g.is_subsidiary}  is_parent_entity=${g.is_parent_entity}  contacts=${countMap.get(g.id) ?? '?'}`)
  }
  console.log()
}
console.log(`Total groupes suspects (nom identique, linkedin_id différent ou manquant) : ${found}`)

console.log('\n=== PROBABLES VRAIS DOUBLONS : parent/filiale avec nom normalisé STRICTEMENT IDENTIQUE ===\n')
const byId = new Map(all.map(e => [e.id, e]))
let exactSusp = 0
for (const child of all) {
  if (!child.parent_company_id) continue
  const parent = byId.get(child.parent_company_id)
  if (!parent) continue
  const nChild = normalize(child.company_name)
  const nParent = normalize(parent.company_name)
  if (nChild !== nParent) continue
  exactSusp++
  console.log(`— Parent "${parent.company_name}" (id=${parent.id}, linkedin_id=${parent.company_id_linkedin ?? '∅'}, contacts=${countMap.get(parent.id) ?? '?'}, employees=${parent.company_employee_count ?? '?'}, placeholder=${parent.is_placeholder})`)
  console.log(`    ↳ Filiale "${child.company_name}" (id=${child.id}, linkedin_id=${child.company_id_linkedin ?? '∅'}, contacts=${countMap.get(child.id) ?? '?'}, employees=${child.company_employee_count ?? '?'}, placeholder=${child.is_placeholder})`)
}
console.log(`\nTotal paires parent/filiale au nom STRICTEMENT identique (fort indice de doublon) : ${exactSusp}`)

console.log('\n=== Parent/filiale où le nom est quasi identique (préfixe) — à revoir manuellement, inclut de vraies filiales régionales ===\n')
let susp = 0
for (const child of all) {
  if (!child.parent_company_id) continue
  const parent = byId.get(child.parent_company_id)
  if (!parent) continue
  const nChild = normalize(child.company_name)
  const nParent = normalize(parent.company_name)
  const close = nChild !== nParent && (nChild.startsWith(nParent) || nParent.startsWith(nChild))
  if (!close) continue
  susp++
}
console.log(`Total paires parent/filiale au nom quasi identique (préfixe, hors match strict) : ${susp}`)
