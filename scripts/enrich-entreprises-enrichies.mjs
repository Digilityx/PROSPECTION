/**
 * enrich-entreprises-enrichies.mjs
 *
 * Lit ENTREPRISES_ENRICHIES.xlsx (racine du projet) et génère des fichiers SQL pour :
 *   1. linkedin_industry       ← linkedin_industry
 *   2. company_employee_count  ← company_employee_count
 *   3. company_employee_range  ← company_employee_range
 *   4. secteur_digi            ← mappé depuis li_industries (seulement si secteur_digi est NULL)
 *
 * Usage: node scripts/enrich-entreprises-enrichies.mjs
 */

import XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'

const INPUT_FILE = 'ENTREPRISES_ENRICHIES.xlsx'
const OUT_DIR = 'scripts/generated-sql'

// ── Mapping li_industries → secteur_digi ──────────────────────────────────
// Même logique que map-industry-to-secteur.mjs, appliquée au champ `name`
// ET au champ `hierarchy` de la valeur li_industries.
// Ordre = first match wins ; les secteurs spécifiques passent en premier.

// Ordre : secteurs à vocabulaire spécifique en premier,
// Technologie & IT AVANT Éducation pour éviter les faux positifs.
// /research/i retiré d'Éducation (attrape "Market Research").
const RULES = [
  // Pharma/Santé
  { secteur: 'Pharma/Santé', patterns: [
    /pharma/i, /biotech/i, /médic/i, /medic/i, /santé/i, /health/i,
    /hospit(?!ality)/i, /hospital/i, /clinic/i, /mental health/i,
    /dental/i, /veterinar/i, /nursing/i, /optical/i,
    /medical device/i, /medical equipment/i, /medical practice/i,
    /alternative medicine/i,
  ]},

  // BAF — avant Recrutement car /capital/ et /account/ sont ambigus
  { secteur: 'BAF', patterns: [
    /banking/i, /insurance/i, /financial service/i, /services financiers/i,
    /investment/i, /capital market/i, /venture capital/i, /private equity/i,
    /credit/i, /accounting/i, /audit/i,
    /fintech/i, /payment/i, /stock exchange/i, /trading/i,
  ]},

  // Recrutement
  { secteur: 'Recrutement', patterns: [
    /recruit/i, /staffing/i, /placement/i,
    /human resources/i, /talent acquisition/i, /hiring/i,
    /executive search/i, /outplacement/i, /interim/i,
    /temporary help/i,
  ]},

  // Luxe
  { secteur: 'Luxe', patterns: [
    /luxury/i, /jewel/i, /watch/i,
    /fashion/i, /couture/i, /leather goods/i, /maroquin/i,
    /cosmetic/i, /fragrance/i,
    /wine.*spirit/i, /spirits/i,
    /apparel.*fashion/i,
  ]},

  // Tourisme, Hôtellerie & Loisirs
  { secteur: 'Tourisme, Hôtellerie & Loisirs', patterns: [
    /touris/i, /hotel/i, /hospitality/i,
    /restaur/i, /leisure/i, /entertainment/i,
    /event management/i, /performing arts/i,
    /gaming/i, /casino/i, /spectator sport/i,
    /fitness/i, /wellness/i, /recreation/i, /amusement/i,
    /music/i, /animation/i,
    /food.*beverage/i, /food and beverage service/i,
    /travel/i, /museum/i, /sports$/i,
  ]},

  // Immobilier & Construction
  { secteur: 'Immobilier & Construction', patterns: [
    /real estate/i, /property/i,
    /construction/i, /building/i, /architect/i,
    /civil engineer/i,
  ]},

  // Transports & Logistique
  { secteur: 'Transports & Logistique', patterns: [
    /transport/i, /logistic/i, /supply chain/i,
    /shipping/i, /maritime/i, /aviation/i,
    /airline/i, /railroad/i, /freight/i,
    /warehousing/i, /delivery/i, /trucking/i,
    /automotive/i, /vehicle/i,
  ]},

  // Industrie & Énergie
  { secteur: 'Industrie & Énergie', patterns: [
    /environmental service/i, /renewable/i, /\benergy\b/i,
    /oil.*gas/i, /\bmining\b/i,
    /agricultur/i, /farming/i, /forestry/i,
    /defen[cs]e/i, /aerospace/i, /military/i,
    /manufacturing/i, /industri/i,
    /plastic/i, /textile/i, /chemical/i,
    /packaging/i, /utilities/i, /machinery/i,
    /shipbuilding/i, /glass.*ceramic/i,
  ]},

  // Commerce de Détail
  { secteur: 'Commerce de Détail', patterns: [
    /\bretail\b/i, /supermar/i, /hypermar/i, /grocery/i,
    /wholesale/i, /consumer goods/i,
    /e-commerce/i, /ecommerce/i,
    /import.*export/i,
  ]},

  // Technologie & IT — AVANT Éducation
  { secteur: 'Technologie & IT', patterns: [
    /software/i, /saas/i, /cloud/i, /cyber/i,
    /artificial intelligen/i, /machine learning/i,
    /semiconductor/i, /computer/i, /informatiq/i,
    /internet/i,
    /it service/i, /it consult/i, /information tech/i, /information service/i,
    /technolog/i, /telecom/i, /network/i,
    /electronic/i, /hardware/i,
    /robotic/i, /iot/i,
    /nanotechnolog/i,
    /internet publishing/i, /software development/i,
    /industrial automation/i,
    /sécurité informatique/i,
  ]},

  // Concurrent (agences design, marketing, pub, photo, print)
  { secteur: 'Concurrent', patterns: [
    /marketing/i, /advertis/i,
    /\bdesign\b/i, /graphic design/i,
    /public.*relation/i,
    /photograph/i,
    /\bprint\b/i,
    /writing.*editing/i,
  ]},

  // Media & Communication
  { secteur: 'Media & Communication', patterns: [
    /\bmedia\b/i, /audiovisuel/i,
    /news/i, /publishing/i, /broadcast/i,
    /television/i, /radio/i,
    /motion picture/i, /media production/i,
    /book.*periodical/i,
  ]},

  // Public & Administrations
  { secteur: 'Public & Administrations', patterns: [
    /government/i,
    /international affair/i, /military.*affair/i, /armed forces/i,
    /law enforcement/i, /public safety/i, /judiciary/i,
    /executive office/i, /legislative/i, /public policy/i,
  ]},

  // Éducation & Formation — après Technologie & IT
  // /research/i retiré : attrape "Market Research" → Prestations
  // /coaching/i resserré en /training.*coaching/i
  { secteur: 'Éducation & Formation', patterns: [
    /education/i, /enseignement/i, /universit/i,
    /e-learning/i, /elearning/i, /\btraining\b/i,
    /school/i, /académi/i, /academi/i,
    /professional training/i, /higher education/i, /enseignement supérieur/i,
    /primary.*education/i, /secondary.*education/i,
    /training.*coaching/i, /coaching.*training/i,
    /think tank/i, /librari/i, /vocational/i,
  ]},

  // Services aux Consommateurs
  { secteur: 'Services aux Consommateurs', patterns: [
    /consumer service/i,
    /individual.*family/i, /family service/i,
    /civic/i, /non-profit/i, /nonprofit/i,
    /community/i, /humanitarian/i,
    /personal service/i,
    /food production/i, /food and beverage manufacturing/i,
    /dairy/i, /furniture/i,
    /arts.*craft/i, /fine art/i, /museums/i,
  ]},

  // Prestations aux entreprises — catch-all en dernier
  { secteur: 'Prestations aux entreprises', patterns: [
    /consult/i, /strateg/i,
    /outsourc/i,
    /professional service/i, /business.*consult/i,
    /legal/i, /law practice/i, /alternative dispute/i,
    /translat/i,
    /market research/i,
    /facilities/i, /janitorial/i,
    /security.*invest/i, /security and invest/i,
    /administrative.*support/i,
    /architecture.*planning/i,
    /fundraising/i,
    /government.*relation/i,
  ]},
]

function parseLiIndustries(raw) {
  if (!raw || raw === 'null') return null
  const nameMatch = raw.match(/['"]name['"]\s*:\s*['"]([^'"]+)['"]/)
  const hierMatch = raw.match(/['"]hierarchy['"]\s*:\s*['"]([^'"]+)['"]/)
  return {
    name: nameMatch ? nameMatch[1] : '',
    hierarchy: hierMatch ? hierMatch[1] : '',
  }
}

function mapIndustry(raw) {
  const parsed = parseLiIndustries(raw)
  if (!parsed) return null
  const text = `${parsed.name} ${parsed.hierarchy}`
  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) return rule.secteur
    }
  }
  return null
}

function escSql(val) {
  if (val === null || val === undefined) return 'NULL'
  return `'${String(val).replace(/'/g, "''")}'`
}

// ── Read file ─────────────────────────────────────────────────────────────

const wb = XLSX.readFile(INPUT_FILE)
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null })
console.log(`Lues: ${rows.length} lignes depuis ${INPUT_FILE}`)

// ── Build updates ─────────────────────────────────────────────────────────

const updates = []
let mappedCount = 0
let unmappedCount = 0
const unmappedIndustries = {}

for (const r of rows) {
  if (!r.id) continue

  const update = { id: r.id }
  let hasChange = false

  // linkedin_industry
  if (r.linkedin_industry !== null && r.linkedin_industry !== undefined && r.linkedin_industry !== '') {
    update.linkedin_industry = String(r.linkedin_industry)
    hasChange = true
  }

  // Employee count
  if (r.company_employee_count !== null && r.company_employee_count !== undefined) {
    const count = parseInt(r.company_employee_count, 10)
    if (!isNaN(count)) {
      update.company_employee_count = count
      hasChange = true
    }
  }

  // Employee range
  if (r.company_employee_range !== null && r.company_employee_range !== undefined && r.company_employee_range !== '') {
    update.company_employee_range = String(r.company_employee_range)
    hasChange = true
  }

  // secteur_digi uniquement si NULL en base (secteur_digi === 'null' dans le fichier)
  const secteurIsNull = r.secteur_digi === null || r.secteur_digi === 'null' || r.secteur_digi === ''
  if (secteurIsNull && r.li_industries && r.li_industries !== 'null') {
    const secteur = mapIndustry(r.li_industries)
    if (secteur) {
      update.secteur_digi = secteur
      mappedCount++
      hasChange = true
    } else {
      const parsed = parseLiIndustries(r.li_industries)
      const key = parsed?.name || r.li_industries.substring(0, 60)
      unmappedIndustries[key] = (unmappedIndustries[key] || 0) + 1
      unmappedCount++
    }
  }

  if (hasChange) updates.push(update)
}

console.log(`\nÀ mettre à jour: ${updates.length} entreprises`)
console.log(`secteur_digi mappés: ${mappedCount}`)
console.log(`secteur_digi non mappés: ${unmappedCount}`)

if (unmappedCount > 0) {
  const sorted = Object.entries(unmappedIndustries).sort((a, b) => b[1] - a[1])
  console.log(`\nIndustries non mappées (${sorted.length} uniques):`)
  sorted.forEach(([k, v]) => console.log(`  ${v}x  ${k}`))
}

// Distribution secteur_digi
const dist = {}
updates.forEach(u => {
  if (u.secteur_digi) dist[u.secteur_digi] = (dist[u.secteur_digi] || 0) + 1
})
if (Object.keys(dist).length > 0) {
  console.log('\nDistribution secteur_digi (nouvellement mappés):')
  Object.entries(dist).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`))
}

// ── Generate SQL ──────────────────────────────────────────────────────────

// Clean old files
const oldFiles = fs.readdirSync(OUT_DIR).filter(f => f.startsWith('enrich_entreprises_'))
oldFiles.forEach(f => fs.unlinkSync(path.join(OUT_DIR, f)))

const BATCH = 500
let fileIdx = 0

for (let i = 0; i < updates.length; i += BATCH) {
  fileIdx++
  const batch = updates.slice(i, i + BATCH)

  const statements = batch.map(u => {
    const sets = []
    if ('linkedin_industry' in u) {
      sets.push(`linkedin_industry = ${escSql(u.linkedin_industry)}`)
    }
    if ('company_employee_count' in u) {
      sets.push(`company_employee_count = ${u.company_employee_count}`)
    }
    if ('company_employee_range' in u) {
      sets.push(`company_employee_range = ${escSql(u.company_employee_range)}`)
    }
    if ('secteur_digi' in u) {
      sets.push(`secteur_digi = ${escSql(u.secteur_digi)}`)
    }
    return `UPDATE entreprises SET ${sets.join(', ')} WHERE id = '${u.id}';`
  })

  const sql = statements.join('\n') + '\n'
  const filename = `enrich_entreprises_${String(fileIdx).padStart(2, '0')}.sql`
  fs.writeFileSync(path.join(OUT_DIR, filename), sql)
}

console.log(`\nGénéré ${fileIdx} fichiers SQL dans ${OUT_DIR}/`)
console.log('Exécute-les via: node scripts/run-sql-files.mjs enrich_entreprises')
