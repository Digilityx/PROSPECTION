-- Ajoute la catégorie "Hors cible" comme valeur de tier, positionnable manuellement.
-- Un flag booléen hors_cible sur entreprises permet de figer le tier à 'Hors cible'
-- indépendamment du calcul automatique typology+secteur.

ALTER TABLE entreprises
  ADD COLUMN IF NOT EXISTS hors_cible BOOLEAN NOT NULL DEFAULT FALSE;

-- Élargit la contrainte CHECK sur tier pour accepter 'Hors cible'.
-- Le nom de contrainte peut varier selon l'init Supabase — on tente les deux noms courants.
ALTER TABLE entreprises DROP CONSTRAINT IF EXISTS entreprises_tier_check;
ALTER TABLE entreprises DROP CONSTRAINT IF EXISTS tier_check;
ALTER TABLE entreprises ADD CONSTRAINT entreprises_tier_check
  CHECK (tier IN ('Tier 1', 'Tier 2', 'Tier 3', 'Hors-Tier', 'Hors cible'));

-- Mise à jour du trigger : si hors_cible = true, tier = 'Hors cible' et on court-circuite
-- le calcul automatique.
CREATE OR REPLACE FUNCTION compute_entreprise_tier_icp()
RETURNS TRIGGER AS $$
BEGIN
  -- Priorité au flag manuel
  IF NEW.hors_cible = TRUE THEN
    NEW.tier := 'Hors cible';
    NEW.icp  := FALSE;
    RETURN NEW;
  END IF;

  IF NEW.company_typology IS NULL
     OR NEW.company_typology IN ('TPE', 'Startup')
     OR NEW.secteur_digi = 'Concurrent' THEN
    NEW.tier := 'Hors-Tier';
    NEW.icp  := FALSE;
  ELSIF NEW.secteur_digi IS NULL THEN
    NEW.tier := 'Tier 3';
    NEW.icp  := FALSE;
  ELSIF NEW.secteur_digi IN ('Pharma/Santé', 'BAF') THEN
    NEW.tier := 'Tier 1';
    NEW.icp  := TRUE;
  ELSE
    NEW.tier := 'Tier 2';
    NEW.icp  := TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Le trigger existant couvre déjà INSERT/UPDATE OF company_typology, secteur_digi.
-- On le recrée pour inclure hors_cible dans la liste des colonnes surveillées.
DROP TRIGGER IF EXISTS trigger_entreprises_tier_icp ON entreprises;
CREATE TRIGGER trigger_entreprises_tier_icp
  BEFORE INSERT OR UPDATE OF company_typology, secteur_digi, hors_cible
  ON entreprises
  FOR EACH ROW
  EXECUTE FUNCTION compute_entreprise_tier_icp();
