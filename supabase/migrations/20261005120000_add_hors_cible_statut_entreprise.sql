-- Extend statut_entreprise CHECK constraint to allow 'Hors cible'
ALTER TABLE entreprises DROP CONSTRAINT IF EXISTS entreprises_statut_entreprise_check;

ALTER TABLE entreprises ADD CONSTRAINT entreprises_statut_entreprise_check
  CHECK (statut_entreprise IN (
    'À démarcher',
    'Activement démarché',
    'Deal en cours',
    'Devenu client Digileads',
    'Hors cible'
  ));
