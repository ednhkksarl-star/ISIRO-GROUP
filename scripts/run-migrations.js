/**
 * Script pour exécuter les migrations Supabase
 * Usage: node scripts/run-migrations.js
 * Nécessite: DATABASE_URL dans .env
 */

const { Client } = require('pg');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('❌ DATABASE_URL manquant dans .env');
  process.exit(1);
}

const migrationOrder = [
  'supabase/schema.sql',
  'supabase/migrate-add-roles-table.sql',
  'supabase/migrate-user-role-enum-to-varchar.sql',
  'supabase/migrate-entity-code-to-varchar.sql',
  'supabase/add-missing-users-columns.sql',
  'supabase/add-currency-columns.sql',
  'supabase/add-entity-branding.sql',
  'supabase/create-exchange-rates-table.sql',
  'supabase/create-household-expenses-table.sql',
  'supabase/migrations/20250111000004_create_household_budgets.sql',
  'supabase/add-invoice-taxes.sql',
  'supabase/add-mail-fields.sql',
  'supabase/add-task-attachments.sql',
  'supabase/migrations/20250111000000_allow_users_view_all_users_for_assignment.sql',
  'supabase/migrations/20250111000001_fix_storage_bucket_public.sql',
  'supabase/migrations/20250111000002_make_documents_bucket_public.sql',
  'supabase/migrations/20250111000003_fix_mail_items_rls_policies.sql',
  'supabase/migrations/20250111000005_fix_household_expenses_rls.sql',
  'supabase/migrations/20250111000006_fix_user_deletion_constraints.sql',
  'supabase/migrations/20250209000000_create_repertoire_tables.sql',
];

const rootDir = path.join(__dirname, '..');

async function runMigrations() {
  const client = new Client({ connectionString: dbUrl });

  try {
    await client.connect();
    console.log('🔄 Exécution des migrations Supabase...\n');

    for (const file of migrationOrder) {
      const fullPath = path.join(rootDir, file);
      if (!fs.existsSync(fullPath)) {
        console.log(`⏭️  Ignoré (fichier absent): ${file}`);
        continue;
      }
      const sql = fs.readFileSync(fullPath, 'utf8');
      try {
        await client.query(sql);
        console.log(`✅ ${file}`);
      } catch (err) {
        if (err.code === '42P07' || err.message?.includes('already exists')) {
          console.log(`⏭️  Déjà appliqué: ${file}`);
        } else {
          console.error(`\n❌ Erreur dans ${file}:`, err.message);
          throw err;
        }
      }
    }

    console.log('\n✨ Migrations terminées avec succès.');
  } finally {
    await client.end();
  }
}

runMigrations().catch((err) => {
  console.error(err);
  process.exit(1);
});
