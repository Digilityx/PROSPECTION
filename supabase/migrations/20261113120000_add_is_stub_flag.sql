-- Entreprises « coquilles » (is_stub) : maisons mères absentes du référentiel,
-- créées uniquement pour pouvoir rattacher leurs filiales (parent_company_id).
-- Une coquille n'a pas de données réelles : elle doit être exclue des stats,
-- de l'auto-affectation AM et des listes d'activation.
-- Quand la vraie entreprise est importée/enrichie, la coquille est complétée
-- puis is_stub repasse à FALSE (pas de doublon).
--
-- Migration additive : aucune ligne existante n'est modifiée (DEFAULT FALSE).

ALTER TABLE entreprises
  ADD COLUMN IF NOT EXISTS is_stub BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_entreprises_is_stub
  ON entreprises(is_stub) WHERE is_stub;

-- ── Auto-affectation AM : ignorer les coquilles ───────────────────────────
CREATE OR REPLACE FUNCTION auto_assign_account_manager()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ams uuid[];
BEGIN
  IF NEW.account_manager_id IS NOT NULL OR NEW.is_placeholder OR NEW.is_stub THEN
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

-- ── Stats dashboard : exclure les coquilles des compteurs d'entreprises ───
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS TABLE(
  total_entreprises        bigint,
  total_contacts           bigint,
  total_notifications      bigint,
  contacts_a_contacter     bigint,
  contacts_contactes       bigint,
  tier1                    bigint,
  tier2                    bigint,
  tier3                    bigint,
  hors_cible               bigint,
  clients_digileads        bigint,
  contacts_interesses      bigint,
  contacts_clients_digi    bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT
    (SELECT COUNT(*) FROM entreprises WHERE NOT is_stub),
    (SELECT COUNT(*) FROM contacts),
    (SELECT COUNT(*) FROM notifications),
    (SELECT COUNT(*) FROM contacts    WHERE statut_contact = 'À contacter'),
    (SELECT COUNT(*) FROM contacts    WHERE statut_contact = 'Contacté'),
    (SELECT COUNT(*) FROM entreprises WHERE NOT is_stub AND tier = 'Tier 1'),
    (SELECT COUNT(*) FROM entreprises WHERE NOT is_stub AND tier = 'Tier 2'),
    (SELECT COUNT(*) FROM entreprises WHERE NOT is_stub AND tier = 'Tier 3'),
    (SELECT COUNT(*) FROM entreprises WHERE NOT is_stub AND hors_cible = true),
    (SELECT COUNT(*) FROM entreprises WHERE NOT is_stub AND statut_entreprise = 'Devenu client Digileads'),
    (SELECT COUNT(*) FROM contacts    WHERE statut_contact = 'Intéressé'),
    (SELECT COUNT(*) FROM contacts    WHERE statut_contact = 'Client Digileads');
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_stats() TO authenticated, anon;

-- ── Stats par secteur ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_secteur_stats()
RETURNS TABLE(secteur_digi text, count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(secteur_digi, 'Non classé') AS secteur_digi,
         COUNT(*)::bigint                     AS count
  FROM entreprises
  WHERE NOT is_stub
  GROUP BY COALESCE(secteur_digi, 'Non classé')
  ORDER BY count DESC;
$$;

GRANT EXECUTE ON FUNCTION get_secteur_stats() TO authenticated, anon;

-- ── Activation : entreprises sans contact activé ─────────────────────────
CREATE OR REPLACE FUNCTION get_activation_entreprise_stats(
  p_secteurs TEXT[] DEFAULT NULL
)
RETURNS TABLE (tier TEXT, nb_entreprises BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT e.tier, COUNT(*)::BIGINT AS nb_entreprises
  FROM entreprises e
  WHERE NOT e.is_stub
    AND e.tier IN ('Tier 1', 'Tier 2', 'Tier 3', 'Hors-Tier')
    AND (p_secteurs IS NULL OR array_length(p_secteurs, 1) = 0 OR e.secteur_digi = ANY(p_secteurs))
    AND NOT EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.entreprise_id = e.id
        AND c.masque = FALSE
        AND c.is_digi_employee = FALSE
        AND c.contact_digi = FALSE
        AND c.statut_contact IN ('À contacter', 'Contacté', 'Rdv pris', 'Intéressé')
    )
  GROUP BY e.tier
  ORDER BY e.tier;
END;
$$;

GRANT EXECUTE ON FUNCTION get_activation_entreprise_stats(TEXT[]) TO authenticated;

CREATE OR REPLACE FUNCTION get_activation_entreprise_list(
  p_secteurs TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id            UUID,
  company_name  TEXT,
  tier          TEXT,
  secteur_digi  TEXT,
  nb_contacts   BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.company_name,
    e.tier,
    e.secteur_digi,
    COUNT(c.id)::BIGINT AS nb_contacts
  FROM entreprises e
  LEFT JOIN contacts c ON c.entreprise_id = e.id
    AND c.masque = FALSE
    AND c.is_digi_employee = FALSE
  WHERE NOT e.is_stub
    AND e.tier IN ('Tier 1', 'Tier 2', 'Tier 3', 'Hors-Tier')
    AND (p_secteurs IS NULL OR array_length(p_secteurs, 1) = 0 OR e.secteur_digi = ANY(p_secteurs))
    AND NOT EXISTS (
      SELECT 1 FROM contacts c2
      WHERE c2.entreprise_id = e.id
        AND c2.masque = FALSE
        AND c2.is_digi_employee = FALSE
        AND c2.contact_digi = FALSE
        AND c2.statut_contact IN ('À contacter', 'Contacté', 'Rdv pris', 'Intéressé')
    )
  GROUP BY e.id, e.company_name, e.tier, e.secteur_digi
  ORDER BY
    CASE e.tier
      WHEN 'Tier 1' THEN 1
      WHEN 'Tier 2' THEN 2
      WHEN 'Tier 3' THEN 3
      ELSE 4
    END,
    e.company_name;
END;
$$;

GRANT EXECUTE ON FUNCTION get_activation_entreprise_list(TEXT[]) TO authenticated;
