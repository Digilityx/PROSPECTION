-- Ajoute un filtre optionnel par plage de dates sur get_owner_contact_stats
-- La date de référence est la dernière fois que statut_contact a été changé
-- vers sa valeur actuelle (depuis qualification_logs).
-- Sans paramètre → comportement identique à avant.

CREATE OR REPLACE FUNCTION get_owner_contact_stats(
  p_from timestamptz DEFAULT NULL,
  p_to   timestamptz DEFAULT NULL
)
RETURNS TABLE(owner_membre_id uuid, statut_contact text, cnt int)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    c.owner_membre_id,
    c.statut_contact,
    COUNT(*)::int AS cnt
  FROM contacts c
  LEFT JOIN LATERAL (
    SELECT ql.created_at
    FROM qualification_logs ql
    WHERE ql.entity_type = 'contact'
      AND ql.entity_id = c.id
      AND ql.field_changed = 'statut_contact'
      AND ql.new_value = c.statut_contact
    ORDER BY ql.created_at DESC
    LIMIT 1
  ) last_change ON true
  WHERE c.owner_membre_id IS NOT NULL
    AND c.masque = false
    AND c.is_digi_employee = false
    AND (p_from IS NULL OR last_change.created_at >= p_from)
    AND (p_to   IS NULL OR last_change.created_at <  p_to)
  GROUP BY c.owner_membre_id, c.statut_contact
$$;
