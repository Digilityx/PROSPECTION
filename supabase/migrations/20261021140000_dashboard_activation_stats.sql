-- RPCs pour la section Activation du Dashboard

-- Répartition des contacts par dimension (niveau_de_relation ou persona) avec filtre tier optionnel
CREATE OR REPLACE FUNCTION get_contact_distribution(
  p_dimension TEXT,      -- 'niveau_de_relation' ou 'persona'
  p_tier      TEXT DEFAULT NULL
)
RETURNS TABLE (label TEXT, cnt BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_dimension = 'niveau_de_relation' THEN
    IF p_tier IS NOT NULL THEN
      RETURN QUERY
      SELECT COALESCE(c.niveau_de_relation, 'Non renseigné') AS label, COUNT(*)::BIGINT AS cnt
      FROM contacts c
      JOIN entreprises e ON e.id = c.entreprise_id
      WHERE c.masque = FALSE AND c.is_digi_employee = FALSE AND e.tier = p_tier
      GROUP BY 1 ORDER BY cnt DESC;
    ELSE
      RETURN QUERY
      SELECT COALESCE(c.niveau_de_relation, 'Non renseigné') AS label, COUNT(*)::BIGINT AS cnt
      FROM contacts c
      WHERE c.masque = FALSE AND c.is_digi_employee = FALSE
      GROUP BY 1 ORDER BY cnt DESC;
    END IF;
  ELSE
    IF p_tier IS NOT NULL THEN
      RETURN QUERY
      SELECT COALESCE(c.persona, 'Non renseigné') AS label, COUNT(*)::BIGINT AS cnt
      FROM contacts c
      JOIN entreprises e ON e.id = c.entreprise_id
      WHERE c.masque = FALSE AND c.is_digi_employee = FALSE AND e.tier = p_tier
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

GRANT EXECUTE ON FUNCTION get_contact_distribution(TEXT, TEXT) TO authenticated;

-- Nb d'entreprises par tier n'ayant aucun contact activé
-- Activé = statut_contact IN ('À contacter','Contacté','Rdv pris','Intéressé')
CREATE OR REPLACE FUNCTION get_activation_entreprise_stats()
RETURNS TABLE (tier TEXT, nb_entreprises BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT e.tier, COUNT(*)::BIGINT AS nb_entreprises
  FROM entreprises e
  WHERE e.tier IN ('Tier 1', 'Tier 2', 'Tier 3', 'Hors-Tier')
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

GRANT EXECUTE ON FUNCTION get_activation_entreprise_stats() TO authenticated;

-- Membres ayant au moins 1 contact (non masqué, non is_digi_employee) mais 0 contact activé
CREATE OR REPLACE FUNCTION get_activation_owner_stats()
RETURNS TABLE (
  membre_id  UUID,
  full_name  TEXT,
  avatar_url TEXT,
  nb_contacts BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id          AS membre_id,
    m.full_name,
    NULL::TEXT    AS avatar_url,
    COUNT(c.id)::BIGINT AS nb_contacts
  FROM membres_digilityx m
  JOIN contacts c ON c.owner_membre_id = m.id
    AND c.masque = FALSE
    AND c.is_digi_employee = FALSE
  WHERE NOT EXISTS (
    SELECT 1 FROM contacts c2
    WHERE c2.owner_membre_id = m.id
      AND c2.masque = FALSE
      AND c2.is_digi_employee = FALSE
      AND c2.statut_contact IN ('À contacter', 'Contacté', 'Rdv pris', 'Intéressé')
  )
  GROUP BY m.id, m.full_name
  ORDER BY nb_contacts DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_activation_owner_stats() TO authenticated;
