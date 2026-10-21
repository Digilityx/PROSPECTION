-- RPC dashboard pipeline avec filtre de dates (activité via qualification_logs)
-- Sans dates : snapshot des statuts actuels
-- Avec dates : contacts dont le statut a changé vers cette valeur pendant la période

CREATE OR REPLACE FUNCTION get_dashboard_pipeline_activity(
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to   TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  a_contacter  BIGINT,
  contactes    BIGINT,
  rdv_pris     BIGINT,
  interesses   BIGINT,
  pas_interesses BIGINT,
  clients_digi BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_from IS NULL AND p_to IS NULL THEN
    RETURN QUERY
    SELECT
      COUNT(*) FILTER (WHERE statut_contact = 'À contacter')::BIGINT,
      COUNT(*) FILTER (WHERE statut_contact = 'Contacté')::BIGINT,
      COUNT(*) FILTER (WHERE statut_contact = 'Rdv pris')::BIGINT,
      COUNT(*) FILTER (WHERE statut_contact = 'Intéressé')::BIGINT,
      COUNT(*) FILTER (WHERE statut_contact = 'Pas intéressé')::BIGINT,
      COUNT(*) FILTER (WHERE statut_contact = 'Client Digileads')::BIGINT
    FROM contacts
    WHERE masque = FALSE AND is_digi_employee = FALSE;
  ELSE
    RETURN QUERY
    SELECT
      COUNT(DISTINCT CASE WHEN ql.new_value = 'À contacter'    THEN ql.entity_id END)::BIGINT,
      COUNT(DISTINCT CASE WHEN ql.new_value = 'Contacté'       THEN ql.entity_id END)::BIGINT,
      COUNT(DISTINCT CASE WHEN ql.new_value = 'Rdv pris'       THEN ql.entity_id END)::BIGINT,
      COUNT(DISTINCT CASE WHEN ql.new_value = 'Intéressé'      THEN ql.entity_id END)::BIGINT,
      COUNT(DISTINCT CASE WHEN ql.new_value = 'Pas intéressé'  THEN ql.entity_id END)::BIGINT,
      COUNT(DISTINCT CASE WHEN ql.new_value = 'Client Digileads' THEN ql.entity_id END)::BIGINT
    FROM qualification_logs ql
    JOIN contacts c ON c.id = ql.entity_id
    WHERE ql.entity_type = 'contact'
      AND ql.field_changed = 'statut_contact'
      AND c.masque = FALSE
      AND c.is_digi_employee = FALSE
      AND (p_from IS NULL OR ql.created_at >= p_from)
      AND (p_to   IS NULL OR ql.created_at <= p_to);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_pipeline_activity(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
