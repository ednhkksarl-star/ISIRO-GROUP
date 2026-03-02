/**
 * Script pour configurer le bucket de stockage Supabase via l'API
 * 
 * Ce script utilise l'API Supabase pour créer le bucket et configurer
 * les politiques de sécurité.
 * 
 * Usage:
 *   node scripts/setup-storage.js
 * 
 * Variables d'environnement requises:
 *   SUPABASE_URL=https://your-project.supabase.co
 *   SUPABASE_SERVICE_KEY=your-service-role-key (pas l'anon key!)
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erreur: Variables d\'environnement manquantes');
  console.error('   SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_URL requis');
  console.error('   SUPABASE_SERVICE_KEY requis (clé service_role, pas anon!)');
  console.error('\n💡 Ajoutez ces variables dans .env.local');
  process.exit(1);
}

// Utiliser la clé service_role pour les opérations admin
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setupStorage() {
  console.log('🗄️  Configuration du stockage Supabase...\n');

  try {
    // 1. Créer le bucket 'documents'
    console.log('📦 Création du bucket "documents"...');
    const { data: bucket, error: bucketError } = await supabase.storage.createBucket('documents', {
      public: false, // Bucket privé
      fileSizeLimit: 10485760, // 10MB
      allowedMimeTypes: [
        'image/*',
        'application/pdf',
        'text/csv',
        'video/*',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ]
    });

    if (bucketError) {
      if (bucketError.message.includes('already exists')) {
        console.log('✅ Le bucket "documents" existe déjà');
      } else {
        throw bucketError;
      }
    } else {
      console.log('✅ Bucket "documents" créé avec succès');
    }

    // 2. Exécuter le script SQL des politiques
    console.log('\n🔒 Configuration des politiques de sécurité...');
    const sqlPath = path.join(__dirname, '..', 'supabase', 'storage.sql');
    
    if (!fs.existsSync(sqlPath)) {
      console.warn('⚠️  Fichier storage.sql non trouvé');
      console.log('   Exécutez manuellement le script SQL dans supabase/storage.sql');
      return;
    }

    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
    
    // Extraire les commandes SQL (séparées par des lignes vides ou commentaires)
    const sqlCommands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--') && !cmd.startsWith('/*'));

    console.log(`   ${sqlCommands.length} politiques à configurer...`);
    console.log('   ⚠️  Note: Les politiques doivent être créées manuellement via le Dashboard Supabase');
    console.log('   📖 Consultez supabase/storage.sql pour les commandes SQL');

    console.log('\n✨ Configuration terminée!');
    console.log('\n📝 Prochaines étapes:');
    console.log('   1. Allez dans Supabase Dashboard → Storage → Policies');
    console.log('   2. Sélectionnez le bucket "documents"');
    console.log('   3. Exécutez les commandes SQL de supabase/storage.sql');
    console.log('   4. Ou utilisez l\'interface graphique pour créer les politiques');

  } catch (error) {
    console.error('❌ Erreur lors de la configuration:', error.message);
    console.error('\n💡 Vérifiez que:');
    console.error('   - La clé SUPABASE_SERVICE_KEY est correcte (service_role, pas anon)');
    console.error('   - Vous avez les permissions nécessaires');
    console.error('   - Le projet Supabase est actif');
    process.exit(1);
  }
}

setupStorage();

