-- Add Alexandra Martin to the Pharma/Santé account manager pool
-- alongside François Coulon, Clément Guichard, and Alexandre Koch.

CREATE OR REPLACE FUNCTION auto_assign_account_manager()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ams uuid[];
BEGIN
  IF NEW.account_manager_id IS NOT NULL OR NEW.is_placeholder THEN
    RETURN NEW;
  END IF;

  IF NEW.secteur_digi = 'Pharma/Santé' THEN
    SELECT array_agg(id) INTO ams FROM membres_digilityx
     WHERE full_name IN ('François Coulon', 'Clément Guichard', 'Alexandre Koch', 'Alexandra Martin');
  ELSIF NEW.secteur_digi = 'BAF' AND NEW.company_typology = 'Grand Groupe' THEN
    SELECT array_agg(id) INTO ams FROM membres_digilityx
     WHERE full_name IN ('Julien Bechkri', 'Cindy Renard', 'Emmanuel Utard', 'Clément Maria');
  ELSIF NEW.secteur_digi = 'BAF'
    AND (NEW.company_typology IN ('ETI', 'PME', 'TPE') OR NEW.company_typology IS NULL) THEN
    SELECT array_agg(id) INTO ams FROM membres_digilityx
     WHERE full_name IN ('Christophe Pelletier', 'Yanis Sif');
  END IF;

  IF ams IS NOT NULL AND array_length(ams, 1) > 0 THEN
    NEW.account_manager_id := ams[floor(random() * array_length(ams, 1)) + 1];
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
