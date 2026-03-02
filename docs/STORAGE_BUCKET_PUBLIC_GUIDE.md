# Guide : Comment rendre le bucket "documents" public dans Supabase

## Problème
Les pièces jointes ne peuvent pas être ouvertes à cause de l'erreur "Bucket not found". Cela est dû au fait que le bucket `documents` est privé alors que le code utilise `.getPublicUrl()`.

## Solution : Rendre le bucket public

### Méthode 1 : Via le Dashboard Supabase (Recommandé)

**Étapes détaillées :**

1. **Accéder à la page Storage**
   - Allez dans votre Dashboard Supabase
   - Dans le menu de gauche, cliquez sur **"Storage"** (ou **"Files"**)

2. **Accéder aux détails du bucket**
   - Dans l'onglet **"Buckets"**, vous verrez la liste des buckets
   - **Cliquez directement sur le nom "documents"** (le texte "documents" avec l'icône de dossier)
   - OU cliquez sur l'icône **`>`** (flèche) à droite de la ligne du bucket "documents"
   
   ⚠️ **Important :** Ne cliquez PAS sur les onglets "Settings" ou "Policies" en haut - ce sont les paramètres globaux. Vous devez d'abord cliquer sur le bucket lui-même.

3. **Modifier les paramètres du bucket**
   - Une page de détails du bucket devrait s'ouvrir
   - Cherchez une option **"Public bucket"** ou **"Make public"** avec un toggle (bouton ON/OFF)
   - Activez ce toggle (mettez-le sur ON/true)
   - Si vous voyez un bouton **"Save"** ou **"Update"**, cliquez dessus

4. **Vérification**
   - Retournez à la liste des buckets
   - Le bucket "documents" devrait maintenant être marqué comme "public" quelque part dans la ligne

### Méthode 2 : Via SQL (Si vous avez accès à l'éditeur SQL)

Si l'interface du Dashboard ne vous permet pas de modifier le bucket, vous pouvez utiliser SQL :

1. Allez dans **SQL Editor** dans votre Dashboard Supabase
2. Créez une nouvelle requête
3. Exécutez cette commande :

```sql
UPDATE storage.buckets
SET public = true
WHERE id = 'documents';
```

⚠️ **Note :** Cette commande nécessite des privilèges d'administrateur.

### Méthode 3 : Via l'API Supabase (Pour les développeurs)

Si vous avez accès à la Service Role Key, vous pouvez utiliser l'API :

```javascript
const { data, error } = await supabase.storage.updateBucket('documents', {
  public: true
});
```

## Vérification après modification

Pour vérifier que le bucket est bien public :

1. Retournez dans **Storage → Buckets**
2. Le bucket "documents" devrait maintenant avoir un indicateur "Public" quelque part
3. Testez l'ouverture d'une pièce jointe dans votre application
4. L'erreur "Bucket not found" devrait disparaître

## Si vous ne trouvez toujours pas l'option

Si l'interface a changé ou si vous ne voyez pas l'option "Public bucket" :

1. **Contactez le support Supabase** via votre dashboard
2. **Utilisez la méthode SQL** (méthode 2 ci-dessus)
3. **Vérifiez les permissions** : assurez-vous d'être connecté avec un compte ayant les droits d'administration du projet

## Pourquoi c'est sûr ?

- ✅ Les fichiers sont protégés par **RLS (Row Level Security)**
- ✅ Les politiques RLS garantissent que seuls les utilisateurs autorisés peuvent accéder aux fichiers
- ✅ Rendre le bucket public permet juste d'utiliser `.getPublicUrl()` - la sécurité reste assurée par RLS

## Alternative : Utiliser des URLs signées (Plus complexe)

Si vous préférez garder le bucket privé, vous devriez modifier le code pour utiliser `.createSignedUrl()` au lieu de `.getPublicUrl()` partout. Cela nécessite des modifications dans plusieurs fichiers et les URLs expirent après un certain temps.

