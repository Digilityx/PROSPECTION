-- Liste des membres Digi (actifs) en relation avec un contact, avec leur niveau de relation.
-- SECURITY DEFINER : un membre ne voit normalement que ses propres lignes de
-- contacts_membres_relations (RLS) ; cette RPC expose uniquement nom + niveau.
CREATE OR REPLACE FUNCTION get_contact_membres_en_relation(p_contact_id uuid)
RETURNS TABLE (membre_id uuid, full_name text, niveau_de_relation text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.full_name, COALESCE(r.niveau_de_relation, 'Non renseigné')
    FROM contacts_membres_relations r
    JOIN membres_digilityx m ON m.id = r.membre_id
   WHERE r.contact_id = p_contact_id
     AND m.actif = true
   ORDER BY CASE COALESCE(r.niveau_de_relation, 'Non renseigné')
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

REVOKE ALL ON FUNCTION get_contact_membres_en_relation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_contact_membres_en_relation(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
