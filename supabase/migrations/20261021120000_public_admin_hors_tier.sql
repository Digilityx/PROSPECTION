-- Public & Administrations passe en Hors-Tier (même logique que Concurrent)
-- Mise à jour du trigger compute_entreprise_tier_icp en cohérence avec compute-tier.ts

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
     OR NEW.secteur_digi IN ('Concurrent', 'Public & Administrations') THEN
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

-- Recalcul immédiat des entreprises Public & Administrations existantes
UPDATE entreprises
SET secteur_digi = secteur_digi
WHERE secteur_digi = 'Public & Administrations'
  AND hors_cible = FALSE;
