# Correction rapide : Colonne avatar_url manquante

## Erreur

```
Could not find the 'avatar_url' column of 'users' in the schema cache
```

## Solution rapide (2 minutes)

### Étape 1 : Exécuter la migration SQL

1. Allez sur https://supabase.com/dashboard
2. Sélectionnez votre projet
3. Cliquez sur **SQL Editor** dans le menu de gauche
4. Cliquez sur **New Query**
5. Copiez-collez ce code :

```sql
-- Ajouter la colonne avatar_url si elle n'existe pas
DO $$ 
BEGIN
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
END $$;
```

6. Cliquez sur **Run** (ou Ctrl+Enter)

### Étape 2 : Vérifier

Exécutez cette requête pour vérifier :

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'avatar_url';
```

Vous devriez voir `avatar_url | text`

### Étape 3 : Redémarrer l'application

1. Redéployez sur Vercel (si nécessaire)
2. Ou rechargez simplement la page dans votre navigateur

## C'est tout !

Après ces étapes, le bouton d'upload de photo de profil devrait fonctionner correctement.

## Fichiers créés

- `supabase/add-avatar-url-column.sql` : Migration complète avec commentaires
- `supabase/MIGRATION_AVATAR_URL.md` : Documentation détaillée
- `next.config.js` : Configuration mise à jour pour les images Supabase

