-- Ajout du filtre p_secteurs (tableau) à get_contact_distribution
-- Remplace la version précédente (p_tier seul)

DROP FUNCTION IF EXISTS get_contact_distribution(TEXT, TEXT);

CREATE OR REPLACE FUNCTION get_contact_distribution(
  p_dimension TEXT,
  p_tier      TEXT    DEFAULT NULL,
  p_secteurs  TEXT[]  DEFAULT NULL
)
RETURNS TABLE (label TEXT, cnt BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  needs_join BOOLEAN := p_tier IS NOT NULL OR (p_secteurs IS NOT NULL AND array_length(p_secteurs, 1) > 0);
BEGIN
  IF p_dimension = 'niveau_de_relation' THEN
    IF needs_join THEN
      RETURN QUERY
      SELECT COALESCE(c.niveau_de_relation, 'Non renseigné') AS label, COUNT(*)::BIGINT AS cnt
      FROM contacts c
      JOIN entreprises e ON e.id = c.entreprise_id
      WHERE c.masque = FALSE AND c.is_digi_employee = FALSE
        AND (p_tier IS NULL OR e.tier = p_tier)
        AND (p_secteurs IS NULL OR array_length(p_secteurs, 1) = 0 OR e.secteur_digi = ANY(p_secteurs))
      GROUP BY 1 ORDER BY cnt DESC;
    ELSE
      RETURN QUERY
      SELECT COALESCE(c.niveau_de_relation, 'Non renseigné') AS label, COUNT(*)::BIGINT AS cnt
      FROM contacts c
      WHERE c.masque = FALSE AND c.is_digi_employee = FALSE
      GROUP BY 1 ORDER BY cnt DESC;
    END IF;
  ELSE
    IF needs_join THEN
      RETURN QUERY
      SELECT COALESCE(c.persona, 'Non renseigné') AS label, COUNT(*)::BIGINT AS cnt
      FROM contacts c
      JOIN entreprises e ON e.id = c.entreprise_id
      WHERE c.masque = FALSE AND c.is_digi_employee = FALSE
        AND (p_tier IS NULL OR e.tier = p_tier)
        AND (p_secteurs IS NULL OR array_length(p_secteurs, 1) = 0 OR e.secteur_digi = ANY(p_secteurs))
      GROUP BY 1 ORDER BY cnt DESC;
    ELSE
      RETURN QUERY
      SELECT COALESCE(c.persona, 'Non renseigné') AS label, COUNT(*)::BIGINT AS cnt
      FROM contacts c
      WHERE c.masque = FALSE AND c.is_digi_employee = FALSE
      GROUP BY 1 ORDER BY cnt DESC;
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_contact_distribution(TEXT, TEXT, TEXT[]) TO authenticated;
