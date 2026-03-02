-- ============================================
-- Add additional taxes support to invoices
-- ============================================

-- Add column for additional taxes (JSONB array)
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS additional_taxes JSONB DEFAULT '[]'::jsonb;

-- Add reference_type and reference_id columns
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS reference_type VARCHAR(100);
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS reference_id VARCHAR(100);

-- Add comments
COMMENT ON COLUMN invoices.additional_taxes IS 'Array of additional taxes: [{"name": "Tax Name", "rate": 5.5}]';
COMMENT ON COLUMN invoices.reference_type IS 'Type de référence (saisie manuelle)';
COMMENT ON COLUMN invoices.reference_id IS 'ID de référence (généré automatiquement)';

-- Update existing invoices to have TVA at 16%
UPDATE invoices SET tax_rate = 16 WHERE tax_rate = 0 OR tax_rate IS NULL;

