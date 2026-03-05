/**
 * Script pour créer un admin initial (seed)
 * Crée un utilisateur dans Supabase Auth + table users avec SUPER_ADMIN_GROUP
 *
 * Usage:
 *   node scripts/seed-admin.js
 *   SEED_ADMIN_EMAIL=admin@isirogroup.com SEED_ADMIN_PASSWORD=MonMotDePasse node scripts/seed-admin.js
 *
 * Variables d'environnement:
 *   SEED_ADMIN_EMAIL - Email de l'admin (défaut: admin@isirogroup.com)
 *   SEED_ADMIN_PASSWORD - Mot de passe (défaut: Admin@2026)
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@isirogroup.com';
const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@2026';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seedAdmin() {
  console.log('🌱 Création de l\'admin initial...\n');
  console.log(`   Email: ${adminEmail}`);
  console.log(`   Mot de passe: ${adminPassword}`);
  console.log('');

  try {
    // Vérifier si l'utilisateur existe déjà
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((u) => u.email === adminEmail);

    let userId;

    if (existing) {
      console.log('⚠️  Un utilisateur avec cet email existe déjà.');
      userId = existing.id;

      const { data: profile } = await supabase
        .from('users')
        .select('id, role, full_name')
        .eq('id', userId)
        .maybeSingle();

      if (profile) {
        await supabase
          .from('users')
          .update({
            role: 'SUPER_ADMIN_GROUP',
            entity_id: null,
            is_active: true,
            full_name: profile.full_name || 'Administrateur',
          })
          .eq('id', userId);
        console.log('✅ Profil mis à jour avec le rôle SUPER_ADMIN_GROUP.\n');
      } else {
        await supabase.from('users').insert({
          id: userId,
          email: adminEmail,
          full_name: 'Administrateur',
          role: 'SUPER_ADMIN_GROUP',
          entity_id: null,
          is_active: true,
        });
        console.log('✅ Profil créé dans la table users.\n');
      }
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
      });

      if (error) throw error;
      userId = data.user.id;

      await supabase.from('users').insert({
        id: userId,
        email: adminEmail,
        full_name: 'Administrateur',
        role: 'SUPER_ADMIN_GROUP',
        entity_id: null,
        is_active: true,
      });

      console.log('✅ Utilisateur créé dans Auth + table users.\n');
    }

    console.log('═══════════════════════════════════════════');
    console.log('  ACCÈS ADMIN');
    console.log('═══════════════════════════════════════════');
    console.log(`  URL:      ${supabaseUrl.replace('.supabase.co', '')} ou http://localhost:3002/auth/login`);
    console.log(`  Email:    ${adminEmail}`);
    console.log(`  Mot de passe: ${adminPassword}`);
    console.log('═══════════════════════════════════════════');
    console.log('\n💡 Connectez-vous sur http://localhost:3002/auth/login');
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    if (err.message?.includes('already been registered')) {
      console.error('\n💡 L\'utilisateur existe. Utilisez: npm run make-super-admin', adminEmail);
    }
    process.exit(1);
  }
}

seedAdmin();
