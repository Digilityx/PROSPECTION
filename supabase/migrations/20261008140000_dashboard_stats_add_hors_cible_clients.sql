-- Étend get_dashboard_stats() avec :
--   hors_cible              : nb d'entreprises marquées hors_cible = true
--   clients_digileads       : nb d'entreprises dont statut_entreprise = 'Devenu client Digileads'
--   contacts_interesses     : nb de contacts avec statut_contact = 'Intéressé'
--   contacts_clients_digi   : nb de contacts avec statut_contact = 'Client Digileads'

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
AS $$
  SELECT
    (SELECT COUNT(*) FROM entreprises),
    (SELECT COUNT(*) FROM contacts),
    (SELECT COUNT(*) FROM notifications),
    (SELECT COUNT(*) FROM contacts    WHERE statut_contact = 'À contacter'),
    (SELECT COUNT(*) FROM contacts    WHERE statut_contact = 'Contacté'),
    (SELECT COUNT(*) FROM entreprises WHERE tier = 'Tier 1'),
    (SELECT COUNT(*) FROM entreprises WHERE tier = 'Tier 2'),
    (SELECT COUNT(*) FROM entreprises WHERE tier = 'Tier 3'),
    (SELECT COUNT(*) FROM entreprises WHERE hors_cible = true),
    (SELECT COUNT(*) FROM entreprises WHERE statut_entreprise = 'Devenu client Digileads'),
    (SELECT COUNT(*) FROM contacts    WHERE statut_contact = 'Intéressé'),
    (SELECT COUNT(*) FROM contacts    WHERE statut_contact = 'Client Digileads');
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_stats() TO authenticated, anon;
