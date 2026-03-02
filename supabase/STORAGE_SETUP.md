# Configuration du Storage Supabase

Ce guide explique comment configurer le bucket de stockage et ses politiques de sécurité.

## Méthode 1 : Script Automatique (Recommandé)

### Prérequis

1. Obtenir la clé Service Role de Supabase :
   - Aller dans Supabase Dashboard → Settings → API
   - Copier la **Service Role Key** (⚠️ NE PAS utiliser l'anon key)

2. Ajouter dans `.env.local` :
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=your-service-role-key
   ```

3. Exécuter le script :
   ```bash
   npm run setup-storage
   ```

Le script va :
- ✅ Créer le bucket `documents`
- ✅ Configurer les limites (10MB, types MIME)
- ⚠️  Afficher les instructions pour les politiques RLS

## Méthode 2 : Configuration Manuelle

### Étape 1 : Créer le Bucket

1. Aller dans **Supabase Dashboard → Storage → Buckets**
2. Cliquer sur **New Bucket**
3. Configurer :
   - **Name**: `documents`
   - **Public**: `false` (privé)
   - **File size limit**: `10485760` (10MB)
   - **Allowed MIME types**: 
     ```
     image/*
     application/pdf
     text/csv
     video/*
     application/vnd.ms-excel
     application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
     ```
4. Cliquer sur **Create bucket**

### Étape 2 : Configurer les Politiques RLS

1. Aller dans **Supabase Dashboard → Storage → Policies**
2. Sélectionner le bucket `documents`
3. Exécuter le script SQL `storage.sql` dans l'éditeur SQL

Ou créer manuellement les politiques via l'interface :

#### Politique de Lecture (SELECT)

**Nom**: `Users can view documents in their entity`

**Commande**: SELECT

**Expression**:
```sql
bucket_id = 'documents' AND
(
  (storage.foldername(name))[1] = get_user_entity(auth.uid())::TEXT OR
  get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP'
)
```

#### Politique d'Insertion (INSERT)

**Nom**: `Users can upload documents to their entity`

**Commande**: INSERT

**Expression**:
```sql
bucket_id = 'documents' AND
get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY', 'ACCOUNTANT', 'SECRETARY') AND
(storage.foldername(name))[1] = get_user_entity(auth.uid())::TEXT
```

#### Politique de Suppression (DELETE)

**Nom**: `Admin entity can delete documents in their entity`

**Commande**: DELETE

**Expression**:
```sql
bucket_id = 'documents' AND
get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY') AND
(storage.foldername(name))[1] = get_user_entity(auth.uid())::TEXT
```

## Structure des Dossiers

Les fichiers sont organisés par entité :

```
documents/
  {entity_id}/
    {timestamp}.{extension}
```

Exemple :
```
documents/
  550e8400-e29b-41d4-a716-446655440000/
    1704067200000.pdf
    1704067300000.jpg
```

## Vérification

Pour tester la configuration :

1. **Tester l'upload** :
   ```javascript
   const { data, error } = await supabase.storage
     .from('documents')
     .upload(`${entityId}/${Date.now()}.pdf`, file);
   ```

2. **Tester le téléchargement** :
   ```javascript
   const { data, error } = await supabase.storage
     .from('documents')
     .download(`${entityId}/file.pdf`);
   ```

3. **Vérifier les permissions** :
   - Connectez-vous avec différents rôles
   - Testez l'accès aux fichiers d'autres entités (devrait échouer)
   - Testez l'accès aux fichiers de votre entité (devrait réussir)

## Dépannage

### Erreur: "Bucket not found"
- Vérifiez que le bucket `documents` existe
- Vérifiez le nom exact (sensible à la casse)

### Erreur: "new row violates row-level security policy"
- Vérifiez que les politiques RLS sont correctement configurées
- Vérifiez que l'utilisateur a le bon rôle
- Vérifiez que le chemin du fichier contient l'entity_id

### Erreur: "File size exceeds limit"
- Augmentez la limite dans les paramètres du bucket
- Ou réduisez la taille du fichier

## Sécurité

⚠️ **Important** :
- Ne partagez JAMAIS la clé Service Role
- Utilisez toujours l'anon key côté client
- Les politiques RLS garantissent que les utilisateurs ne peuvent accéder qu'aux fichiers de leur entité
- Le SUPER_ADMIN_GROUP peut accéder à tous les fichiers

