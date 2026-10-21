-- Ajout filtre p_secteurs à get_activation_entreprise_stats

DROP FUNCTION IF EXISTS get_activation_entreprise_stats();

CREATE OR REPLACE FUNCTION get_activation_entreprise_stats(
  p_secteurs TEXT[] DEFAULT NULL
)
RETURNS TABLE (tier TEXT, nb_entreprises BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT e.tier, COUNT(*)::BIGINT AS nb_entreprises
  FROM entreprises e
  WHERE e.tier IN ('Tier 1', 'Tier 2', 'Tier 3', 'Hors-Tier')
    AND (p_secteurs IS NULL OR array_length(p_secteurs, 1) = 0 OR e.secteur_digi = ANY(p_secteurs))
    AND NOT EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.entreprise_id = e.id
        AND c.masque = FALSE
        AND c.is_digi_employee = FALSE
        AND c.contact_digi = FALSE
        AND c.statut_contact IN ('À contacter', 'Contacté', 'Rdv pris', 'Intéressé')
    )
  GROUP BY e.tier
  ORDER BY e.tier;
END;
$$;

GRANT EXECUTE ON FUNCTION get_activation_entreprise_stats(TEXT[]) TO authenticated;
