import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Users, Zap, Loader2, ChevronDown, ChevronRight as ChevronRightIcon, Check } from 'lucide-react'
import { useDashboardStats, useSupabaseQuery, useActivationStats, useActivationEntrepriseList } from '@/lib/hooks/use-supabase'
import { supabase } from '@/lib/supabase'
import { ContactDistributionChart } from '@/components/dashboard/ContactDistributionChart'
import { PipelineStrip } from '@/components/dashboard/PipelineStrip'


function StatCard({ label, value, icon: Icon, description, href }: {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  description: string
  href?: string
}) {
  const content = (
    <div
      className={`rounded-xl border border-[#050d2b]/12 p-6 shadow-md${href ? ' hover:shadow-lg hover:border-[#050d2b]/25 transition-all duration-200' : ''}`}
      style={{ background: 'linear-gradient(135deg, rgba(5,13,43,0.03) 0%, var(--color-card) 50%)' }}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className="rounded-md p-1.5 bg-[#050d2b]/8 text-[#050d2b] dark:bg-white/10 dark:text-white">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-2 text-3xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  )
  if (href) return <Link to={href}>{content}</Link>
  return content
}

const TIER_COLORS: Record<string, string> = {
  'Tier 1': 'bg-[#050d2b]',
  'Tier 2': 'bg-cyan-400',
  'Tier 3': 'bg-amber-400',
  'Hors-Tier': 'bg-muted-foreground/30',
  'Hors cible': 'bg-rose-400',
}

const TIER_BAR_COLORS: Record<string, string> = {
  'Tier 1': 'bg-[#050d2b]',
  'Tier 2': 'bg-cyan-400',
  'Tier 3': 'bg-amber-400',
  'Hors-Tier': 'bg-muted-foreground/30',
  'Hors cible': 'bg-rose-300',
}
const TIER_BAR_ORDER = ['Tier 1', 'Tier 2', 'Tier 3', 'Hors-Tier', 'Hors cible']

const ALL_SECTEURS_LIST = [
  'Pharma/Santé', 'BAF',
  'Éducation & Formation', 'Tourisme, Hôtellerie & Loisirs', 'Technologie & IT',
  'Prestations aux entreprises', 'Media & Communication', 'Recrutement',
  'Commerce de Détail', 'Luxe', 'Services aux Consommateurs',
  'Industrie & Énergie', 'Transports & Logistique', 'Immobilier & Construction',
  'Public & Administrations', 'Concurrent',
]

function SecteurDropdown({ all, selected, onChange }: {
  all: string[]
  selected: string[]
  onChange: (v: string[]) => void
}) {
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
    ? 'Tous les secteurs'
    : selected.length <= 2
      ? selected.join(', ')
      : `${selected.length} secteurs`

  const toggle = (s: string) =>
    onChange(selected.includes(s) ? selected.filter(x => x !== s) : [...selected, s])

  const tierOf = (s: string) => {
    if (['Pharma/Santé', 'BAF'].includes(s)) return 'Tier 1'
    if (['Concurrent', 'Public & Administrations'].includes(s)) return 'Hors-Tier'
    if (s === 'Non classé') return 'Tier 3'
    return 'Tier 2'
  }

  const grouped: Record<string, string[]> = {}
  for (const s of all) {
    const t = tierOf(s)
    if (!grouped[t]) grouped[t] = []
    grouped[t].push(s)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 h-8 text-sm text-muted-foreground hover:text-foreground hover:border-[#050d2b]/30 transition-colors"
      >
        <span className="max-w-[220px] truncate">{label}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-50 w-64 rounded-xl border border-border bg-card shadow-lg py-1 max-h-80 overflow-y-auto">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border mb-1">
            <button type="button" onClick={() => onChange([])} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Tous</button>
            <button type="button" onClick={() => onChange([...all])} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Tout sélectionner</button>
          </div>
          {(['Tier 1', 'Tier 2', 'Tier 3', 'Hors-Tier'] as const).map(tier => {
            const items = grouped[tier]
            if (!items?.length) return null
            return (
              <div key={tier}>
                <p className="px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">{tier}</p>
                {items.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggle(s)}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-muted/60 transition-colors text-left"
                  >
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selected.includes(s) ? 'bg-[#050d2b] border-[#050d2b]' : 'border-input'}`}>
                      {selected.includes(s) && <Check className="h-2.5 w-2.5 text-white" />}
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

function SectionTitle({ children, open, onToggle }: { children: React.ReactNode; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-3 my-2 w-full text-left group"
    >
      {open
        ? <ChevronDown className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
        : <ChevronRightIcon className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
      }
      <h2 className="text-base font-semibold uppercase tracking-widest text-muted-foreground/70 group-hover:text-muted-foreground transition-colors">{children}</h2>
      <div className="flex-1 h-px bg-border" />
    </button>
  )
}

export default function Dashboard() {
  const [openGlobale, setOpenGlobale] = useState(true)
  const [openPipeline, setOpenPipeline] = useState(true)
  const [openActivation, setOpenActivation] = useState(true)
  const [secteurFilter, setSecteurFilter] = useState<string[]>(['BAF', 'Pharma/Santé'])
  const [activationSecteurFilter, setActivationSecteurFilter] = useState<string[]>(['BAF', 'Pharma/Santé'])
  const [distributionSecteurFilter, setDistributionSecteurFilter] = useState<string[]>(['BAF', 'Pharma/Santé'])

  const { data: stats, loading } = useDashboardStats()
  const { data: activationStats } = useActivationStats(activationSecteurFilter)
  const { data: activationList, loading: loadingActivationList } = useActivationEntrepriseList(activationSecteurFilter)

  type SecteurRow = { secteur_digi: string; total: number; tiers: Record<string, number> }
  const { data: secteurStats } = useSupabaseQuery<SecteurRow[]>(
    async () => {
      const { data, error } = await supabase
        .from('entreprises')
        .select('secteur_digi, tier')
      if (error) return { data: null, error }
      const rows = (data ?? []) as { secteur_digi: string | null; tier: string | null }[]
      const map: Record<string, SecteurRow> = {}
      for (const r of rows) {
        const s = r.secteur_digi ?? 'Non classé'
        const t = r.tier ?? 'Hors-Tier'
        if (!map[s]) map[s] = { secteur_digi: s, total: 0, tiers: {} }
        map[s].total++
        map[s].tiers[t] = (map[s].tiers[t] ?? 0) + 1
      }
      return {
        data: Object.values(map).sort((a, b) => b.total - a.total),
        error: null,
      }
    }
  )

if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const s = stats ?? {
    total_entreprises: 0, total_contacts: 0, total_notifications: 0,
    contacts_a_contacter: 0, contacts_contactes: 0,
    tier1: 0, tier2: 0, tier3: 0, hors_cible: 0, clients_digileads: 0,
    contacts_interesses: 0, contacts_clients_digi: 0,
  }

  const horsTier = s.total_entreprises - s.tier1 - s.tier2 - s.tier3 - s.hors_cible


  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      </div>

      {/* ── Section 1 : Vue globale ── */}
      <SectionTitle open={openGlobale} onToggle={() => setOpenGlobale(v => !v)}>Vue globale</SectionTitle>

      {openGlobale && <>
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            label="Entreprises"
            value={s.total_entreprises.toLocaleString('fr-FR')}
            icon={Building2}
            description="Total en base"
            href="/entreprises"
          />
          <StatCard
            label="Contacts"
            value={s.total_contacts.toLocaleString('fr-FR')}
            icon={Users}
            description="Contacts importés"
            href="/contacts"
          />
          <StatCard
            label="Entreprises Digileads"
            value={s.clients_digileads.toLocaleString('fr-FR')}
            icon={Zap}
            description="Devenues clientes Digileads"
            href="/entreprises?client_digileads=true"
          />
        </div>

        <div className="rounded-xl border border-[#050d2b]/12 bg-card p-5 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Répartition par Tier</h2>
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: 'Tier 1', count: s.tier1, href: '/entreprises?tier=Tier 1' },
              { label: 'Tier 2', count: s.tier2, href: '/entreprises?tier=Tier 2' },
              { label: 'Tier 3', count: s.tier3, href: '/entreprises?tier=Tier 3' },
              { label: 'Hors-Tier', count: horsTier, href: '/entreprises?tier=Hors-Tier' },
              { label: 'Hors cible', count: s.hors_cible, href: '/entreprises?tier=Hors cible' },
            ].map(({ label, count, href }) => (
              <Link
                key={label}
                to={href}
                className="flex flex-col items-center rounded-xl border border-[#050d2b]/10 p-3 hover:border-[#050d2b]/25 hover:shadow-sm transition-all text-center"
              >
                <span className="text-xl font-bold">{count.toLocaleString('fr-FR')}</span>
                <span className="text-xs text-muted-foreground mt-1 leading-tight">{label}</span>
                <div className={`mt-2 h-1 w-6 rounded-full ${TIER_COLORS[label] ?? 'bg-muted-foreground/30'}`} />
              </Link>
            ))}
          </div>
        </div>

        {secteurStats && secteurStats.length > 0 && (
          <div className="rounded-xl border border-[#050d2b]/12 bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-lg font-semibold">Répartition par Secteur</h2>
              <SecteurDropdown
                all={secteurStats.map(r => r.secteur_digi)}
                selected={secteurFilter}
                onChange={setSecteurFilter}
              />
            </div>
            <div className="space-y-1.5">
              {(secteurFilter.length > 0
                ? secteurStats.filter(r => secteurFilter.includes(r.secteur_digi))
                : secteurStats.slice(0, 16)
              ).map(row => (
                <Link
                  key={row.secteur_digi}
                  to={`/entreprises?secteur=${encodeURIComponent(row.secteur_digi)}`}
                  className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60 transition-colors"
                >
                  <span className="w-40 text-sm truncate shrink-0">{row.secteur_digi}</span>
                  <div className="flex-1 flex h-2 rounded-full overflow-hidden bg-muted">
                    {TIER_BAR_ORDER.filter(t => row.tiers[t]).map(t => (
                      <div
                        key={t}
                        className={`h-full ${TIER_BAR_COLORS[t]}`}
                        style={{ width: `${(row.tiers[t] / row.total) * 100}%` }}
                        title={`${t} : ${row.tiers[t].toLocaleString('fr-FR')}`}
                      />
                    ))}
                  </div>
                  <span className="w-12 text-right text-xs text-muted-foreground shrink-0">{row.total.toLocaleString('fr-FR')}</span>
                </Link>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
              {[['Tier 1', 'bg-[#050d2b]'], ['Tier 2', 'bg-cyan-400'], ['Tier 3', 'bg-amber-400'], ['Hors-Tier', 'bg-muted-foreground/30']].map(([label, dot]) => (
                <span key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={`w-2.5 h-2.5 rounded-sm ${dot}`} />
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <ContactDistributionChart dimension="niveau_de_relation" title="Contacts par niveau relationnel" secteurs={distributionSecteurFilter} onSecteursChange={setDistributionSecteurFilter} />
          <ContactDistributionChart dimension="persona" title="Contacts par persona" secteurs={distributionSecteurFilter} onSecteursChange={setDistributionSecteurFilter} />
        </div>
      </>}

      {/* ── Section 2 : Pipeline ── */}
      <SectionTitle open={openPipeline} onToggle={() => setOpenPipeline(v => !v)}>Pipeline</SectionTitle>

      {openPipeline && <PipelineStrip />}

      {/* ── Section 3 : Activation ── */}
      <SectionTitle open={openActivation} onToggle={() => setOpenActivation(v => !v)}>Activation</SectionTitle>

      {openActivation && <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-[#050d2b]/12 bg-card p-6 shadow-sm">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h2 className="text-lg font-semibold">Entreprises sans contact activé</h2>
            <SecteurDropdown
              all={ALL_SECTEURS_LIST}
              selected={activationSecteurFilter}
              onChange={setActivationSecteurFilter}
            />
          </div>
          <p className="text-xs text-muted-foreground mb-4">Aucun contact avec statut À contacter, Contacté, Rdv pris ou Intéressé</p>
          {loadingActivationList ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !activationList?.filter(r => r.nb_contacts > 0).length ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucune entreprise sans contact activé 🎉</p>
          ) : (
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {activationList.filter(r => r.nb_contacts > 0).map(row => (
                <Link
                  key={row.id}
                  to={`/entreprises?tier=${encodeURIComponent(row.tier)}&sans_contact_active=true`}
                  className="flex items-center gap-3 -mx-2 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors"
                >
                  <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${TIER_COLORS[row.tier] ?? 'bg-muted-foreground/30'}`} />
                  <span className="flex-1 text-sm truncate">{row.company_name}</span>
                  <span className="text-[11px] text-muted-foreground shrink-0">{row.tier}</span>
                  {row.nb_contacts > 0 && (
                    <span className="text-[11px] text-muted-foreground shrink-0">{row.nb_contacts} contact{row.nb_contacts > 1 ? 's' : ''}</span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#050d2b]/12 bg-card p-6 shadow-sm">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h2 className="text-lg font-semibold">Contacts activés par owner</h2>
            <SecteurDropdown
              all={ALL_SECTEURS_LIST}
              selected={activationSecteurFilter}
              onChange={setActivationSecteurFilter}
            />
          </div>
          <p className="text-xs text-muted-foreground mb-4">Contacts avec statut À contacter, Contacté, Rdv pris ou Intéressé</p>
          {!activationStats?.owners || activationStats.owners.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-sm text-muted-foreground">Aucun owner avec des contacts</p>
            </div>
          ) : (
            <div className="divide-y divide-border max-h-72 overflow-y-auto">
              {activationStats.owners.map(owner => (
                <Link
                  key={owner.membre_id}
                  to={`/contacts?owner=${owner.membre_id}`}
                  className="flex items-center gap-3 py-2 first:pt-0 last:pb-0 -mx-2 px-2 rounded-md hover:bg-muted/50 transition-colors"
                >
                  <span className="flex-1 text-sm font-medium truncate">{owner.full_name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {owner.nb_contacts} contact{owner.nb_contacts > 1 ? 's' : ''}
                  </span>
                  <span className={`text-xs font-semibold shrink-0 min-w-[60px] text-right ${owner.nb_contacts_actives === 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                    {owner.nb_contacts_actives} activé{owner.nb_contacts_actives > 1 ? 's' : ''}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>}

    </div>
  )
}
