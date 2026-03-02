-- Table pour stocker les taux de change USD/CDF
-- Permet de gérer les taux de change quotidiens

CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rate_date DATE NOT NULL DEFAULT CURRENT_DATE,
  usd_to_cdf DECIMAL(10, 2) NOT NULL, -- Taux: 1 USD = X CDF
  is_active BOOLEAN DEFAULT TRUE, -- Taux actif pour la date
  notes TEXT, -- Notes optionnelles
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(rate_date, is_active) -- Un seul taux actif par date
);

-- Index pour les recherches rapides
CREATE INDEX IF NOT EXISTS idx_exchange_rates_date ON exchange_rates(rate_date DESC);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_active ON exchange_rates(is_active) WHERE is_active = TRUE;

-- Fonction pour obtenir le taux actif du jour
CREATE OR REPLACE FUNCTION get_active_exchange_rate(p_date DATE DEFAULT CURRENT_DATE)
RETURNS DECIMAL(10, 2) AS $$
DECLARE
  v_rate DECIMAL(10, 2);
BEGIN
  -- Chercher le taux actif pour la date spécifiée
  SELECT usd_to_cdf INTO v_rate
  FROM exchange_rates
  WHERE rate_date = p_date
    AND is_active = TRUE
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Si aucun taux trouvé pour cette date, chercher le dernier taux actif
  IF v_rate IS NULL THEN
    SELECT usd_to_cdf INTO v_rate
    FROM exchange_rates
    WHERE is_active = TRUE
      AND rate_date <= p_date
    ORDER BY rate_date DESC, created_at DESC
    LIMIT 1;
  END IF;
  
  -- Si toujours aucun taux, retourner 2400 par défaut
  RETURN COALESCE(v_rate, 2400.00);
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

-- Policy: Les super admins peuvent tout faire
CREATE POLICY "Super admins can manage all exchange rates"
  ON exchange_rates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'SUPER_ADMIN_GROUP'
    )
  );

-- Policy: Les admins d'entité peuvent gérer les taux
CREATE POLICY "Entity admins can manage exchange rates"
  ON exchange_rates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('ADMIN_ENTITY', 'ACCOUNTANT')
    )
  );

-- Policy: Tout le monde peut lire les taux actifs
CREATE POLICY "Everyone can read active exchange rates"
  ON exchange_rates
  FOR SELECT
  TO authenticated
  USING (is_active = TRUE);

-- Commentaires
COMMENT ON TABLE exchange_rates IS 'Table des taux de change USD vers CDF';
COMMENT ON COLUMN exchange_rates.rate_date IS 'Date d''application du taux';
COMMENT ON COLUMN exchange_rates.usd_to_cdf IS 'Taux de change: 1 USD = X CDF';
COMMENT ON COLUMN exchange_rates.is_active IS 'Indique si ce taux est actif pour la date';

