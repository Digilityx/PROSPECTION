-- Affiche tous les doublons (même prénom + nom) côte à côte
-- avec mise en évidence des champs qui diffèrent.
-- Colonne "certitude" :
--   🟢 même LinkedIn ID ou même URL → doublon certain
--   🟢 default_profile_url croisé   → Sales Nav vs profil standard, confirmé
--   🟡 à vérifier                   → même nom + même entreprise, à confirmer
-- À lancer dans l'éditeur SQL Supabase.

WITH dupes AS (
  SELECT
    lower(c1.first_name) || ' ' || lower(c1.last_name) AS nom,
    c1.id   AS id1,   c2.id   AS id2,

    -- Identifiants
    c1.linkedin_url         AS url1,       c2.linkedin_url         AS url2,
    c1.id_url_linkedin      AS acw1,       c2.id_url_linkedin      AS acw2,
    c1.default_profile_url  AS dpu1,       c2.default_profile_url  AS dpu2,
    c1.email                AS email1,     c2.email                AS email2,

    -- Qualification
    c1.persona            AS persona1,   c2.persona            AS persona2,
    c1.hierarchie         AS hier1,      c2.hierarchie         AS hier2,
    c1.statut_contact     AS statut1,    c2.statut_contact     AS statut2,
    c1.niveau_de_relation AS relation1,  c2.niveau_de_relation AS relation2,

    -- Entreprise
    c1.company_name       AS company1,   c2.company_name       AS company2,
    c1.entreprise_id      AS ent1,       c2.entreprise_id      AS ent2,

    -- Méta
    c1.scoring            AS score1,     c2.scoring            AS score2,
    c1.contact_digi       AS digi1,      c2.contact_digi       AS digi2,
    c1.created_at         AS created1,   c2.created_at         AS created2

  FROM contacts c1
  JOIN contacts c2 ON (
    lower(COALESCE(c1.first_name, '')) = lower(COALESCE(c2.first_name, ''))
    AND lower(COALESCE(c1.last_name, '')) = lower(COALESCE(c2.last_name, ''))
    AND c1.first_name IS NOT NULL
    AND c1.last_name  IS NOT NULL
    AND c1.id < c2.id  -- évite les doublons de paires
    -- Même entreprise :
    -- Si les deux ont un entreprise_id → doit être le même (fiable, ignore les variantes de texte)
    -- Si au moins un n'a pas d'entreprise_id → on compare le texte company_name
    AND (
      (c1.entreprise_id IS NOT NULL AND c2.entreprise_id IS NOT NULL AND c1.entreprise_id = c2.entreprise_id)
      OR (
        (c1.entreprise_id IS NULL OR c2.entreprise_id IS NULL)
        AND (
          lower(COALESCE(c1.company_name, '')) = lower(COALESCE(c2.company_name, ''))
          OR c1.company_name IS NULL
          OR c2.company_name IS NULL
        )
      )
    )
  )
  WHERE NOT c1.masque AND NOT c2.masque
),
-- Déterminer si default_profile_url croise linkedin_url de l'autre contact
dupes_enriched AS (
  SELECT *,
    -- c1.default_profile_url correspond à linkedin_url de c2 (ou inversement)
    (
      (dpu1 IS NOT NULL AND url2 IS NOT NULL AND lower(dpu1) = lower(url2))
      OR (dpu2 IS NOT NULL AND url1 IS NOT NULL AND lower(dpu2) = lower(url1))
      -- Aussi : extraire le slug de default_profile_url et comparer à id_url_linkedin
      OR (dpu1 IS NOT NULL AND acw2 IS NOT NULL AND lower(dpu1) LIKE '%/in/' || lower(acw2) || '%')
      OR (dpu2 IS NOT NULL AND acw1 IS NOT NULL AND lower(dpu2) LIKE '%/in/' || lower(acw1) || '%')
    ) AS dpu_match
  FROM dupes
)
SELECT
  nom,
  -- Certitude du doublon
  CASE
    WHEN acw1 IS NOT NULL AND acw1 = acw2       THEN '🟢 même LinkedIn ID'
    WHEN url1 IS NOT NULL AND url1 = url2        THEN '🟢 même URL LinkedIn'
    WHEN dpu_match                               THEN '🟢 default_profile_url croisé'
    ELSE '🟡 à vérifier'
  END AS certitude,
  id1, id2,

  -- Conflits qualification (les plus importants)
  CASE WHEN persona1 IS DISTINCT FROM persona2
    THEN '⚠️ ' || COALESCE(persona1, '—') || ' vs ' || COALESCE(persona2, '—')
    ELSE COALESCE(persona1, '—')
  END AS persona,

  CASE WHEN hier1 IS DISTINCT FROM hier2
    THEN '⚠️ ' || COALESCE(hier1, '—') || ' vs ' || COALESCE(hier2, '—')
    ELSE COALESCE(hier1, '—')
  END AS hierarchie,

  CASE WHEN statut1 IS DISTINCT FROM statut2
    THEN '⚠️ ' || COALESCE(statut1, '—') || ' vs ' || COALESCE(statut2, '—')
    ELSE COALESCE(statut1, '—')
  END AS statut_contact,

  CASE WHEN relation1 IS DISTINCT FROM relation2
    THEN '⚠️ ' || COALESCE(relation1, '—') || ' vs ' || COALESCE(relation2, '—')
    ELSE COALESCE(relation1, '—')
  END AS niveau_relation,

  -- Identifiants
  COALESCE(url1, '—')   AS url_1,
  COALESCE(url2, '—')   AS url_2,
  COALESCE(acw1, '—')   AS acw_1,
  COALESCE(acw2, '—')   AS acw_2,
  COALESCE(dpu1, '—')   AS default_url_1,
  COALESCE(dpu2, '—')   AS default_url_2,
  COALESCE(email1, email2, '—') AS email,

  -- Entreprise
  CASE WHEN company1 IS DISTINCT FROM company2
    THEN '⚠️ ' || COALESCE(company1, '—') || ' vs ' || COALESCE(company2, '—')
    ELSE COALESCE(company1, '—')
  END AS entreprise,

  score1, score2,
  created1::date AS cree_le_1,
  created2::date AS cree_le_2

FROM dupes_enriched
ORDER BY
  -- Doublons certains d'abord
  CASE
    WHEN acw1 IS NOT NULL AND acw1 = acw2 THEN 0
    WHEN url1 IS NOT NULL AND url1 = url2  THEN 0
    WHEN dpu_match                         THEN 0
    ELSE 1
  END ASC,
  nom;
