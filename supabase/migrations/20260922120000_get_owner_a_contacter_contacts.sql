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
  ORDER BY
    CASE c.statut_contact WHEN 'À contacter' THEN 0 ELSE 1 END,
    c.scoring DESC;
$$;
