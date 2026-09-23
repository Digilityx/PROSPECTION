-- Add historique_relationnel column to contacts
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS historique_relationnel TEXT
  CHECK (historique_relationnel IN (
    'Jamais contacté',
    'Réservé',
    'Deal en cours',
    'Mission en cours',
    'A recontacter',
    'En attente de retour',
    'Ancien client Digi'
  ));
