# Route API `/api/users/create`

## Problème résolu

L'erreur `404 (Not Found)` sur `/api/users/create` était due au middleware qui interceptait toutes les routes, y compris les routes API.

## Solution appliquée

### 1. Exclusion des routes API du middleware

Le middleware a été modifié pour exclure explicitement les routes `/api/*` :

```typescript
// Exclure les routes API du middleware (elles gèrent leur propre authentification)
if (req.nextUrl.pathname.startsWith('/api/')) {
  return res;
}
```

### 2. Mise à jour du matcher du middleware

Le matcher a été mis à jour pour exclure explicitement les routes API :

```typescript
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

### 3. Amélioration de la gestion d'erreurs

La route API a été améliorée pour mieux gérer les erreurs de profil utilisateur :

- Utilisation de `.maybeSingle()` au lieu de `.single()` pour éviter les erreurs si le profil n'existe pas
- Messages d'erreur plus détaillés
- Logging des erreurs pour le debugging

## Configuration requise sur Vercel

Pour que la route API fonctionne correctement, vous devez configurer les variables d'environnement suivantes dans Vercel :

1. **NEXT_PUBLIC_SUPABASE_URL** : L'URL de votre projet Supabase
2. **NEXT_PUBLIC_SUPABASE_ANON_KEY** : La clé anonyme de Supabase
3. **SUPABASE_SERVICE_ROLE_KEY** : ⚠️ **IMPORTANT** - La clé de service (Service Role Key) de Supabase

### Comment obtenir la Service Role Key

1. Allez dans votre projet Supabase
2. Cliquez sur **Settings** → **API**
3. Copiez la **`service_role` key** (⚠️ Ne jamais l'exposer côté client !)
4. Ajoutez-la dans Vercel comme variable d'environnement : `SUPABASE_SERVICE_ROLE_KEY`

## Fonctionnement de la route

La route `/api/users/create` :

1. **Vérifie l'authentification** : Vérifie que l'utilisateur est connecté via le token Bearer
2. **Vérifie les permissions** : Vérifie que l'utilisateur est un `SUPER_ADMIN_GROUP`
3. **Crée l'utilisateur dans Supabase Auth** : Utilise `auth.admin.createUser()` avec la Service Role Key
4. **Crée le profil dans la table `users`** : Insère les données dans la table `public.users`
5. **Gère les erreurs** : Si l'insertion dans `users` échoue, supprime l'utilisateur Auth créé

## Test de la route

Pour tester que la route fonctionne :

1. Assurez-vous d'être connecté en tant que `SUPER_ADMIN_GROUP`
2. Allez sur `/users/new`
3. Remplissez le formulaire
4. Cliquez sur "Créer l'utilisateur"

Si tout fonctionne, l'utilisateur sera créé dans Supabase Auth ET dans la table `users`.

## Dépannage

### Erreur 404
- Vérifiez que le middleware exclut bien les routes `/api/*`
- Vérifiez que le fichier `src/app/api/users/create/route.ts` existe
- Redéployez sur Vercel après les modifications

### Erreur 500 - Variables d'environnement manquantes
- Vérifiez que `SUPABASE_SERVICE_ROLE_KEY` est bien configurée dans Vercel
- Vérifiez que les autres variables d'environnement sont configurées

### Erreur 404 - Profil utilisateur introuvable
- L'utilisateur qui essaie de créer un autre utilisateur n'a pas de profil dans la table `users`
- Exécutez le script `npm run make-super-admin <email>` pour créer le profil

### Erreur 403 - Accès refusé
- L'utilisateur n'est pas un `SUPER_ADMIN_GROUP`
- Vérifiez le rôle dans la table `users`

