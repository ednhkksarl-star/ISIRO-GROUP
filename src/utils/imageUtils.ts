/**
 * Utilitaires pour la gestion des images
 * Conversion en base64 pour stockage direct dans la base de données
 */

/**
 * Convertit un fichier image en base64
 * @param file - Le fichier image à convertir
 * @param maxSizeKB - Taille maximale en KB (défaut: 500KB)
 * @returns Promise<string> - La chaîne base64 avec le préfixe data URL
 */
export async function fileToBase64(
  file: File,
  maxSizeKB: number = 500
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Vérifier la taille du fichier
    const fileSizeKB = file.size / 1024;
    if (fileSizeKB > maxSizeKB) {
      reject(
        new Error(
          `L'image est trop grande (${fileSizeKB.toFixed(0)}KB). Maximum: ${maxSizeKB}KB`
        )
      );
      return;
    }

    // Vérifier le type de fichier
    if (!file.type.startsWith('image/')) {
      reject(new Error('Le fichier doit être une image'));
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };

    reader.onerror = () => {
      reject(new Error('Erreur lors de la lecture du fichier'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Redimensionne une image avant conversion en base64
 * Utile pour réduire la taille des images
 * @param file - Le fichier image
 * @param maxWidth - Largeur maximale (défaut: 400px)
 * @param maxHeight - Hauteur maximale (défaut: 400px)
 * @param quality - Qualité JPEG (0-1, défaut: 0.8)
 * @returns Promise<string> - La chaîne base64 redimensionnée
 */
export async function resizeImageToBase64(
  file: File,
  maxWidth: number = 400,
  maxHeight: number = 400,
  quality: number = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Calculer les nouvelles dimensions
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = width * ratio;
          height = height * ratio;
        }

        // Créer un canvas pour redimensionner
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Impossible de créer le contexte canvas'));
          return;
        }

        // Dessiner l'image redimensionnée
        ctx.drawImage(img, 0, 0, width, height);

        // Convertir en base64
        const base64 = canvas.toDataURL('image/jpeg', quality);
        resolve(base64);
      };

      img.onerror = () => {
        reject(new Error('Erreur lors du chargement de l\'image'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Erreur lors de la lecture du fichier'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Vérifie si une chaîne est une URL base64 valide
 */
export function isBase64Image(str: string): boolean {
  return str.startsWith('data:image/');
}

