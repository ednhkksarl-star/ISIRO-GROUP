-- Ajouter la colonne currency aux tables invoices, expenses, et accounting_entries

-- Table invoices
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'USD' CHECK (currency IN ('USD', 'CDF'));

-- Table expenses
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'USD' CHECK (currency IN ('USD', 'CDF'));

-- Table accounting_entries
ALTER TABLE accounting_entries 
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'USD' CHECK (currency IN ('USD', 'CDF'));

-- Commentaires
COMMENT ON COLUMN invoices.currency IS 'Devise de la facture (USD ou CDF)';
COMMENT ON COLUMN expenses.currency IS 'Devise de la dépense (USD ou CDF)';
COMMENT ON COLUMN accounting_entries.currency IS 'Devise de l''écriture comptable (USD ou CDF)';

