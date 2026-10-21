-- Liste des entreprises sans contact activé (avec filtre secteur)

CREATE OR REPLACE FUNCTION get_activation_entreprise_list(
  p_secteurs TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id            UUID,
  company_name  TEXT,
  tier          TEXT,
  secteur_digi  TEXT,
  nb_contacts   BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.company_name,
    e.tier,
    e.secteur_digi,
    COUNT(c.id)::BIGINT AS nb_contacts
  FROM entreprises e
  LEFT JOIN contacts c ON c.entreprise_id = e.id
    AND c.masque = FALSE
    AND c.is_digi_employee = FALSE
  WHERE e.tier IN ('Tier 1', 'Tier 2', 'Tier 3', 'Hors-Tier')
    AND (p_secteurs IS NULL OR array_length(p_secteurs, 1) = 0 OR e.secteur_digi = ANY(p_secteurs))
    AND NOT EXISTS (
      SELECT 1 FROM contacts c2
      WHERE c2.entreprise_id = e.id
        AND c2.masque = FALSE
        AND c2.is_digi_employee = FALSE
        AND c2.contact_digi = FALSE
        AND c2.statut_contact IN ('À contacter', 'Contacté', 'Rdv pris', 'Intéressé')
    )
  GROUP BY e.id, e.company_name, e.tier, e.secteur_digi
  ORDER BY
    CASE e.tier
      WHEN 'Tier 1' THEN 1
      WHEN 'Tier 2' THEN 2
      WHEN 'Tier 3' THEN 3
      ELSE 4
    END,
    e.company_name;
END;
$$;

GRANT EXECUTE ON FUNCTION get_activation_entreprise_list(TEXT[]) TO authenticated;
