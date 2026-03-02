# Configuration des Variables d'Environnement sur Vercel

## Variables Requises

Pour que l'application fonctionne correctement, vous devez configurer les variables d'environnement suivantes dans Vercel :

### 1. Variables Supabase (Obligatoires)

| Variable | Description | Où la trouver |
|----------|-------------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de votre projet Supabase | Supabase Dashboard → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anonyme (publique) | Supabase Dashboard → Settings → API → anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ **Clé de service (SECRÈTE)** | Supabase Dashboard → Settings → API → service_role key |

### 2. Variables Optionnelles

| Variable | Description | Valeur par défaut |
|----------|-------------|-------------------|
| `NEXT_PUBLIC_APP_URL` | URL de production de l'application | Auto-détectée par Vercel |
| `NODE_ENV` | Environnement | `production` sur Vercel |

## ⚠️ IMPORTANT : SUPABASE_SERVICE_ROLE_KEY

La `SUPABASE_SERVICE_ROLE_KEY` est **CRITIQUE** pour :

- ✅ Créer des utilisateurs via l'API (`/api/users/create`)
- ✅ Accéder à toutes les données sans RLS (nécessaire pour certaines opérations admin)
- ✅ Gérer les utilisateurs Supabase Auth

**⚠️ SÉCURITÉ** :
- ❌ **NE JAMAIS** exposer cette clé côté client
- ❌ **NE JAMAIS** la commiter dans Git
- ✅ **UNIQUEMENT** dans les variables d'environnement serveur (Vercel)
- ✅ **UNIQUEMENT** utilisée dans les API Routes Next.js

## Comment Configurer sur Vercel

### Méthode 1 : Via l'Interface Vercel

1. Allez sur [Vercel Dashboard](https://vercel.com/dashboard)
2. Sélectionnez votre projet
3. Allez dans **Settings** → **Environment Variables**
4. Ajoutez chaque variable :
   - **Name** : Le nom de la variable (ex: `SUPABASE_SERVICE_ROLE_KEY`)
   - **Value** : La valeur de la variable
   - **Environment** : Sélectionnez les environnements (Production, Preview, Development)
5. Cliquez sur **Save**

### Méthode 2 : Via Vercel CLI

```bash
# Installer Vercel CLI
npm i -g vercel

# Se connecter
vercel login

# Ajouter les variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY

# Pour chaque variable, Vercel vous demandera :
# - La valeur
# - Les environnements (Production, Preview, Development)
```

## Vérification

Après avoir configuré les variables :

1. **Redéployez** votre application sur Vercel
2. Vérifiez les logs de déploiement pour confirmer que les variables sont chargées
3. Testez la création d'utilisateur sur `/users/new`

## Dépannage

### Erreur : "Variables d'environnement manquantes"

**Symptôme** : L'API retourne une erreur 500 avec le message "Configuration Supabase manquante"

**Solution** :
1. Vérifiez que toutes les variables sont bien configurées dans Vercel
2. Vérifiez que vous avez sélectionné le bon environnement (Production/Preview/Development)
3. **Redéployez** l'application après avoir ajouté/modifié les variables

### Erreur : "Profil utilisateur introuvable"

**Symptôme** : L'API retourne une erreur 404 avec le message "Profil utilisateur introuvable"

**Solution** :
1. L'utilisateur qui essaie de créer un autre utilisateur n'a pas de profil dans la table `users`
2. Exécutez le script localement : `npm run make-super-admin <email>`
3. Ou créez manuellement le profil dans Supabase

### Erreur : "Non autorisé" (401)

**Symptôme** : L'API retourne une erreur 401

**Solution** :
1. Vérifiez que vous êtes bien connecté
2. Vérifiez que le token d'authentification est bien envoyé dans les headers
3. Vérifiez que votre session n'a pas expiré

### Erreur : "Accès refusé" (403)

**Symptôme** : L'API retourne une erreur 403 avec le message "Seuls les super admins peuvent créer des utilisateurs"

**Solution** :
1. Vérifiez que votre rôle est bien `SUPER_ADMIN_GROUP` dans la table `users`
2. Si ce n'est pas le cas, exécutez : `npm run make-super-admin <email>`

## Test Local

Pour tester localement, créez un fichier `.env.local` :

```env
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre-anon-key
SUPABASE_SERVICE_ROLE_KEY=votre-service-role-key
```

⚠️ **Ne commitez JAMAIS** le fichier `.env.local` dans Git !

## Checklist de Déploiement

Avant de déployer sur Vercel, assurez-vous que :

- [ ] `NEXT_PUBLIC_SUPABASE_URL` est configurée
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` est configurée
- [ ] `SUPABASE_SERVICE_ROLE_KEY` est configurée ⚠️
- [ ] Les variables sont configurées pour l'environnement **Production**
- [ ] L'application a été redéployée après avoir ajouté les variables
- [ ] La route `/api/users/create` fonctionne (testez la création d'utilisateur)
