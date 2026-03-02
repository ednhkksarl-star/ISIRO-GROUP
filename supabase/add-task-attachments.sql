-- Ajouter les colonnes pour les pièces jointes et tags aux tâches
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS attachment_url TEXT,
ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS tags TEXT[], -- Array de tags pour la catégorisation
ADD COLUMN IF NOT EXISTS color VARCHAR(7); -- Code couleur hexadécimal pour la personnalisation visuelle

-- Index pour améliorer les performances de recherche par tags
CREATE INDEX IF NOT EXISTS idx_tasks_tags ON tasks USING GIN(tags);

