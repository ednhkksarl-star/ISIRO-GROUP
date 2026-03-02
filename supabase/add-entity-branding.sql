-- ============================================
-- Add branding fields to entities table
-- ============================================

-- Add branding columns
ALTER TABLE entities
ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE entities
ADD COLUMN IF NOT EXISTS header_url TEXT;
ALTER TABLE entities
ADD COLUMN IF NOT EXISTS watermark_url TEXT;
ALTER TABLE entities
ADD COLUMN IF NOT EXISTS footer_text TEXT;
ALTER TABLE entities
ADD COLUMN IF NOT EXISTS office_address TEXT;
ALTER TABLE entities
ADD COLUMN IF NOT EXISTS contacts TEXT; -- JSONB or TEXT for phone, email, etc.

-- Add comments
COMMENT ON COLUMN entities.logo_url IS 'URL du logo de l''entité';
COMMENT ON COLUMN entities.header_url IS 'URL de l''en-tête de l''entité';
COMMENT ON COLUMN entities.watermark_url IS 'URL du filigrane (logo) de l''entité';
COMMENT ON COLUMN entities.footer_text IS 'Texte du footer avec adresse et contacts';
COMMENT ON COLUMN entities.office_address IS 'Adresse complète du bureau';
COMMENT ON COLUMN entities.contacts IS 'Contacts (téléphone, email, etc.) - format JSON ou texte';

