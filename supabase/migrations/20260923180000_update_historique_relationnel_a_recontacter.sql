-- Rename 'A recontacter' to 'A recontacter N+1' in historique_relationnel

-- Drop existing CHECK constraint
DO $$
DECLARE
  v_constraint text;
BEGIN
  SELECT conname INTO v_constraint
  FROM pg_constraint
  WHERE conrelid = 'contacts'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%historique_relationnel%';

  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE contacts DROP CONSTRAINT %I', v_constraint);
  END IF;
END $$;

-- Migrate existing values
UPDATE contacts SET historique_relationnel = 'A recontacter N+1' WHERE historique_relationnel = 'A recontacter';

-- Add updated CHECK constraint
ALTER TABLE contacts
  ADD CONSTRAINT contacts_historique_relationnel_check
  CHECK (historique_relationnel IN (
    'Jamais contacté',
    'Réservé',
    'Deal en cours',
    'Mission en cours',
    'A recontacter N+1',
    'En attente de retour',
    'Ancien client Digi'
  ));
