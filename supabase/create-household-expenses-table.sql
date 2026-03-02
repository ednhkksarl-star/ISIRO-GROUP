-- Migration: Créer la table household_expenses pour le module MENAGE
-- Date: 2026-01-10
-- Description: Table pour gérer les dépenses personnelles du super admin
--              (Abonnements, Loyer, Salaire travailleurs, Entretien, etc.)

-- ============================================
-- CRÉER LE TYPE ENUM POUR LES CATÉGORIES
-- ============================================

CREATE TYPE household_expense_category AS ENUM (
  'subscriptions',      -- Abonnements
  'rent',              -- Loyer
  'worker_salary',     -- Salaire travailleurs
  'maintenance',       -- Entretien (maison, véhicule, groupe électrogène, etc.)
  'utilities',         -- Services publics (eau, électricité, etc.)
  'food',              -- Alimentation
  'health',            -- Santé
  'education',         -- Éducation
  'savings',           -- Épargne
  'other'              -- Autres
);

-- ============================================
-- CRÉER LA TABLE household_expenses
-- ============================================

CREATE TABLE household_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_date DATE NOT NULL,
  category household_expense_category NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  vendor_name VARCHAR(255), -- Nom du fournisseur/prestataire
  receipt_url TEXT, -- URL du reçu/facture
  notes TEXT, -- Notes supplémentaires
  is_recurring BOOLEAN DEFAULT FALSE, -- Dépense récurrente (mensuelle, annuelle, etc.)
  recurring_frequency VARCHAR(50), -- 'monthly', 'yearly', 'weekly', etc.
  worker_name VARCHAR(255), -- Nom du travailleur (si category = 'worker_salary')
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- CRÉER LES INDEXES
-- ============================================

CREATE INDEX idx_household_expenses_date ON household_expenses(expense_date);
CREATE INDEX idx_household_expenses_category ON household_expenses(category);
CREATE INDEX idx_household_expenses_created_by ON household_expenses(created_by);
CREATE INDEX idx_household_expenses_recurring ON household_expenses(is_recurring);

-- ============================================
-- ACTIVER RLS
-- ============================================

ALTER TABLE household_expenses ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CRÉER LES POLITIQUES RLS
-- ============================================

-- Seul le SUPER_ADMIN_GROUP peut voir et gérer ses propres dépenses
CREATE POLICY "Super admin can manage household expenses"
  ON household_expenses FOR ALL
  USING (
    get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP' AND
    created_by = auth.uid()
  )
  WITH CHECK (
    get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP' AND
    created_by = auth.uid()
  );

-- Note: Cette politique permet uniquement au SUPER_ADMIN_GROUP de voir et gérer
-- ses propres dépenses personnelles. Aucun autre utilisateur ne peut y accéder.

