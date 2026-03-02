-- ============================================
-- Add new fields to mail_items table
-- ============================================

-- Add reference number from sender
ALTER TABLE mail_items
ADD COLUMN IF NOT EXISTS sender_reference_number VARCHAR(100);

-- Add our registration/acknowledgment number
ALTER TABLE mail_items
ADD COLUMN IF NOT EXISTS registration_number VARCHAR(100);

-- Add orientation fields
ALTER TABLE mail_items
ADD COLUMN IF NOT EXISTS oriented_to_entity_id UUID REFERENCES entities(id) ON DELETE SET NULL;
ALTER TABLE mail_items
ADD COLUMN IF NOT EXISTS oriented_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add file attachment (URL to uploaded file)
ALTER TABLE mail_items
ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE mail_items
ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255);

-- Add comments
COMMENT ON COLUMN mail_items.sender_reference_number IS 'Numéro de référence de l''expéditeur';
COMMENT ON COLUMN mail_items.registration_number IS 'Notre numéro d''enregistrement d''accusé de réception';
COMMENT ON COLUMN mail_items.oriented_to_entity_id IS 'Entité vers laquelle le courrier est orienté';
COMMENT ON COLUMN mail_items.oriented_to_user_id IS 'Agent vers lequel le courrier est orienté';
COMMENT ON COLUMN mail_items.attachment_url IS 'URL du fichier uploadé (PDF, JPG)';
COMMENT ON COLUMN mail_items.attachment_name IS 'Nom du fichier uploadé';

