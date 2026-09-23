-- Add 'Sélectionné' to statut_contact allowed values
-- Drop existing CHECK constraint on statut_contact (whatever its name)
DO $$
DECLARE
  v_constraint text;
BEGIN
  SELECT conname INTO v_constraint
  FROM pg_constraint
  WHERE conrelid = 'contacts'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%statut_contact%';

  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE contacts DROP CONSTRAINT %I', v_constraint);
  END IF;
END $$;

ALTER TABLE contacts
  ADD CONSTRAINT contacts_statut_contact_check
  CHECK (statut_contact IN (
    'Sélectionné',
    'À contacter',
    'Contacté',
    'Intéressé',
    'Pas intéressé',
    'Client'
  ));
