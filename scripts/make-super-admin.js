/**
 * Script pour promouvoir un utilisateur en SUPER_ADMIN_GROUP
 * 
 * Usage:
 *   node scripts/make-super-admin.js <email>
 *   ou
 *   node scripts/make-super-admin.js <user_id>
 * 
 * Exemple:
 *   node scripts/make-super-admin.js nicolianza@isirogroup.com
 *   node scripts/make-super-admin.js 44a58f57-9eaa-4ec6-bd03-0bc997890761
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

// Charger .env et .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
dotenv.config({ path: path.join(process.cwd(), '.env') });
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erreur: Variables d\'environnement manquantes');
  console.error('   SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_URL requis');
  console.error('   SUPABASE_SERVICE_ROLE_KEY requis (clé service_role)');
  console.error('\n💡 Vérifiez que .env.local contient:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co');
  console.error('   SUPABASE_SERVICE_ROLE_KEY=eyJ...');
  console.error('\n   Exécutez depuis la racine du projet: npm run make-super-admin <email>');
  process.exit(1);
}

// Utiliser la clé service_role pour les opérations admin
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function makeSuperAdmin(identifier) {
  console.log('🔐 Promotion d\'un utilisateur en SUPER_ADMIN_GROUP...\n');

  try {
    // Déterminer si c'est un email ou un UUID
    const isEmail = identifier.includes('@');
    let userId = null;

    if (isEmail) {
      console.log(`📧 Recherche de l'utilisateur par email: ${identifier}`);
      
      // Chercher l'utilisateur par email dans auth.users
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
      
      if (authError) throw authError;
      
      const user = authUsers.users.find(u => u.email === identifier);
      
      if (!user) {
        console.error(`❌ Aucun utilisateur trouvé avec l'email: ${identifier}`);
        process.exit(1);
      }
      
      userId = user.id;
      console.log(`✅ Utilisateur trouvé: ${user.email} (${userId})`);
    } else {
      // C'est probablement un UUID
      userId = identifier;
      console.log(`🔍 Utilisation de l'UUID fourni: ${userId}`);
      
      // Vérifier que l'utilisateur existe
      const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
      
      if (authError || !authUser) {
        console.error(`❌ Aucun utilisateur trouvé avec l'UUID: ${userId}`);
        process.exit(1);
      }
      
      console.log(`✅ Utilisateur trouvé: ${authUser.user.email} (${userId})`);
    }

    // Vérifier si l'utilisateur existe dans la table users
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    if (!existingUser) {
      console.log('⚠️  L\'utilisateur n\'existe pas dans la table users. Création...');
      
      // Récupérer l'email depuis auth.users
      const { data: authUser } = await supabase.auth.admin.getUserById(userId);
      
      if (!authUser) {
        throw new Error('Impossible de récupérer les informations de l\'utilisateur');
      }

      // Créer l'entrée dans la table users
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: userId,
          email: authUser.user.email || identifier,
          role: 'SUPER_ADMIN_GROUP',
          entity_id: null, // Super admin voit toutes les entités
          is_active: true,
        });

      if (insertError) throw insertError;
      
      console.log('✅ Utilisateur créé dans la table users avec le rôle SUPER_ADMIN_GROUP');
    } else {
      console.log(`📋 Utilisateur actuel: ${existingUser.email}`);
      console.log(`   Rôle actuel: ${existingUser.role}`);
      console.log(`   Entité: ${existingUser.entity_id || 'Aucune (Super Admin)'}`);
      
      // Mettre à jour le rôle
      const { error: updateError } = await supabase
        .from('users')
        .update({
          role: 'SUPER_ADMIN_GROUP',
          entity_id: null, // Super admin voit toutes les entités
          is_active: true,
        })
        .eq('id', userId);

      if (updateError) throw updateError;
      
      console.log('✅ Utilisateur promu en SUPER_ADMIN_GROUP');
    }

    // Vérifier la mise à jour
    const { data: updatedUser, error: verifyError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (verifyError) throw verifyError;

    console.log('\n✨ Opération terminée avec succès!');
    console.log('\n📊 Informations de l\'utilisateur:');
    console.log(`   Email: ${updatedUser.email}`);
    console.log(`   Rôle: ${updatedUser.role}`);
    console.log(`   Entité: ${updatedUser.entity_id || 'Aucune (accès à toutes les entités)'}`);
    console.log(`   Actif: ${updatedUser.is_active ? 'Oui' : 'Non'}`);
    console.log('\n💡 L\'utilisateur peut maintenant se connecter avec les privilèges de SUPER_ADMIN_GROUP');

  } catch (error) {
    console.error('❌ Erreur lors de la promotion:', error.message);
    console.error('\n💡 Vérifiez que:');
    console.error('   - La clé SUPABASE_SERVICE_ROLE_KEY est correcte (service_role, pas anon)');
    console.error('   - L\'utilisateur existe dans Supabase Auth');
    console.error('   - Vous avez les permissions nécessaires');
    process.exit(1);
  }
}

// Récupérer l'argument de la ligne de commande
const identifier = process.argv[2];

if (!identifier) {
  console.error('❌ Erreur: Identifiant manquant');
  console.error('\nUsage:');
  console.error('   node scripts/make-super-admin.js <email>');
  console.error('   node scripts/make-super-admin.js <user_id>');
  console.error('\nExemples:');
  console.error('   node scripts/make-super-admin.js nicolianza@isirogroup.com');
  console.error('   node scripts/make-super-admin.js 44a58f57-9eaa-4ec6-bd03-0bc997890761');
  process.exit(1);
}

makeSuperAdmin(identifier);

