-- Ajout du champ is_digi_employee sur contacts.
-- Marque les contacts qui sont désormais collaborateurs Digilityx.
-- Ces contacts sont exclus de toutes les vues de prospection (pas de badge UI).

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_digi_employee BOOLEAN NOT NULL DEFAULT false;

-- Mettre à jour get_contacts_for_membre pour exclure les employés Digi
CREATE OR REPLACE FUNCTION get_contacts_for_membre(
  p_membre_id        uuid,
  p_tier             text    DEFAULT NULL,
  p_statut           text    DEFAULT NULL,
  p_hierarchie       text    DEFAULT NULL,
  p_persona          text    DEFAULT NULL,
  p_entreprise_link  text    DEFAULT NULL,
  p_entreprise_id    uuid    DEFAULT NULL,
  p_niveau_relation  text    DEFAULT NULL,
  p_search           text    DEFAULT NULL,
  p_order_asc        boolean DEFAULT false,
  p_offset           int     DEFAULT 0,
  p_limit            int     DEFAULT 50,
  p_unqualified_first boolean DEFAULT false
)
RETURNS TABLE (
  id                      uuid,
  first_name              text,
  last_name               text,
  "position"              text,
  company_name            text,
  location                text,
  linkedin_url            text,
  id_url_linkedin         text,
  email                   text,
  persona                 text,
  hierarchie              text,
  statut_contact          text,
  niveau_de_relation      text,
  scoring                 int,
  nb_personnes_digi_relation int,
  contact_digi            boolean,
  entreprise_id           uuid,
  owner_membre_id         uuid,
  tier                    text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    c.id, c.first_name, c.last_name, c."position", c.company_name, c.location,
    c.linkedin_url, c.id_url_linkedin, c.email, c.persona, c.hierarchie,
    c.statut_contact, rel.niveau_de_relation, c.scoring,
    c.nb_personnes_digi_relation, c.contact_digi, c.entreprise_id,
    c.owner_membre_id, e.tier
  FROM contacts_membres_relations rel
  JOIN contacts c ON c.id = rel.contact_id
  LEFT JOIN entreprises e ON e.id = c.entreprise_id
  WHERE rel.membre_id = p_membre_id
    AND NOT c.masque
    AND NOT c.contact_digi
    AND NOT c.is_digi_employee
    AND (p_tier IS NULL OR e.tier = p_tier)
    AND (p_statut IS NULL OR c.statut_contact = p_statut)
    AND (p_hierarchie IS NULL OR c.hierarchie = p_hierarchie)
    AND (p_persona IS NULL OR c.persona = p_persona)
    AND (p_entreprise_id IS NULL OR c.entreprise_id = p_entreprise_id)
    AND (
      p_niveau_relation IS NULL
      OR COALESCE(rel.niveau_de_relation, 'Non renseigné') = p_niveau_relation
    )
    AND (
      p_entreprise_link IS NULL
      OR (p_entreprise_link = 'sans'         AND c.company_name IS NULL)
      OR (p_entreprise_link = 'avec'         AND c.company_name IS NOT NULL)
      OR (p_entreprise_link = 'non-rattache' AND c.company_name IS NOT NULL AND c.entreprise_id IS NULL)
    )
    AND (
      p_search IS NULL
      OR c.first_name  ILIKE '%' || p_search || '%'
      OR c.last_name   ILIKE '%' || p_search || '%'
      OR c.company_name ILIKE '%' || p_search || '%'
    )
  ORDER BY
    CASE WHEN p_unqualified_first AND (rel.niveau_de_relation IS NULL OR rel.niveau_de_relation = 'Non renseigné') THEN 0 ELSE 1 END ASC,
    CASE WHEN p_order_asc     THEN rel.scoring END ASC,
    CASE WHEN NOT p_order_asc THEN rel.scoring END DESC
  OFFSET p_offset
  LIMIT p_limit;
$$;

-- Mettre à jour count_contacts_for_membre
DROP FUNCTION IF EXISTS count_contacts_for_membre(uuid, text, text, text, text, text, uuid, text, text);

CREATE OR REPLACE FUNCTION count_contacts_for_membre(
  p_membre_id        uuid,
  p_tier             text DEFAULT NULL,
  p_statut           text DEFAULT NULL,
  p_hierarchie       text DEFAULT NULL,
  p_persona          text DEFAULT NULL,
  p_entreprise_link  text DEFAULT NULL,
  p_entreprise_id    uuid DEFAULT NULL,
  p_niveau_relation  text DEFAULT NULL,
  p_search           text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  result bigint;
BEGIN
  IF p_tier IS NULL
     AND p_statut IS NULL
     AND p_hierarchie IS NULL
     AND p_persona IS NULL
     AND p_entreprise_link IS NULL
     AND p_entreprise_id IS NULL
     AND p_niveau_relation IS NULL
     AND p_search IS NULL THEN
    SELECT COUNT(*) INTO result
    FROM contacts_membres_relations rel
    JOIN contacts c ON c.id = rel.contact_id
    WHERE rel.membre_id = p_membre_id
      AND NOT c.masque
      AND NOT c.contact_digi
      AND NOT c.is_digi_employee;
    RETURN result;
  END IF;

  SELECT COUNT(*) INTO result
  FROM contacts_membres_relations rel
  JOIN contacts c ON c.id = rel.contact_id
  LEFT JOIN entreprises e ON e.id = c.entreprise_id
  WHERE rel.membre_id = p_membre_id
    AND NOT c.masque
    AND NOT c.contact_digi
    AND NOT c.is_digi_employee
    AND (p_tier IS NULL OR e.tier = p_tier)
    AND (p_statut IS NULL OR c.statut_contact = p_statut)
    AND (p_hierarchie IS NULL OR c.hierarchie = p_hierarchie)
    AND (p_persona IS NULL OR c.persona = p_persona)
    AND (p_entreprise_id IS NULL OR c.entreprise_id = p_entreprise_id)
    AND (
      p_niveau_relation IS NULL
      OR COALESCE(rel.niveau_de_relation, 'Non renseigné') = p_niveau_relation
    )
    AND (
      p_entreprise_link IS NULL
      OR (p_entreprise_link = 'sans'         AND c.company_name IS NULL)
      OR (p_entreprise_link = 'avec'         AND c.company_name IS NOT NULL)
      OR (p_entreprise_link = 'non-rattache' AND c.company_name IS NOT NULL AND c.entreprise_id IS NULL)
    )
    AND (
      p_search IS NULL
      OR c.first_name  ILIKE '%' || p_search || '%'
      OR c.last_name   ILIKE '%' || p_search || '%'
      OR c.company_name ILIKE '%' || p_search || '%'
    );
  RETURN result;
END;
$$;

-- Mettre à jour get_owner_a_contacter_contacts
CREATE OR REPLACE FUNCTION get_owner_a_contacter_contacts(p_owner_id uuid)
RETURNS TABLE(
  id uuid,
  first_name text,
  last_name text,
  "position" text,
  company_name text,
  scoring integer,
  tier text,
  entreprise_id uuid,
  niveau_de_relation text,
  account_manager_name text,
  account_manager_slack_user_id text,
  statut_contact text
) LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    c.id,
    c.first_name,
    c.last_name,
    c.position,
    c.company_name,
    c.scoring,
    e.tier,
    c.entreprise_id,
    cmr.niveau_de_relation,
    am.full_name      AS account_manager_name,
    am.slack_user_id  AS account_manager_slack_user_id,
    c.statut_contact
  FROM contacts c
  LEFT JOIN entreprises e ON c.entreprise_id = e.id
  LEFT JOIN contacts_membres_relations cmr
         ON cmr.contact_id = c.id AND cmr.membre_id = p_owner_id
  LEFT JOIN membres_digilityx am ON e.account_manager_id = am.id
  WHERE c.owner_membre_id = p_owner_id
    AND c.masque IS NOT TRUE
    AND c.contact_digi IS NOT TRUE
    AND c.is_digi_employee IS NOT TRUE
  ORDER BY
    CASE c.statut_contact WHEN 'À contacter' THEN 0 ELSE 1 END,
    c.scoring DESC;
$$;

-- Mettre à jour get_membre_tier1_unqualified_count
CREATE OR REPLACE FUNCTION get_membre_tier1_unqualified_count()
RETURNS TABLE(membre_id uuid, cnt bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT r.membre_id, COUNT(*)::bigint AS cnt
  FROM contacts_membres_relations r
  JOIN entreprises e ON e.id = r.entreprise_id
  JOIN contacts c ON c.id = r.contact_id
  WHERE e.tier = 'Tier 1'
    AND (r.niveau_de_relation IS NULL OR r.niveau_de_relation = 'Non renseigné')
    AND NOT c.masque
    AND NOT c.contact_digi
    AND NOT c.is_digi_employee
  GROUP BY r.membre_id;
$$;

GRANT EXECUTE ON FUNCTION get_contacts_for_membre(uuid, text, text, text, text, text, uuid, text, text, boolean, int, int, boolean) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION count_contacts_for_membre(uuid, text, text, text, text, text, uuid, text, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_owner_a_contacter_contacts(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_membre_tier1_unqualified_count() TO authenticated, anon;
