-- detect-missing-parents.sql
--
-- Détecte les groupes dont plusieurs filiales sont en base mais dont la maison mère
-- est ABSENTE du référentiel. Lecture seule (aucune écriture).
--
-- Heuristique : premier mot du nom (>= 5 car., hors mots génériques) partagé par
-- au moins 2 entreprises non rattachées, sans entreprise dont le nom commence par
-- ce mot ET qui serait elle-même parent (is_parent_entity) ou nommée exactement ainsi.
-- => À REVOIR À LA MAIN : le premier mot ne suffit pas toujours (ex. « Groupe », « Société »).
--
-- Usage :
--  1. Exécuter la requête 1, valider chaque groupe candidat.
--  2. Pour chaque groupe validé, exécuter le bloc 2 (création de la coquille + rattachement),
--     en remplaçant <NOM_GROUPE> et la liste d'ids des filiales.
--  3. Les coquilles apparaissent dans Entreprises → filtre « À enrichir ».

-- ── 1. Candidats ─────────────────────────────────────────────────────────
WITH base AS (
  SELECT id, company_name,
         LOWER(SPLIT_PART(REGEXP_REPLACE(company_name, '^(groupe|group|société|societe|the)\s+', '', 'i'), ' ', 1)) AS first_word
  FROM entreprises
  WHERE parent_company_id IS NULL
    AND NOT is_stub
    AND NOT is_placeholder
    AND company_name ~ ' '
),
groups AS (
  SELECT first_word,
         COUNT(*)                        AS nb_filiales_probables,
         ARRAY_AGG(company_name ORDER BY company_name) AS noms,
         ARRAY_AGG(id ORDER BY company_name)           AS ids
  FROM base
  WHERE LENGTH(first_word) >= 5
    AND first_word NOT IN ('france', 'digital', 'consulting', 'conseil', 'services', 'solutions',
                           'international', 'technologies', 'europe', 'global', 'institut',
                           'association', 'ministère', 'ministere', 'agence', 'cabinet')
  GROUP BY first_word
  HAVING COUNT(*) >= 2
)
SELECT g.first_word,
       -- 'a_creer'     : aucune ligne ne porte le nom du groupe        -> coquille (cas B)
       -- 'a_flaguer'   : une ligne porte le nom du groupe mais n'est pas flaguée mère -> cas A
       --                 (ex. Volkswagen, McCann : la mère existe, ses filiales ne lui sont pas rattachées)
       CASE WHEN ex.nb_exactes = 0 THEN 'a_creer' ELSE 'a_flaguer' END AS cas,
       g.nb_filiales_probables, g.noms, g.ids, ex.ids_exactes
FROM groups g
CROSS JOIN LATERAL (
  SELECT COUNT(*) AS nb_exactes, ARRAY_AGG(p.id) AS ids_exactes
  FROM entreprises p
  WHERE LOWER(p.company_name) IN (g.first_word, 'groupe ' || g.first_word, g.first_word || ' group')
) ex
WHERE NOT EXISTS (
  -- mère déjà flaguée avec ce préfixe : traitée par detect-parent-subsidiaries.sql
  SELECT 1 FROM entreprises p
  WHERE p.is_parent_entity AND LOWER(p.company_name) LIKE g.first_word || '%'
)
ORDER BY cas, g.nb_filiales_probables DESC;

-- LIMITE : cette requête ne voit que les filiales dont le nom commence par celui du groupe.
-- Les marques au nom différent (Audi, Porsche, Škoda, Scania sous Volkswagen ; BSH sous Bosch ;
-- FCB, Weber Shandwick sous IPG...) demandent un dictionnaire marque -> groupe, voir le point 4.

-- ── 2. Création d'une coquille + rattachement (à adapter, groupe par groupe) ──
-- Garde-fou : ne créer une coquille que si >= 2 filiales à rattacher.
--
-- WITH new_parent AS (
--   INSERT INTO entreprises (company_name, is_stub, is_parent_entity, company_typology, source_acquisition)
--   VALUES ('<NOM_GROUPE>', TRUE, TRUE, 'Grand Groupe', 'reference_groupe')
--   RETURNING id
-- )
-- UPDATE entreprises e
-- SET parent_company_id = (SELECT id FROM new_parent),
--     is_subsidiary     = TRUE
-- WHERE e.id IN ('<uuid-filiale-1>', '<uuid-filiale-2>');
--
-- Note : le trigger tier mettra la coquille en 'Hors-Tier' (typologie ou secteur NULL) ;
-- c'est sans effet puisque toutes les stats et listes excluent is_stub.

-- ── 3. Vérifications post-création ───────────────────────────────────────
-- Coquilles sans aucune filiale (à supprimer) :
-- SELECT s.id, s.company_name FROM entreprises s
-- WHERE s.is_stub AND NOT EXISTS (SELECT 1 FROM entreprises f WHERE f.parent_company_id = s.id);
--
-- Coquilles qui ont reçu de vraies données / des contacts (à promouvoir : is_stub = FALSE) :
-- SELECT s.id, s.company_name, s.company_id_linkedin, s.secteur_digi,
--        (SELECT COUNT(*) FROM contacts c WHERE c.entreprise_id = s.id) AS nb_contacts
-- FROM entreprises s
-- WHERE s.is_stub AND (s.company_id_linkedin IS NOT NULL OR s.secteur_digi IS NOT NULL
--       OR EXISTS (SELECT 1 FROM contacts c WHERE c.entreprise_id = s.id));
