# Migration et seed admin

## Migrations

### Option A : Script Node (connexion directe)

```bash
npm run run-migrations
```

Nécessite `DATABASE_URL` dans `.env`. Si la connexion échoue (DNS, firewall), utilisez l’option B.

### Option B : Supabase Dashboard

1. Ouvrez [Supabase Dashboard](https://supabase.com/dashboard) → votre projet
2. Allez dans **SQL Editor**
3. Exécutez les fichiers SQL dans cet ordre :

   - `supabase/schema.sql`
   - `supabase/migrate-add-roles-table.sql`
   - `supabase/migrate-user-role-enum-to-varchar.sql`
   - `supabase/migrate-entity-code-to-varchar.sql`
   - `supabase/add-missing-users-columns.sql`
   - `supabase/add-currency-columns.sql`
   - `supabase/add-entity-branding.sql`
   - `supabase/create-exchange-rates-table.sql`
   - `supabase/create-household-expenses-table.sql`
   - `supabase/migrations/20250111000004_create_household_budgets.sql`
   - `supabase/add-invoice-taxes.sql`
   - `supabase/add-mail-fields.sql`
   - `supabase/add-task-attachments.sql`
   - Puis les fichiers dans `supabase/migrations/` (par ordre de préfixe)

## Seed admin

Création d’un admin initial :

```bash
npm run seed-admin
```

Identifiants par défaut :

| Champ      | Valeur                 |
|-----------|-------------------------|
| **Email** | admin@isirogroup.com   |
| **Mot de passe** | Admin@2026      |

### Personnaliser

```bash
SEED_ADMIN_EMAIL=mon@email.com SEED_ADMIN_PASSWORD=MonMotDePasse npm run seed-admin
```

### Promouvoir un utilisateur existant

```bash
npm run make-super-admin admin@isirogroup.com
```

## Erreur 404 sur /rest/v1/users

Si vous voyez une erreur **404** lors du chargement du profil :

1. **Exécuter le fix RLS** dans Supabase → SQL Editor :
   ```sql
   -- Copier le contenu de supabase/fix-users-table-404.sql
   ```

2. **Créer l'entrée utilisateur** si vous vous connectez avec un email non créé par seed-admin :
   ```bash
   npm run make-super-admin votre@email.com
   ```
