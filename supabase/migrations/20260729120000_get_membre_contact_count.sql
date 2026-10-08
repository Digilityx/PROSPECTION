CREATE OR REPLACE FUNCTION get_membre_contact_count()
RETURNS TABLE(membre_id uuid, cnt bigint)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    cmr.membre_id,
    count(*)::bigint AS cnt
  FROM contacts_membres_relations cmr
  JOIN contacts c ON c.id = cmr.contact_id
  JOIN membres_digilityx m ON m.id = cmr.membre_id
  WHERE m.actif = true
    AND m.partager_contacts = true
    AND NOT c.masque
  GROUP BY cmr.membre_id;
$$;

GRANT EXECUTE ON FUNCTION get_membre_contact_count() TO authenticated, anon;
