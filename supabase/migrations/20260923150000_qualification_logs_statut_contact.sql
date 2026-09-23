-- Create qualification_logs table to track field changes on contacts and entreprises
CREATE TABLE IF NOT EXISTS qualification_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('contact', 'entreprise')),
  entity_id   UUID NOT NULL,
  field_changed TEXT,
  old_value   TEXT,
  new_value   TEXT,
  source      TEXT CHECK (source IN ('manual', 'llm', 'phantombuster', 'import', 'trigger')),
  metadata    JSONB,
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS qualification_logs_entity_idx
  ON qualification_logs (entity_type, entity_id, created_at DESC);

-- Trigger function: log statut_contact changes on contacts
CREATE OR REPLACE FUNCTION log_statut_contact_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.statut_contact IS DISTINCT FROM NEW.statut_contact THEN
    INSERT INTO qualification_logs (entity_type, entity_id, field_changed, old_value, new_value, source)
    VALUES ('contact', NEW.id, 'statut_contact', OLD.statut_contact, NEW.statut_contact, 'manual');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_statut_contact_change
  AFTER UPDATE OF statut_contact ON contacts
  FOR EACH ROW EXECUTE FUNCTION log_statut_contact_change();
