-- ============================================
-- Refactor Accounting Entries Table
-- Change from debit/credit to entrees/sorties
-- Add code and numero_piece columns
-- ============================================

-- Add new columns
ALTER TABLE accounting_entries
ADD COLUMN IF NOT EXISTS code VARCHAR(50),
ADD COLUMN IF NOT EXISTS numero_piece VARCHAR(100);

-- Migrate existing data: debit -> entrees, credit -> sorties
-- We'll keep debit/credit for now and add entrees/sorties
ALTER TABLE accounting_entries
ADD COLUMN IF NOT EXISTS entrees DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS sorties DECIMAL(10,2) DEFAULT 0;

-- Migrate data: debit becomes entrees, credit becomes sorties
UPDATE accounting_entries
SET entrees = COALESCE(debit, 0),
    sorties = COALESCE(credit, 0)
WHERE entrees = 0 AND sorties = 0;

-- Make entrees and sorties NOT NULL after migration
ALTER TABLE accounting_entries
ALTER COLUMN entrees SET NOT NULL,
ALTER COLUMN sorties SET NOT NULL;

-- Add comments
COMMENT ON COLUMN accounting_entries.code IS 'Code comptable';
COMMENT ON COLUMN accounting_entries.numero_piece IS 'Numéro de pièce justificative';
COMMENT ON COLUMN accounting_entries.entrees IS 'Montant des entrées (recettes)';
COMMENT ON COLUMN accounting_entries.sorties IS 'Montant des sorties (dépenses)';

