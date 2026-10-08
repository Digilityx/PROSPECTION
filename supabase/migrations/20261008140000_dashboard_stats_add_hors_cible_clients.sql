-- Étend get_dashboard_stats() avec :
--   hors_cible       : nb d'entreprises marquées hors_cible = true (tier forcé 'Hors cible')
--   clients_digileads: nb d'entreprises dont statut_entreprise = 'Devenu client Digileads'
-- Note : deals_en_cours compte désormais les contacts avec historique_relationnel = 'Deal en cours'
--        (statut_entreprise 'Deal en cours' supprimé par migration 20261008120000)

CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS TABLE(
  total_entreprises      bigint,
  total_contacts         bigint,
  total_notifications    bigint,
  deals_en_cours         bigint,
  contacts_a_contacter   bigint,
  contacts_contactes     bigint,
  tier1                  bigint,
  tier2                  bigint,
  tier3                  bigint,
  hors_cible             bigint,
  clients_digileads      bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    (SELECT COUNT(*) FROM entreprises),
    (SELECT COUNT(*) FROM contacts),
    (SELECT COUNT(*) FROM notifications),
    (SELECT COUNT(*) FROM contacts    WHERE historique_relationnel = 'Deal en cours'),
    (SELECT COUNT(*) FROM contacts    WHERE statut_contact    = 'À contacter'),
    (SELECT COUNT(*) FROM contacts    WHERE statut_contact    = 'Contacté'),
    (SELECT COUNT(*) FROM entreprises WHERE tier = 'Tier 1'),
    (SELECT COUNT(*) FROM entreprises WHERE tier = 'Tier 2'),
    (SELECT COUNT(*) FROM entreprises WHERE tier = 'Tier 3'),
    (SELECT COUNT(*) FROM entreprises WHERE hors_cible = true),
    (SELECT COUNT(*) FROM entreprises WHERE statut_entreprise = 'Devenu client Digileads');
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_stats() TO authenticated, anon;
