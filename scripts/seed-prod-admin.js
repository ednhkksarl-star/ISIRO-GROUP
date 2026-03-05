/**
 * Script pour créer un admin initial (seed) pour le schéma de PRODUCTION
 * Crée un utilisateur dans Supabase Auth + table public.users avec le rôle SUPER_ADMIN
 *
 * Usage:
 *   node scripts/seed-prod-admin.js
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');
const crypto = require('crypto');

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

async function seedAdmin() {
    console.log('🌱 Création de l\'admin PRODUCTION...\n');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Mot de passe: ${adminPassword}`);
    console.log('');

    try {
        // 1. Gérer l'utilisateur dans Supabase Auth
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const existing = existingUsers?.users?.find((u) => u.email === adminEmail);

        let userId;

        if (existing) {
            console.log('⚠️  L\'utilisateur Auth existe déjà.');
            userId = existing.id;
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

        // 2. Gérer le profil dans la table public.users (Schéma Prod)
        // Structure: id, email, name, passwordHash, role, status
        // Note: On met un hash factice pour passwordHash si l'app utilise Auth (qui gère son propre hash)
        const dummyHash = crypto.createHash('sha256').update(adminPassword).digest('hex');

        const { data: profile, error: fetchError } = await supabase
            .from('users')
            .select('id')
            .eq('id', userId)
            .maybeSingle();

        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is sometimes returned for no rows in some contexts, though maybeSingle handles it
            console.error('❌ Erreur lors de la vérification du profil:', fetchError.message);
            console.log('Code:', fetchError.code);
            if (fetchError.code === 'PGRST204') {
                console.log('💡 Note: Le cache PostgREST semble être en cours de mise à jour. Réessaie dans 10 secondes.');
            }
            process.exit(1);
        }

        if (profile) {
            const { error: updateError } = await supabase
                .from('users')
                .update({
                    name: 'Administrateur Principal',
                    role: 'SUPER_ADMIN',
                    status: 'ACTIVE',
                    updatedat: new Date().toISOString()
                })
                .eq('id', userId);

            if (updateError) throw updateError;
            console.log('✅ Profil mis à jour dans la table "users".');
        } else {
            console.log('Tentative d\'insertion du profil admin...');
            const { error: insertError } = await supabase.from('users').insert({
                id: userId,
                email: adminEmail,
                name: 'Administrateur Principal',
                passwordhash: dummyHash,
                role: 'SUPER_ADMIN',
                status: 'ACTIVE',
                createdat: new Date().toISOString(),
                updatedat: new Date().toISOString()
            });

            if (insertError) {
                console.error('❌ Erreur d\'insertion:', insertError.message);
                console.log('Détails:', insertError);
                process.exit(1);
            }
            console.log('✅ Profil créé dans la table "users".');
        }

        console.log('\n═══════════════════════════════════════════');
        console.log('  ACCÈS ADMIN PRÊT');
        console.log('═══════════════════════════════════════════');
        console.log(`  Email:    ${adminEmail}`);
        console.log(`  Password: ${adminPassword}`);
        console.log('═══════════════════════════════════════════');

    } catch (err) {
        console.error('❌ Erreur:', err.message);
        process.exit(1);
    }
}

seedAdmin();
