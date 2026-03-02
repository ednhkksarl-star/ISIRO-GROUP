-- Module Répertoire: clients, fournisseurs, partenaires, collaborateurs
-- Toutes les tables sont filtrées par entity_id et is_active

-- clients
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(100),
  email VARCHAR(255),
  address TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_entity_id ON clients(entity_id);
CREATE INDEX IF NOT EXISTS idx_clients_is_active ON clients(is_active);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view clients in their entities"
  ON clients FOR SELECT USING (can_access_entity(auth.uid(), entity_id) AND is_active = true);
CREATE POLICY "Users with create can insert clients"
  ON clients FOR INSERT WITH CHECK (can_access_entity(auth.uid(), entity_id));
CREATE POLICY "Users with update can update clients"
  ON clients FOR UPDATE USING (can_access_entity(auth.uid(), entity_id));
CREATE POLICY "Users with delete can delete clients"
  ON clients FOR DELETE USING (can_access_entity(auth.uid(), entity_id));

-- suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(100),
  email VARCHAR(255),
  address TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_entity_id ON suppliers(entity_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_is_active ON suppliers(is_active);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view suppliers in their entities"
  ON suppliers FOR SELECT USING (can_access_entity(auth.uid(), entity_id) AND is_active = true);
CREATE POLICY "Users with create can insert suppliers"
  ON suppliers FOR INSERT WITH CHECK (can_access_entity(auth.uid(), entity_id));
CREATE POLICY "Users with update can update suppliers"
  ON suppliers FOR UPDATE USING (can_access_entity(auth.uid(), entity_id));
CREATE POLICY "Users with delete can delete suppliers"
  ON suppliers FOR DELETE USING (can_access_entity(auth.uid(), entity_id));

-- partners
CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(100),
  email VARCHAR(255),
  address TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partners_entity_id ON partners(entity_id);
CREATE INDEX IF NOT EXISTS idx_partners_is_active ON partners(is_active);
CREATE INDEX IF NOT EXISTS idx_partners_name ON partners(name);

ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view partners in their entities"
  ON partners FOR SELECT USING (can_access_entity(auth.uid(), entity_id) AND is_active = true);
CREATE POLICY "Users with create can insert partners"
  ON partners FOR INSERT WITH CHECK (can_access_entity(auth.uid(), entity_id));
CREATE POLICY "Users with update can update partners"
  ON partners FOR UPDATE USING (can_access_entity(auth.uid(), entity_id));
CREATE POLICY "Users with delete can delete partners"
  ON partners FOR DELETE USING (can_access_entity(auth.uid(), entity_id));

-- collaborators (avec role_position pour Fonction/Poste)
CREATE TABLE IF NOT EXISTS collaborators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(100),
  email VARCHAR(255),
  address TEXT,
  notes TEXT,
  role_position VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collaborators_entity_id ON collaborators(entity_id);
CREATE INDEX IF NOT EXISTS idx_collaborators_is_active ON collaborators(is_active);
CREATE INDEX IF NOT EXISTS idx_collaborators_name ON collaborators(name);

ALTER TABLE collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view collaborators in their entities"
  ON collaborators FOR SELECT USING (can_access_entity(auth.uid(), entity_id) AND is_active = true);
CREATE POLICY "Users with create can insert collaborators"
  ON collaborators FOR INSERT WITH CHECK (can_access_entity(auth.uid(), entity_id));
CREATE POLICY "Users with update can update collaborators"
  ON collaborators FOR UPDATE USING (can_access_entity(auth.uid(), entity_id));
CREATE POLICY "Users with delete can delete collaborators"
  ON collaborators FOR DELETE USING (can_access_entity(auth.uid(), entity_id));
