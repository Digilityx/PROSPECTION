-- RPC légère utilisée par detect-merge-duplicates.mjs --linkedin-id-only
-- Retourne uniquement les id_url_linkedin qui apparaissent plus d'une fois
-- (contacts non masqués), pour éviter de charger toute la base côté script.

CREATE OR REPLACE FUNCTION find_duplicate_linkedin_ids()
RETURNS TABLE(id_url_linkedin TEXT)
LANGUAGE sql
STABLE
AS $$
  SELECT id_url_linkedin
  FROM contacts
  WHERE id_url_linkedin IS NOT NULL
    AND masque = false
  GROUP BY id_url_linkedin
  HAVING COUNT(*) > 1;
$$;

GRANT EXECUTE ON FUNCTION find_duplicate_linkedin_ids() TO authenticated, anon;
