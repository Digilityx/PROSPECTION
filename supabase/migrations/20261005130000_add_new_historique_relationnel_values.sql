-- Extend historique_relationnel CHECK constraint to allow 3 new values
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_historique_relationnel_check;

ALTER TABLE contacts ADD CONSTRAINT contacts_historique_relationnel_check
  CHECK (historique_relationnel IN (
    'Jamais contacté',
    'Réservé',
    'Deal en cours',
    'Mission en cours',
    'A recontacter N+1',
    'En attente de retour',
    'Ancien client Digi',
    'Contact non pertinent',
    'A quitté l''entreprise',
    'A changé de poste'
  ));
