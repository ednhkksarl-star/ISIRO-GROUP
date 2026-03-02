# Scripts Utilitaires

Ce dossier contient des scripts pour faciliter la gestion et la configuration de l'application.

## Scripts disponibles

### 1. `generate-icons.js`
Génère les icônes PWA dans `public/icons/`

**Usage:**
```bash
npm run generate-icons
```

### 2. `setup-storage.js`
Configure le bucket de stockage Supabase et ses politiques

**Prérequis:**
- Ajouter `SUPABASE_SERVICE_KEY` dans `.env.local`

**Usage:**
```bash
npm run setup-storage
```

### 3. `make-super-admin.js`
Promouvoit un utilisateur en SUPER_ADMIN_GROUP

**Prérequis:**
- Ajouter `SUPABASE_SERVICE_KEY` dans `.env.local`
- L'utilisateur doit exister dans Supabase Auth

**Usage:**
```bash
# Par email
npm run make-super-admin nicolianza@isirogroup.com

# Par UUID
npm run make-super-admin 44a58f57-9eaa-4ec6-bd03-0bc997890761
```

**Ce que fait le script:**
- Recherche l'utilisateur par email ou UUID
- Vérifie s'il existe dans la table `users`
- Crée l'entrée si nécessaire
- Met à jour le rôle à `SUPER_ADMIN_GROUP`
- Définit `entity_id` à `NULL` (accès à toutes les entités)
- Active le compte (`is_active = true`)

## Variables d'environnement requises

Pour les scripts qui utilisent l'API Supabase, ajoutez dans `.env.local`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
```

⚠️ **Important**: Utilisez la **Service Role Key**, pas l'anon key. Vous la trouvez dans:
- Supabase Dashboard → Settings → API → Service Role Key

## Scripts SQL alternatifs

Si vous préférez utiliser SQL directement, consultez:
- `supabase/make-super-admin.sql` - Script SQL pour promouvoir un utilisateur

