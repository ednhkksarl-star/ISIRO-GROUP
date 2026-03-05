/**
 * Script pour créer un admin initial (seed) pour le schéma ERP (ISIRO GROUP)
 * Structure compatible avec supabase/schema.sql
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@isirogroup.com';
const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@2026';

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

async function seedERPAdmin() {
    console.log('🌱 Création du Super Admin ISIRO (ERP)...\n');

    try {
        // 1. Gérer l'utilisateur dans Supabase Auth
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) throw listError;

        const existing = users.find((u) => u.email === adminEmail);
        let userId;

        if (existing) {
            console.log('⚠️  L\'utilisateur Auth existe déjà. Réinitialisation du mot de passe...');
            userId = existing.id;
            const { error: resetError } = await supabase.auth.admin.updateUserById(userId, {
                password: adminPassword,
                email_confirm: true
            });
            if (resetError) throw resetError;
        } else {
            const { data, error } = await supabase.auth.admin.createUser({
                email: adminEmail,
                password: adminPassword,
                email_confirm: true,
            });
            if (error) throw error;
            userId = data.user.id;
            console.log('✅ Utilisateur créé dans Supabase Auth.');
        }

        // 2. Créer le profil dans la table public.users (Schéma ERP)
        // Structure: id, email, full_name, role, entity_id, entity_ids, avatar_url, is_active, created_at, updated_at
        const { data: profile } = await supabase
            .from('users')
            .select('id')
            .eq('id', userId)
            .maybeSingle();

        if (profile) {
            const { error: updateError } = await supabase
                .from('users')
                .update({
                    full_name: 'Isiro Super Admin',
                    role: 'SUPER_ADMIN_GROUP',
                    is_active: true,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId);

            if (updateError) throw updateError;
            console.log('✅ Profil ERP mis à jour dans la table "users".');
        } else {
            const { error: insertError } = await supabase.from('users').insert({
                id: userId,
                email: adminEmail,
                full_name: 'Isiro Super Admin',
                role: 'SUPER_ADMIN_GROUP',
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

            if (insertError) throw insertError;
            console.log('✅ Profil ERP créé dans la table "users".');
        }

        console.log('\n═══════════════════════════════════════════');
        console.log('  SUPER ADMIN ISIRO PRÊT');
        console.log('═══════════════════════════════════════════');
        console.log(`  Email:    ${adminEmail}`);
        console.log(`  Password: ${adminPassword}`);
        console.log(`  Rôle:     SUPER_ADMIN_GROUP`);
        console.log('═══════════════════════════════════════════');

    } catch (err) {
        console.error('❌ Erreur:', err.message);
        process.exit(1);
    }
}

seedERPAdmin();
