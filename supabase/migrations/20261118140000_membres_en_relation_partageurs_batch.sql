-- Remplace get_contact_membres_en_relation (un contact) par une version batch
-- qui n'expose que les membres ACTIFS qui PARTAGENT leurs contacts.
-- SECURITY DEFINER : expose uniquement contact_id, nom et niveau de relation.
DROP FUNCTION IF EXISTS get_contact_membres_en_relation(uuid);

CREATE OR REPLACE FUNCTION get_membres_en_relation_for_contacts(p_contact_ids uuid[])
RETURNS TABLE (contact_id uuid, membre_id uuid, full_name text, niveau_de_relation text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.contact_id, m.id, m.full_name, COALESCE(r.niveau_de_relation, 'Non renseigné')
    FROM contacts_membres_relations r
    JOIN membres_digilityx m ON m.id = r.membre_id
   WHERE r.contact_id = ANY(p_contact_ids)
     AND m.actif = true
     AND m.partager_contacts = true
   ORDER BY r.contact_id,
      CASE COALESCE(r.niveau_de_relation, 'Non renseigné')
        WHEN 'Ami' THEN 1
        WHEN 'Cercle familial' THEN 2
        WHEN 'Partenaire business' THEN 3
        WHEN 'Ancien collègue' THEN 4
        WHEN 'Alumni' THEN 5
        WHEN 'Connaissance' THEN 6
        WHEN 'Inconnu' THEN 7
        ELSE 8 END,
      m.full_name
$$;

REVOKE ALL ON FUNCTION get_membres_en_relation_for_contacts(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_membres_en_relation_for_contacts(uuid[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
