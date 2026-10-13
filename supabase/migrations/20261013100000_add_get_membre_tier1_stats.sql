-- Nouvelle RPC get_membre_tier1_stats : retourne total_tier1 ET unqualified_tier1
-- avec le même scope (masque=false, contact_digi=false, is_digi_employee=false).
-- Remplace l'usage combiné de get_membre_relations_by_tier + get_membre_tier1_unqualified_count
-- pour le filtre "0 qualifiés T1" dans la Vue Tier.

CREATE OR REPLACE FUNCTION get_membre_tier1_stats()
RETURNS TABLE(membre_id uuid, total_tier1 bigint, unqualified_tier1 bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    r.membre_id,
    COUNT(*)::bigint AS total_tier1,
    COUNT(*) FILTER (
      WHERE r.niveau_de_relation IS NULL OR r.niveau_de_relation = 'Non renseigné'
    )::bigint AS unqualified_tier1
  FROM contacts_membres_relations r
  JOIN entreprises e ON e.id = r.entreprise_id
  JOIN contacts c ON c.id = r.contact_id
  WHERE e.tier = 'Tier 1'
    AND NOT c.masque
    AND NOT c.contact_digi
    AND NOT c.is_digi_employee
  GROUP BY r.membre_id;
$$;

GRANT EXECUTE ON FUNCTION get_membre_tier1_stats() TO authenticated, anon;
