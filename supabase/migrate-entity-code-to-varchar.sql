-- ============================================
-- MIGRATION: Convert entity_code ENUM to VARCHAR
-- Permet de modifier librement le code des entités
-- ============================================

-- 1. Modifier le type de la colonne code dans la table entities
ALTER TABLE entities 
  ALTER COLUMN code TYPE VARCHAR(50) USING code::VARCHAR(50);

-- 2. Mettre à jour la fonction generate_invoice_number
CREATE OR REPLACE FUNCTION generate_invoice_number(p_entity_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  v_code VARCHAR(50);
  v_year INTEGER;
  v_count INTEGER;
  v_number VARCHAR;
BEGIN
  SELECT code INTO v_code FROM entities WHERE id = p_entity_id;
  v_year := EXTRACT(YEAR FROM NOW());
  
  SELECT COUNT(*) INTO v_count
  FROM invoices
  WHERE entity_id = p_entity_id
    AND EXTRACT(YEAR FROM created_at) = v_year;
  
  v_count := v_count + 1;
  v_number := v_code || '-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
  
  RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- 3. Mettre à jour la fonction generate_expense_number
CREATE OR REPLACE FUNCTION generate_expense_number(p_entity_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  v_code VARCHAR(50);
  v_year INTEGER;
  v_count INTEGER;
  v_number VARCHAR;
BEGIN
  SELECT code INTO v_code FROM entities WHERE id = p_entity_id;
  v_year := EXTRACT(YEAR FROM NOW());
  
  SELECT COUNT(*) INTO v_count
  FROM expenses
  WHERE entity_id = p_entity_id
    AND EXTRACT(YEAR FROM created_at) = v_year;
  
  v_count := v_count + 1;
  v_number := 'EXP-' || v_code || '-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
  
  RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- 4. Mettre à jour la fonction generate_mail_number
CREATE OR REPLACE FUNCTION generate_mail_number(p_entity_id UUID, p_type mail_type)
RETURNS VARCHAR AS $$
DECLARE
  v_code VARCHAR(50);
  v_year INTEGER;
  v_count INTEGER;
  v_prefix VARCHAR;
  v_number VARCHAR;
BEGIN
  SELECT code INTO v_code FROM entities WHERE id = p_entity_id;
  v_year := EXTRACT(YEAR FROM NOW());
  
  IF p_type = 'incoming' THEN
    v_prefix := 'ENT';
  ELSIF p_type = 'outgoing' THEN
    v_prefix := 'SOR';
  ELSE
    v_prefix := 'INT';
  END IF;
  
  SELECT COUNT(*) INTO v_count
  FROM mail_items
  WHERE entity_id = p_entity_id
    AND mail_type = p_type
    AND EXTRACT(YEAR FROM created_at) = v_year;
  
  v_count := v_count + 1;
  v_number := v_prefix || '-' || v_code || '-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
  
  RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- Note: L'enum entity_code peut être supprimé plus tard si on ne l'utilise plus ailleurs
-- DROP TYPE entity_code; -- Ne pas exécuter tant qu'on n'est pas sûr qu'il n'est plus utilisé

