-- Replace 'Client' with 'Client à date' and add 'Client Digileads' in statut_contact

-- Drop existing CHECK constraint FIRST (before updating values)
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

-- Migrate existing 'Client' values to 'Client à date'
UPDATE contacts SET statut_contact = 'Client à date' WHERE statut_contact = 'Client';

-- Add updated CHECK constraint
ALTER TABLE contacts
  ADD CONSTRAINT contacts_statut_contact_check
  CHECK (statut_contact IN (
    'Sélectionné',
    'À contacter',
    'Contacté',
    'Intéressé',
    'Pas intéressé',
    'Client à date',
    'Client Digileads'
  ));
