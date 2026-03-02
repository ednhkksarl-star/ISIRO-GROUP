# API de Création d'Utilisateurs

## Problème résolu

L'erreur "User not allowed" (403) lors de la création d'utilisateurs par le super admin était due à l'utilisation de `supabase.auth.admin.createUser()` côté client. Cette méthode nécessite la **Service Role Key** qui ne doit jamais être exposée côté client.

## Solution implémentée

Une route API Next.js (`/api/users/create`) a été créée pour gérer la création d'utilisateurs côté serveur.

### Architecture

```
Client (Browser)
    ↓
Page: /users/new
    ↓
API Route: /api/users/create (Server-side)
    ↓
Supabase Admin API (avec Service Role Key)
```

### Sécurité

1. **Vérification de l'authentification** : L'API vérifie que l'utilisateur est authentifié
2. **Vérification des permissions** : Seuls les `SUPER_ADMIN_GROUP` peuvent créer des utilisateurs
3. **Service Role Key** : Utilisée uniquement côté serveur, jamais exposée au client
4. **Validation** : Validation des données avant création

## Configuration requise

### Variables d'environnement

Ajoutez dans `.env.local` (développement) et dans Vercel (production) :

```env
# Variables existantes
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Nouvelle variable requise
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Où trouver la Service Role Key ?

1. Aller dans **Supabase Dashboard** → **Settings** → **API**
2. Copier la **Service Role Key** (⚠️ **NE JAMAIS** l'exposer côté client)
3. L'ajouter dans les variables d'environnement

## Utilisation

### Côté client

La page `/users/new` appelle maintenant l'API route :

```typescript
const response = await fetch('/api/users/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  },
  body: JSON.stringify({
    email: formData.email,
    password: formData.password,
    // ... autres champs
  }),
});
```

### Côté serveur (API Route)

L'API route :
1. Vérifie l'authentification de l'utilisateur
2. Vérifie que l'utilisateur est un `SUPER_ADMIN_GROUP`
3. Utilise la Service Role Key pour créer l'utilisateur
4. Crée l'entrée dans la table `users`
5. Retourne le résultat

## Gestion des erreurs

L'API retourne des codes HTTP appropriés :

- **200/201** : Succès
- **400** : Erreur de validation ou de création
- **401** : Non authentifié
- **403** : Accès refusé (pas super admin)
- **404** : Profil utilisateur introuvable
- **500** : Erreur serveur

## Rollback automatique

Si la création dans la table `users` échoue après la création dans Supabase Auth, l'utilisateur Auth est automatiquement supprimé pour éviter les incohérences.

## Déploiement

### Vercel

1. Aller dans **Vercel Dashboard** → **Settings** → **Environment Variables**
2. Ajouter `SUPABASE_SERVICE_ROLE_KEY` avec la valeur de votre Service Role Key
3. Redéployer l'application

### Vérification

Après le déploiement, tester la création d'un utilisateur :
- Se connecter en tant que `SUPER_ADMIN_GROUP`
- Aller sur `/users/new`
- Créer un nouvel utilisateur
- Vérifier que l'utilisateur est créé sans erreur

## Notes importantes

⚠️ **Sécurité** :
- La Service Role Key **NE DOIT JAMAIS** être exposée côté client
- Elle doit être utilisée uniquement dans les API routes Next.js
- Ne jamais la commiter dans Git (elle est dans `.env.local` qui est dans `.gitignore`)

✅ **Bonnes pratiques** :
- Toujours vérifier les permissions avant d'autoriser une action
- Valider toutes les données d'entrée
- Gérer les erreurs proprement
- Logger les erreurs pour le debugging

