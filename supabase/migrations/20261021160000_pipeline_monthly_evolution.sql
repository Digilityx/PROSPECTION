-- Évolution mensuelle de la pipeline (activité via qualification_logs)
-- Retourne N mois glissants en arrière depuis le mois courant

CREATE OR REPLACE FUNCTION get_pipeline_monthly_evolution(
  p_months INT DEFAULT 6
)
RETURNS TABLE (
  month       TEXT,
  a_contacter BIGINT,
  contactes   BIGINT,
  rdv_pris    BIGINT,
  interesses  BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    to_char(date_trunc('month', ql.created_at), 'YYYY-MM') AS month,
    COUNT(DISTINCT CASE WHEN ql.new_value = 'À contacter' THEN ql.entity_id END)::BIGINT,
    COUNT(DISTINCT CASE WHEN ql.new_value = 'Contacté'    THEN ql.entity_id END)::BIGINT,
    COUNT(DISTINCT CASE WHEN ql.new_value = 'Rdv pris'    THEN ql.entity_id END)::BIGINT,
    COUNT(DISTINCT CASE WHEN ql.new_value = 'Intéressé'   THEN ql.entity_id END)::BIGINT
  FROM qualification_logs ql
  JOIN contacts c ON c.id = ql.entity_id
  WHERE ql.entity_type   = 'contact'
    AND ql.field_changed  = 'statut_contact'
    AND ql.new_value IN ('À contacter', 'Contacté', 'Rdv pris', 'Intéressé')
    AND c.masque           = FALSE
    AND c.is_digi_employee = FALSE
    AND ql.created_at >= date_trunc('month', NOW()) - ((p_months - 1) * interval '1 month')
  GROUP BY 1
  ORDER BY 1;
END;
$$;

GRANT EXECUTE ON FUNCTION get_pipeline_monthly_evolution(INT) TO authenticated;
