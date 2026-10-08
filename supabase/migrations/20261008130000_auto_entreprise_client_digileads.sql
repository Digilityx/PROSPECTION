-- Quand un contact passe à statut_contact = 'Client Digileads',
-- son entreprise rattachée devient automatiquement 'Devenu client Digileads'.
-- Irréversible : ne se déclenche pas si l'entreprise est déjà à cette valeur.
-- Trace dans qualification_logs : entity_type='entreprise', field_changed='statut_entreprise',
-- metadata contient contact_id pour l'historique.

CREATE OR REPLACE FUNCTION sync_entreprise_client_digileads()
RETURNS TRIGGER AS $$
DECLARE
  v_old_statut TEXT;
BEGIN
  -- Seulement quand le contact passe à 'Client Digileads'
  IF NEW.statut_contact IS DISTINCT FROM 'Client Digileads' THEN
    RETURN NEW;
  END IF;
  -- Seulement si le contact est rattaché à une entreprise
  IF NEW.entreprise_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Récupérer le statut actuel de l'entreprise
  SELECT statut_entreprise INTO v_old_statut
  FROM entreprises
  WHERE id = NEW.entreprise_id;

  -- Ne rien faire si l'entreprise est déjà cliente
  IF v_old_statut = 'Devenu client Digileads' THEN
    RETURN NEW;
  END IF;

  -- Mettre à jour l'entreprise
  UPDATE entreprises
  SET statut_entreprise = 'Devenu client Digileads'
  WHERE id = NEW.entreprise_id;

  -- Logger dans qualification_logs
  INSERT INTO qualification_logs (
    entity_type, entity_id, field_changed,
    old_value, new_value, source, metadata, created_at
  ) VALUES (
    'entreprise',
    NEW.entreprise_id,
    'statut_entreprise',
    v_old_statut,
    'Devenu client Digileads',
    'trigger',
    jsonb_build_object('contact_id', NEW.id, 'contact_name', NEW.full_name),
    now()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_contact_client_digileads ON contacts;
CREATE TRIGGER trg_contact_client_digileads
  AFTER UPDATE OF statut_contact
  ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION sync_entreprise_client_digileads();
