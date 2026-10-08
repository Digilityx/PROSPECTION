-- contacts_membres_relations already has entreprise_id denormalized
-- (20260502170000). Drop the JOIN to contacts entirely so both functions
-- drive from (membre_id, entreprise_id) directly.

CREATE OR REPLACE FUNCTION get_membre_relations_by_tier()
RETURNS TABLE(membre_id uuid, tier text, cnt bigint)
LANGUAGE sql
STABLE
AS $$
  SELECT
    r.membre_id,
    COALESCE(e.tier, 'Sans tier') AS tier,
    COUNT(*)::bigint AS cnt
  FROM contacts_membres_relations r
  LEFT JOIN entreprises e ON e.id = r.entreprise_id
  GROUP BY r.membre_id, COALESCE(e.tier, 'Sans tier');
$$;

ALTER FUNCTION get_membre_relations_by_tier()
  SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION get_membre_tier1_unqualified_count()
RETURNS TABLE(membre_id uuid, cnt bigint)
LANGUAGE sql
STABLE
AS $$
  SELECT r.membre_id, COUNT(*)::bigint AS cnt
  FROM contacts_membres_relations r
  JOIN entreprises e ON e.id = r.entreprise_id
  WHERE e.tier = 'Tier 1'
    AND (r.niveau_de_relation IS NULL OR r.niveau_de_relation = 'Non renseigné')
  GROUP BY r.membre_id;
$$;

ALTER FUNCTION get_membre_tier1_unqualified_count()
  SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION get_membre_relations_by_tier() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_membre_tier1_unqualified_count() TO authenticated, anon;
