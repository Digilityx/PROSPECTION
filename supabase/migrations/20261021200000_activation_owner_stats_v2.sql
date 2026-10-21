-- Refonte get_activation_owner_stats : tous les owners avec contacts + filtre secteur

DROP FUNCTION IF EXISTS get_activation_owner_stats();

CREATE OR REPLACE FUNCTION get_activation_owner_stats(
  p_secteurs TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  membre_id          UUID,
  full_name          TEXT,
  nb_contacts        BIGINT,
  nb_contacts_actives BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id AS membre_id,
    m.full_name,
    COUNT(DISTINCT c.id)::BIGINT AS nb_contacts,
    COUNT(DISTINCT CASE
      WHEN c.statut_contact IN ('À contacter', 'Contacté', 'Rdv pris', 'Intéressé')
      THEN c.id
    END)::BIGINT AS nb_contacts_actives
  FROM membres_digilityx m
  JOIN contacts c ON c.owner_membre_id = m.id
    AND c.masque = FALSE
    AND c.is_digi_employee = FALSE
  LEFT JOIN entreprises e ON e.id = c.entreprise_id
  WHERE m.actif = TRUE
    AND (
      p_secteurs IS NULL
      OR array_length(p_secteurs, 1) = 0
      OR e.secteur_digi = ANY(p_secteurs)
    )
  GROUP BY m.id, m.full_name
  ORDER BY nb_contacts_actives ASC, nb_contacts DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_activation_owner_stats(TEXT[]) TO authenticated;
