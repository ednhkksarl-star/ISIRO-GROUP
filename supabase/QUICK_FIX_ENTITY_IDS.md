# Correction rapide : Colonne entity_ids manquante

## Erreur

```
Could not find the 'entity_ids' column of 'users' in the schema cache
```

## Solution rapide (2 minutes)

### Étape 1 : Exécuter la migration SQL

1. Allez sur https://supabase.com/dashboard
2. Sélectionnez votre projet
3. Cliquez sur **SQL Editor** dans le menu de gauche
4. Cliquez sur **New Query**
5. Copiez-collez ce code :

```sql
-- Ajouter la colonne entity_ids si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'entity_ids'
    ) THEN
        ALTER TABLE public.users 
        ADD COLUMN entity_ids JSONB;
    END IF;
END $$;
```

6. Cliquez sur **Run** (ou Ctrl+Enter)

### Étape 2 : Vérifier

Exécutez cette requête pour vérifier :

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'entity_ids';
```

Vous devriez voir `entity_ids | jsonb`

### Étape 3 : Recharger l'application

Rechargez simplement la page dans votre navigateur (Ctrl+R ou F5)

## Migration complète (avatar_url + entity_ids)

Si vous n'avez pas encore ajouté `avatar_url`, exécutez cette migration complète :

```sql
-- Ajouter avatar_url et entity_ids si elles n'existent pas
DO $$ 
BEGIN
    -- Ajouter avatar_url
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'avatar_url'
    ) THEN
        ALTER TABLE public.users 
        ADD COLUMN avatar_url TEXT;
    END IF;
    
    -- Ajouter entity_ids
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'entity_ids'
    ) THEN
        ALTER TABLE public.users 
        ADD COLUMN entity_ids JSONB;
    END IF;
END $$;

-- Vérifier les colonnes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('entity_ids', 'avatar_url')
ORDER BY column_name;
```

## C'est tout !

Après ces étapes, la gestion des utilisateurs multi-entités devrait fonctionner correctement.

## Fichiers créés

- `supabase/add-entity-ids-column.sql` : Migration complète avec commentaires
- `supabase/QUICK_FIX_ENTITY_IDS.md` : Ce fichier

