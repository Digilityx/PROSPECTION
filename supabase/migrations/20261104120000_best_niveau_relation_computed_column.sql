-- Colonne calculée en lecture seule : plus haut niveau de relation d'un contact
-- parmi tous les membres liés. Ne modifie AUCUNE donnée (ni niveau_de_relation, ni scoring).
-- Utilisable via PostgREST : .eq('best_niveau_relation', 'Ami')
CREATE OR REPLACE FUNCTION best_niveau_relation(c contacts) RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (SELECT COALESCE(r.niveau_de_relation, 'Non renseigné')
       FROM contacts_membres_relations r
      WHERE r.contact_id = c.id
      ORDER BY CASE COALESCE(r.niveau_de_relation, 'Non renseigné')
        WHEN 'Ami' THEN 1
        WHEN 'Cercle familial' THEN 2
        WHEN 'Partenaire business' THEN 3
        WHEN 'Ancien collègue' THEN 4
        WHEN 'Alumni' THEN 5
        WHEN 'Connaissance' THEN 6
        WHEN 'Inconnu' THEN 7
        ELSE 8 END
      LIMIT 1),
    'Non renseigné')
$$;

NOTIFY pgrst, 'reload schema';
