-- Signal d'affaire : 1 lien Google Doc par entreprise, 1 par contact.
-- Édition réservée aux admins (trigger) ; lecture via les RLS existantes.

ALTER TABLE entreprises
  ADD COLUMN IF NOT EXISTS google_doc_url text
  CHECK (google_doc_url IS NULL OR google_doc_url ~* '^https://(docs|drive)\.google\.com/');

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS google_doc_url text
  CHECK (google_doc_url IS NULL OR google_doc_url ~* '^https://(docs|drive)\.google\.com/');

-- Seuls les admins connectés peuvent modifier google_doc_url.
-- auth.uid() NULL = service role / SQL editor / scripts : autorisé.
CREATE OR REPLACE FUNCTION restrict_google_doc_url_to_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.google_doc_url IS DISTINCT FROM
     (CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.google_doc_url END)
     AND auth.uid() IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM membres_digilityx
       WHERE auth_user_id = auth.uid() AND role = 'admin'
     )
  THEN
    RAISE EXCEPTION 'Seuls les admins peuvent modifier le lien Google Doc';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_google_doc_url ON entreprises;
CREATE TRIGGER trg_restrict_google_doc_url
  BEFORE INSERT OR UPDATE OF google_doc_url ON entreprises
  FOR EACH ROW EXECUTE FUNCTION restrict_google_doc_url_to_admin();

DROP TRIGGER IF EXISTS trg_restrict_google_doc_url ON contacts;
CREATE TRIGGER trg_restrict_google_doc_url
  BEFORE INSERT OR UPDATE OF google_doc_url ON contacts
  FOR EACH ROW EXECUTE FUNCTION restrict_google_doc_url_to_admin();

NOTIFY pgrst, 'reload schema';
