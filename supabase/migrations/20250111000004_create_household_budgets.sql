-- Migration: Création de la table household_budgets pour gérer les budgets mensuels
-- Date: 2025-01-11

-- Table pour stocker les budgets mensuels par utilisateur
CREATE TABLE IF NOT EXISTS household_budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  budget_month INTEGER NOT NULL CHECK (budget_month >= 1 AND budget_month <= 12),
  budget_year INTEGER NOT NULL CHECK (budget_year >= 2020),
  budget_amount DECIMAL(10,2) NOT NULL CHECK (budget_amount >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, budget_month, budget_year)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_household_budgets_user_id ON household_budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_household_budgets_month_year ON household_budgets(budget_year, budget_month);

-- Enable RLS
ALTER TABLE household_budgets ENABLE ROW LEVEL SECURITY;

-- RLS Policies pour household_budgets
-- Les utilisateurs peuvent voir et gérer leurs propres budgets
CREATE POLICY "Users can view their own budgets"
  ON household_budgets FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own budgets"
  ON household_budgets FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own budgets"
  ON household_budgets FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own budgets"
  ON household_budgets FOR DELETE
  USING (user_id = auth.uid());

-- Les super admins peuvent voir et gérer tous les budgets
CREATE POLICY "Super admin can manage all budgets"
  ON household_budgets FOR ALL
  USING (get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP');

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_household_budgets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_household_budgets_updated_at
  BEFORE UPDATE ON household_budgets
  FOR EACH ROW
  EXECUTE FUNCTION update_household_budgets_updated_at();

