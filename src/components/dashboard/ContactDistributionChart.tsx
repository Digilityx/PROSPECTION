import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, ChevronDown, Check } from 'lucide-react'
import { useContactDistribution } from '@/lib/hooks/use-supabase'

const ALL_SECTEURS = [
  'Pharma/Santé', 'BAF',
  'Éducation & Formation', 'Tourisme, Hôtellerie & Loisirs', 'Technologie & IT',
  'Prestations aux entreprises', 'Media & Communication', 'Recrutement',
  'Commerce de Détail', 'Luxe', 'Services aux Consommateurs',
  'Industrie & Énergie', 'Transports & Logistique', 'Immobilier & Construction',
  'Public & Administrations', 'Concurrent',
]

const SECTEUR_TIER_GROUP: Record<string, string> = {
  'Pharma/Santé': 'Tier 1', 'BAF': 'Tier 1',
  'Concurrent': 'Hors-Tier', 'Public & Administrations': 'Hors-Tier',
}

function SecteurFilter({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const label = selected.length === 0
    ? 'Tous secteurs'
    : selected.length <= 2 ? selected.join(', ') : `${selected.length} secteurs`

  const toggle = (s: string) =>
    onChange(selected.includes(s) ? selected.filter(x => x !== s) : [...selected, s])

  const grouped = ALL_SECTEURS.reduce<Record<string, string[]>>((acc, s) => {
    const g = SECTEUR_TIER_GROUP[s] ?? 'Tier 2'
    if (!acc[g]) acc[g] = []
    acc[g].push(s)
    return acc
  }, {})

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 rounded-lg border border-input bg-background px-2.5 h-7 text-xs text-muted-foreground hover:text-foreground hover:border-[#050d2b]/30 transition-colors"
      >
        <span className="max-w-[140px] truncate">{label}</span>
        <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 w-60 rounded-xl border border-border bg-card shadow-lg py-1 max-h-72 overflow-y-auto">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border mb-1">
            <button type="button" onClick={() => onChange([])} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Tous</button>
            <button type="button" onClick={() => onChange([...ALL_SECTEURS])} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Tout sélectionner</button>
          </div>
          {(['Tier 1', 'Tier 2', 'Hors-Tier'] as const).map(g => {
            const items = grouped[g]
            if (!items?.length) return null
            return (
              <div key={g}>
                <p className="px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">{g}</p>
                {items.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggle(s)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted/60 transition-colors text-left"
                  >
                    <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${selected.includes(s) ? 'bg-[#050d2b] border-[#050d2b]' : 'border-input'}`}>
                      {selected.includes(s) && <Check className="h-2 w-2 text-white" />}
                    </span>
                    {s}
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const PERSONA_ORDER: Record<string, number> = {
  'Dirigeant':           0,
  'Marketing':           1,
  'Commercial':          2,
  'Produit':             3,
  'Design':              4,
  'Acheteur':            5,
  'Hors expertise Digi': 99,
}

const PERSONA_COLOR: Record<string, string> = {
  'Dirigeant':           '#050d2b',
  'Marketing':           '#3b82f6',
  'Commercial':          '#10b981',
  'Produit':             '#8b5cf6',
  'Design':              '#f59e0b',
  'Acheteur':            '#14b8a6',
  'Hors expertise Digi': '#d1d5db',
}

const NIVEAU_ORDER: Record<string, number> = {
  'Ami': 0,
  'Cercle familial': 1,
  'Ancien collègue': 2,
  'Alumni': 3,
  'Partenaire business': 4,
  'Connaissance': 5,
  'Non renseigné': 6,
}

const NIVEAU_COLOR: Record<string, string> = {
  'Ami':                  '#10b981',
  'Cercle familial':      '#3b82f6',
  'Ancien collègue':      '#3b82f6',
  'Alumni':               '#3b82f6',
  'Partenaire business':  '#3b82f6',
  'Connaissance':         '#f59e0b',
  'Non renseigné':        '#d1d5db',
}

export function ContactDistributionChart({
  dimension,
  title,
  secteurs,
  onSecteursChange,
}: {
  dimension: 'niveau_de_relation' | 'persona'
  title: string
  secteurs: string[]
  onSecteursChange: (v: string[]) => void
}) {
  const navigate = useNavigate()
  const { data, loading } = useContactDistribution(dimension, null, secteurs)

  const total = data?.reduce((s, r) => s + r.count, 0) ?? 0
  const urlParam = dimension === 'niveau_de_relation' ? 'niveau_de_relation' : 'persona'

  const sortedData = data
    ? dimension === 'niveau_de_relation'
      ? [...data].sort((a, b) => (NIVEAU_ORDER[a.label] ?? 99) - (NIVEAU_ORDER[b.label] ?? 99))
      : [...data].sort((a, b) => (PERSONA_ORDER[a.label] ?? 98) - (PERSONA_ORDER[b.label] ?? 98))
    : []

  function buildHref(label: string) {
    const params = new URLSearchParams({ [urlParam]: label })
    if (secteurs.length === 1) params.set('secteur', secteurs[0])
    return `/contacts?${params.toString()}`
  }

  return (
    <div className="rounded-xl border border-[#050d2b]/12 bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <SecteurFilter selected={secteurs} onChange={onSecteursChange} />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !sortedData.length ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Aucune donnée</p>
      ) : (
        <div className="space-y-2">
          {sortedData.map(row => {
            const pct = total > 0 ? (row.count / total) * 100 : 0
            const barColor = dimension === 'niveau_de_relation'
              ? (NIVEAU_COLOR[row.label] ?? '#d1d5db')
              : (PERSONA_COLOR[row.label] ?? '#d1d5db')
            return (
              <button
                key={row.label}
                type="button"
                onClick={() => navigate(buildHref(row.label))}
                className="w-full flex items-center gap-3 -mx-2 px-2 py-1 rounded-md hover:bg-muted/50 transition-colors text-left"
              >
                <span className="w-36 text-xs text-muted-foreground truncate shrink-0">{row.label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: barColor }} />
                </div>
                <span className="w-10 text-right text-xs font-medium shrink-0">
                  {row.count.toLocaleString('fr-FR')}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
