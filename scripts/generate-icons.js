/**
 * Script pour générer les icônes PWA
 * Utilise sharp pour créer des icônes PNG à partir du logo logo_isiro.png
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Chemin vers le logo source
const logoPath = path.join(__dirname, '..', 'public', 'logo_isiro.png');

// Tailles d'icônes requises
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Créer le dossier icons s'il n'existe pas
const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Générer chaque icône
async function generateIcons() {
  console.log('🎨 Génération des icônes PWA à partir du logo...\n');

  // Vérifier que le logo existe
  if (!fs.existsSync(logoPath)) {
    console.error(`❌ Erreur: Le fichier logo_isiro.png n'existe pas dans ${path.dirname(logoPath)}`);
    process.exit(1);
  }

  console.log(`📸 Logo source: ${logoPath}\n`);

  for (const size of sizes) {
    try {
      const outputPath = path.join(iconsDir, `icon-${size}x${size}.png`);
      
      await sharp(logoPath)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 } // Fond transparent
        })
        .png()
        .toFile(outputPath);

      console.log(`✅ Généré: icon-${size}x${size}.png`);
    } catch (error) {
      console.error(`❌ Erreur lors de la génération de icon-${size}x${size}.png:`, error.message);
    }
  }

  console.log('\n✨ Toutes les icônes ont été générées avec succès!');
  console.log(`📁 Emplacement: ${iconsDir}`);
}

// Exécuter
generateIcons().catch(console.error);

