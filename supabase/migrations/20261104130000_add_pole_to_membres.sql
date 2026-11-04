-- Pôle d'appartenance d'un membre Digi (1 seul pôle par membre, optionnel)
ALTER TABLE membres_digilityx
  ADD COLUMN IF NOT EXISTS pole text
  CHECK (pole IN ('Associés', 'Design', 'Produit', 'Marketing'));

NOTIFY pgrst, 'reload schema';
