-- Simplifie statut_entreprise : seul 'Devenu client Digileads' reste valide.
-- Les statuts 'À démarcher', 'Activement démarché', 'Deal en cours' et 'Hors cible'
-- sont retirés (Hors cible est désormais géré par le tier via hors_cible = true).

-- Remettre à NULL les lignes avec un statut supprimé
UPDATE entreprises
SET statut_entreprise = NULL
WHERE statut_entreprise IN (
  'À démarcher',
  'Activement démarché',
  'Deal en cours',
  'Hors cible'
);

-- Resserrer la contrainte CHECK
ALTER TABLE entreprises DROP CONSTRAINT IF EXISTS entreprises_statut_entreprise_check;
ALTER TABLE entreprises ADD CONSTRAINT entreprises_statut_entreprise_check
  CHECK (statut_entreprise IN ('Devenu client Digileads'));
