import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { usePipelineActivity, usePipelineEvolution } from '@/lib/hooks/use-supabase'

const STEPS = [
  { key: 'a_contacter',    label: 'À contacter',  statut: 'À contacter',  color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { key: 'contactes',      label: 'Contacté',      statut: 'Contacté',     color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { key: 'rdv_pris',       label: 'Rdv pris',      statut: 'Rdv pris',     color: 'bg-teal-100 text-teal-800 border-teal-200' },
  { key: 'interesses',     label: 'Intéressé',     statut: 'Intéressé',    color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { key: 'pas_interesses', label: 'Pas intéressé', statut: 'Pas intéressé',color: 'bg-gray-100 text-gray-600 border-gray-200' },
  { key: 'clients_digi',   label: 'Client Digileads', statut: 'Client Digileads', color: 'bg-[#050d2b] text-white border-[#050d2b]' },
] as const

type StepKey = typeof STEPS[number]['key']

const EVOLUTION_BARS = [
  { key: 'a_contacter',    label: 'À contacter',     fill: '#3b82f6' },
  { key: 'contactes',      label: 'Contacté',         fill: '#f59e0b' },
  { key: 'rdv_pris',       label: 'Rdv pris',         fill: '#14b8a6' },
  { key: 'interesses',     label: 'Intéressé',        fill: '#10b981' },
  { key: 'pas_interesses', label: 'Pas intéressé',    fill: '#d1d5db' },
  { key: 'clients_digi',   label: 'Client Digileads', fill: '#050d2b' },
]

function formatMonth(yyyyMM: string) {
  const [y, m] = yyyyMM.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
}

function monthToFromTo(year: number, month: number) {
  const from = new Date(year, month, 1)
  const to = new Date(year, month + 1, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return { from: fmt(from), to: fmt(to) }
}

export function PipelineStrip() {
  const now = new Date()
  const [offset, setOffset] = useState(0) // 0 = mois courant, -1 = mois précédent, etc.

  const year  = new Date(now.getFullYear(), now.getMonth() + offset).getFullYear()
  const month = new Date(now.getFullYear(), now.getMonth() + offset).getMonth()

  const monthLabel = new Date(year, month).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const isCurrent  = offset === 0

  const { from, to } = monthToFromTo(year, month)
  const { data: activity, loading: loadingActivity } = usePipelineActivity(from, to)
  const { data: evolution, loading: loadingEvolution } = usePipelineEvolution(6)

  const chartData = (evolution ?? []).map(r => ({
    name: formatMonth(r.month),
    'À contacter': r.a_contacter,
    'Contacté': r.contactes,
    'Rdv pris': r.rdv_pris,
    'Intéressé': r.interesses,
    'Pas intéressé': r.pas_interesses,
    'Client Digileads': r.clients_digi,
  }))

  return (
    <div className="space-y-4">
      {/* ── Ligne pipeline ── */}
      <div className="rounded-xl border border-[#050d2b]/12 bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold">Pipeline</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Activité du mois</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setOffset(o => o - 1)}
              className="h-7 w-7 rounded-md border border-input flex items-center justify-center hover:bg-muted transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-sm font-medium px-3 min-w-[140px] text-center capitalize">{monthLabel}</span>
            <button
              type="button"
              onClick={() => setOffset(o => o + 1)}
              disabled={isCurrent}
              className="h-7 w-7 rounded-md border border-input flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            {!isCurrent && (
              <button
                type="button"
                onClick={() => setOffset(0)}
                className="ml-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Mois en cours
              </button>
            )}
          </div>
        </div>

        {loadingActivity ? (
          <div className="flex items-center justify-center h-20">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex items-center gap-1">
            {STEPS.map((step, i) => {
              const count = activity ? (activity[step.key as StepKey] as number) : 0
              return (
                <div key={step.key} className="flex items-center gap-1 flex-1 min-w-0">
                  <Link
                    to={`/contacts?statut=${encodeURIComponent(step.statut)}`}
                    className={`flex flex-col items-center rounded-xl border px-2 py-3 w-full hover:opacity-80 transition-opacity ${step.color}`}
                  >
                    <span className="text-2xl font-bold">{count.toLocaleString('fr-FR')}</span>
                    <span className="text-[11px] mt-0.5 text-center leading-tight">{step.label}</span>
                  </Link>
                  {i < STEPS.length - 1 && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Graphe d'évolution ── */}
      <div className="rounded-xl border border-[#050d2b]/12 bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-5">Évolution 6 mois</h2>
        {loadingEvolution ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !chartData.length ? (
          <p className="text-sm text-muted-foreground text-center py-12">Aucune donnée</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barCategoryGap="28%" barGap={2}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip
                cursor={{ fill: 'var(--color-muted)', opacity: 0.4 }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const byKey = Object.fromEntries(payload.map(p => [p.name, p.value]))
                  return (
                    <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                      <p className="font-medium mb-1">{label}</p>
                      {EVOLUTION_BARS.map(b => (
                        <div key={b.key} className="flex items-center gap-2 py-0.5">
                          <span className="inline-block h-2 w-2 rounded-sm shrink-0" style={{ background: b.fill }} />
                          <span style={{ color: 'var(--color-muted-foreground)' }}>{b.label} : </span>
                          <span className="font-medium">{byKey[b.label] ?? 0}</span>
                        </div>
                      ))}
                    </div>
                  )
                }}
              />
              <Legend
                content={() => (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center pt-3">
                    {EVOLUTION_BARS.map(b => (
                      <div key={b.key} className="flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-sm shrink-0" style={{ background: b.fill }} />
                        <span className="text-[11px] text-muted-foreground">{b.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              />
              {EVOLUTION_BARS.map(b => (
                <Bar key={b.key} dataKey={b.label} fill={b.fill} radius={[3, 3, 0, 0]} maxBarSize={18} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
