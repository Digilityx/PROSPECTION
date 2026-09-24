-- Fix get_membre_contacts to exclude masked contacts (masque = true)
-- and digi employees (is_digi_employee = true), which were previously
-- leaking through because the frontend filter relied on an optional field
-- not returned by the RPC.

CREATE OR REPLACE FUNCTION get_membre_contacts(
  p_membre_id uuid
)
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  "position" text,
  company_name text,
  statut_contact text,
  scoring int,
  niveau_de_relation text,
  tier text,
  secteur_digi text,
  masque boolean
)
LANGUAGE sql
STABLE
AS $$
  WITH rel AS MATERIALIZED (
    SELECT cmr.contact_id, cmr.niveau_de_relation
    FROM contacts_membres_relations cmr
    WHERE cmr.membre_id = p_membre_id
  )
  SELECT
    c.id,
    c.first_name,
    c.last_name,
    c."position",
    c.company_name,
    c.statut_contact,
    c.scoring,
    rel.niveau_de_relation,
    e.tier,
    e.secteur_digi,
    c.masque
  FROM rel
  JOIN contacts c ON c.id = rel.contact_id
  LEFT JOIN entreprises e ON e.id = c.entreprise_id
  WHERE
    c.masque = false
    AND c.is_digi_employee = false
  ORDER BY c.scoring DESC;
$$;
