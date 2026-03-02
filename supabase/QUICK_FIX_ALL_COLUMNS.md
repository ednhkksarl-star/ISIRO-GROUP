# Correction complète : Colonnes manquantes dans la table users

## Erreurs

1. `Could not find the 'avatar_url' column of 'users' in the schema cache`
2. `Could not find the 'entity_ids' column of 'users' in the schema cache`

## Solution rapide (2 minutes)

### Étape 1 : Exécuter la migration SQL complète

1. Allez sur https://supabase.com/dashboard
2. Sélectionnez votre projet
3. Cliquez sur **SQL Editor** dans le menu de gauche
4. Cliquez sur **New Query**
5. Copiez-collez ce code :

```sql
-- Migration complète : Ajouter avatar_url et entity_ids
DO $$ 
BEGIN
    -- Ajouter avatar_url si elle n'existe pas
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
    
    -- Ajouter entity_ids si elle n'existe pas
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

Exécutez cette requête pour vérifier que les colonnes existent :

```sql
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'users' 
AND column_name IN ('entity_ids', 'avatar_url')
ORDER BY column_name;
```

Vous devriez voir :
```
column_name | data_type | is_nullable
------------+-----------+------------
avatar_url  | text      | YES
entity_ids  | jsonb     | YES
```

### Étape 3 : Recharger l'application

Rechargez simplement la page dans votre navigateur (Ctrl+R ou F5)

## C'est tout !

Après ces étapes :
- ✅ L'upload de photo de profil fonctionnera
- La gestion des utilisateurs multi-entités fonctionnera
- Toutes les fonctionnalités liées aux utilisateurs seront opérationnelles

## Fichiers disponibles

- `supabase/add-missing-users-columns.sql` : Migration complète (recommandé)
- `supabase/add-avatar-url-column.sql` : Migration pour avatar_url uniquement
- `supabase/add-entity-ids-column.sql` : Migration pour entity_ids uniquement

