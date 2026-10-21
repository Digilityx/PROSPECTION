import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabase'

interface QueryState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

export function useSupabaseQuery<T>(
  queryFn: () => PromiseLike<{ data: T | null; error: { message: string } | null }>,
  deps: unknown[] = []
) {
  const [state, setState] = useState<QueryState<T>>({
    data: null,
    loading: true,
    error: null,
  })

  const refetch = useCallback(() => {
    setState(s => ({ ...s, loading: true, error: null }))
    queryFn().then(({ data, error }) => {
      if (error) {
        setState({ data: null, loading: false, error: error.message })
      } else {
        setState({ data, loading: false, error: null })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    refetch()
  }, [refetch])

  return { ...state, refetch }
}

export interface DashboardStats {
  total_entreprises: number
  total_contacts: number
  total_notifications: number
  contacts_a_contacter: number
  contacts_contactes: number
  tier1: number
  tier2: number
  tier3: number
  hors_cible: number
  clients_digileads: number
  contacts_interesses: number
  contacts_clients_digi: number
}

export function useDashboardStats() {
  return useSupabaseQuery<DashboardStats>(async () => {
    const { data, error } = await supabase.rpc('get_dashboard_stats').single()
    if (error || !data) return { data: null, error }
    const r = data as Record<keyof DashboardStats, number | string>
    const num = (v: number | string | null | undefined) => Number(v ?? 0)
    return {
      data: {
        total_entreprises: num(r.total_entreprises),
        total_contacts: num(r.total_contacts),
        total_notifications: num(r.total_notifications),
        contacts_a_contacter: num(r.contacts_a_contacter),
        contacts_contactes: num(r.contacts_contactes),
        tier1: num(r.tier1),
        tier2: num(r.tier2),
        tier3: num(r.tier3),
        hors_cible: num(r.hors_cible),
        clients_digileads: num(r.clients_digileads),
        contacts_interesses: num(r.contacts_interesses),
        contacts_clients_digi: num(r.contacts_clients_digi),
      },
      error: null,
    }
  })
}

export interface PipelineActivity {
  a_contacter: number
  contactes: number
  rdv_pris: number
  interesses: number
  pas_interesses: number
  clients_digi: number
}

export function usePipelineActivity(from: string | null, to: string | null) {
  return useSupabaseQuery<PipelineActivity>(
    async () => {
      const { data, error } = await supabase
        .rpc('get_dashboard_pipeline_activity', {
          p_from: from ? new Date(from).toISOString() : null,
          p_to: to ? new Date(to + 'T23:59:59').toISOString() : null,
        })
        .single()
      if (error || !data) return { data: null, error }
      const r = data as Record<string, number | string>
      const num = (v: number | string | null | undefined) => Number(v ?? 0)
      return {
        data: {
          a_contacter: num(r.a_contacter),
          contactes: num(r.contactes),
          rdv_pris: num(r.rdv_pris),
          interesses: num(r.interesses),
          pas_interesses: num(r.pas_interesses),
          clients_digi: num(r.clients_digi),
        },
        error: null,
      }
    },
    [from, to]
  )
}

export interface MonthlyEvolutionRow {
  month: string
  a_contacter: number
  contactes: number
  rdv_pris: number
  interesses: number
  pas_interesses: number
  clients_digi: number
}

export function usePipelineEvolution(months = 6) {
  return useSupabaseQuery<MonthlyEvolutionRow[]>(
    async () => {
      const { data, error } = await supabase.rpc('get_pipeline_monthly_evolution', { p_months: months })
      if (error) return { data: null, error }
      const rows = (data ?? []) as Record<string, number | string>[]
      return {
        data: rows.map(r => ({
          month: String(r.month),
          a_contacter: Number(r.a_contacter ?? 0),
          contactes: Number(r.contactes ?? 0),
          rdv_pris: Number(r.rdv_pris ?? 0),
          interesses: Number(r.interesses ?? 0),
          pas_interesses: Number(r.pas_interesses ?? 0),
          clients_digi: Number(r.clients_digi ?? 0),
        })),
        error: null,
      }
    },
    [months]
  )
}

export interface DistributionRow {
  label: string
  count: number
}

export function useContactDistribution(
  dimension: 'niveau_de_relation' | 'persona',
  tier: string | null,
  secteurs: string[] = []
) {
  return useSupabaseQuery<DistributionRow[]>(
    async () => {
      const { data, error } = await supabase.rpc('get_contact_distribution', {
        p_dimension: dimension,
        p_tier: tier ?? null,
        p_secteurs: secteurs.length > 0 ? secteurs : null,
      })
      if (error) return { data: null, error }
      const rows = (data ?? []) as { label: string; cnt: number | string }[]
      return {
        data: rows.map(r => ({ label: r.label, count: Number(r.cnt) })),
        error: null,
      }
    },
    [dimension, tier, JSON.stringify(secteurs)]
  )
}

export interface ActivationEntrepriseRow {
  tier: string
  nb_entreprises: number
}

export interface ActivationEntrepriseListRow {
  id: string
  company_name: string
  tier: string
  secteur_digi: string | null
  nb_contacts: number
}

export function useActivationEntrepriseList(secteurs: string[] = []) {
  return useSupabaseQuery<ActivationEntrepriseListRow[]>(
    async () => {
      const { data, error } = await supabase.rpc('get_activation_entreprise_list', {
        p_secteurs: secteurs.length > 0 ? secteurs : null,
      })
      if (error) return { data: null, error }
      const rows = (data ?? []) as Record<string, string | number | null>[]
      return {
        data: rows.map(r => ({
          id: String(r.id),
          company_name: String(r.company_name),
          tier: String(r.tier),
          secteur_digi: r.secteur_digi ? String(r.secteur_digi) : null,
          nb_contacts: Number(r.nb_contacts ?? 0),
        })),
        error: null,
      }
    },
    [JSON.stringify(secteurs)]
  )
}

export interface ActivationOwnerRow {
  membre_id: string
  full_name: string
  nb_contacts: number
  nb_contacts_actives: number
}

export interface ActivationStats {
  entreprises: ActivationEntrepriseRow[]
  owners: ActivationOwnerRow[]
}

export function useActivationStats(secteurs: string[] = []) {
  return useSupabaseQuery<ActivationStats>(
    async () => {
    const [entRes, ownRes] = await Promise.all([
      supabase.rpc('get_activation_entreprise_stats', {
        p_secteurs: secteurs.length > 0 ? secteurs : null,
      }),
      supabase.rpc('get_activation_owner_stats', {
        p_secteurs: secteurs.length > 0 ? secteurs : null,
      }),
    ])
    if (entRes.error) return { data: null, error: entRes.error }
    if (ownRes.error) return { data: null, error: ownRes.error }
    const entreprises = ((entRes.data ?? []) as { tier: string; nb_entreprises: number | string }[]).map(r => ({
      tier: r.tier,
      nb_entreprises: Number(r.nb_entreprises),
    }))
    const owners = ((ownRes.data ?? []) as { membre_id: string; full_name: string; nb_contacts: number | string; nb_contacts_actives: number | string }[]).map(r => ({
      membre_id: r.membre_id,
      full_name: r.full_name,
      nb_contacts: Number(r.nb_contacts),
      nb_contacts_actives: Number(r.nb_contacts_actives),
    }))
    return { data: { entreprises, owners }, error: null }
  },
  [JSON.stringify(secteurs)]
  )
}
