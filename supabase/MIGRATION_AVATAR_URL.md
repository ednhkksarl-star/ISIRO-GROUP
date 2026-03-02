# Migration : Ajout de la colonne avatar_url

## Problème

L'erreur `Could not find the 'avatar_url' column of 'users' in the schema cache` indique que la colonne `avatar_url` n'existe pas dans la table `users` de votre base de données Supabase.

## Solution

Exécutez la migration SQL suivante dans votre base de données Supabase.

## Instructions

### Option 1 : Via le Dashboard Supabase (Recommandé)

1. Connectez-vous à votre projet Supabase : https://supabase.com/dashboard
2. Allez dans **SQL Editor**
3. Cliquez sur **New Query**
4. Copiez-collez le contenu du fichier `add-avatar-url-column.sql`
5. Cliquez sur **Run** ou appuyez sur `Ctrl+Enter`

### Option 2 : Via la ligne de commande

Si vous avez installé Supabase CLI :

```bash
supabase db push
```

Ou exécutez directement le fichier SQL :

```bash
psql -h [VOTRE_HOST] -U postgres -d postgres -f supabase/add-avatar-url-column.sql
```

## Vérification

Après avoir exécuté la migration, vérifiez que la colonne existe :

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'avatar_url';
```

Vous devriez voir :
```
column_name | data_type
------------+----------
avatar_url  | text
```

## Fichier de migration

Le fichier `supabase/add-avatar-url-column.sql` contient la migration qui :
- Vérifie si la colonne existe déjà
- Ajoute la colonne `avatar_url TEXT` si elle n'existe pas
- Ajoute un commentaire pour la documentation

## Après la migration

Une fois la migration exécutée :
1. Rechargez votre application
2. Le bouton d'upload de photo de profil devrait fonctionner
3. Les photos seront stockées dans Supabase Storage (bucket `documents`)

## Note importante

Assurez-vous que le bucket `documents` existe dans Supabase Storage et que les politiques RLS sont correctement configurées pour permettre l'upload des avatars.

Pour vérifier/créer le bucket :
```sql
-- Vérifier si le bucket existe
SELECT * FROM storage.buckets WHERE name = 'documents';

-- Si nécessaire, créer le bucket (via Dashboard Supabase > Storage)
```

