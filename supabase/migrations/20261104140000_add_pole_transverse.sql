-- Ajoute le pôle « Transverse » aux pôles autorisés des membres Digi
ALTER TABLE membres_digilityx DROP CONSTRAINT IF EXISTS membres_digilityx_pole_check;
ALTER TABLE membres_digilityx
  ADD CONSTRAINT membres_digilityx_pole_check
  CHECK (pole IN ('Associés', 'Design', 'Produit', 'Marketing', 'Transverse'));

NOTIFY pgrst, 'reload schema';
