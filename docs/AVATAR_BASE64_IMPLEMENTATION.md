# Implémentation Base64 pour les Photos de Profil

## Pourquoi Base64 ?

L'utilisation de Base64 pour les photos de profil simplifie grandement l'implémentation :

✅ **Avantages :**
- Pas besoin de configurer Supabase Storage
- Pas de problèmes de permissions RLS
- Pas de problèmes d'URL ou de CORS
- Fonctionne immédiatement sans configuration supplémentaire
- Les images sont stockées directement dans la base de données

⚠️ **Limitations :**
- Taille limitée (recommandé: max 500KB par image)
- Les images sont redimensionnées automatiquement à 400x400px max
- Qualité JPEG à 80% pour réduire la taille

## Fonctionnement

### 1. Upload de Photo

Quand un utilisateur upload une photo :
1. L'image est automatiquement redimensionnée à 400x400px maximum
2. Convertie en JPEG avec une qualité de 80%
3. Encodée en base64 avec le préfixe `data:image/jpeg;base64,...`
4. Stockée directement dans la colonne `avatar_url` de la table `users`

### 2. Affichage

Les images base64 sont affichées directement avec le composant Next.js `Image` :
- Le préfixe `data:image/` est reconnu automatiquement
- Pas besoin de configuration supplémentaire
- Fonctionne sur tous les navigateurs

## Fichiers Modifiés

### Nouveau fichier utilitaire
- `src/utils/imageUtils.ts` : Fonctions de conversion et redimensionnement

### Pages mises à jour
- `src/app/settings/profile/page.tsx` : Page de profil utilisateur
- `src/app/users/[id]/edit/page.tsx` : Édition d'utilisateur
- `src/app/users/new/page.tsx` : Création d'utilisateur

## Fonctions Utilitaires

### `resizeImageToBase64(file, maxWidth, maxHeight, quality)`

Redimensionne une image et la convertit en base64.

**Paramètres :**
- `file` : Le fichier image (File)
- `maxWidth` : Largeur maximale (défaut: 400px)
- `maxHeight` : Hauteur maximale (défaut: 400px)
- `quality` : Qualité JPEG 0-1 (défaut: 0.8)

**Retourne :** `Promise<string>` - Chaîne base64 avec préfixe data URL

**Exemple :**
```typescript
const base64Image = await resizeImageToBase64(file, 400, 400, 0.8);
// Résultat: "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
```

### `fileToBase64(file, maxSizeKB)`

Convertit un fichier en base64 sans redimensionnement (pour fichiers déjà petits).

**Paramètres :**
- `file` : Le fichier image (File)
- `maxSizeKB` : Taille maximale en KB (défaut: 500KB)

### `isBase64Image(str)`

Vérifie si une chaîne est une URL base64 valide.

## Format de Stockage

Les images sont stockées dans la colonne `avatar_url` (TEXT) au format :

```
data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD...
```

## Migration depuis Supabase Storage

Si vous aviez déjà des images dans Supabase Storage, elles continueront de fonctionner car le code vérifie le format de l'URL :
- Si l'URL commence par `data:image/` → Base64 (affichage direct)
- Sinon → URL Supabase Storage (affichage via Image component avec `unoptimized`)

## Performance

- **Taille moyenne** : ~50-100KB par image (après redimensionnement)
- **Temps de conversion** : < 1 seconde pour une image normale
- **Impact base de données** : Minimal, les images sont compressées

## Recommandations

1. **Limiter la taille** : Les images sont automatiquement redimensionnées
2. **Qualité** : 80% est un bon compromis taille/qualité
3. **Format** : JPEG est utilisé pour une meilleure compression
4. **Cache** : Les images base64 sont mises en cache par le navigateur

## Dépannage

### L'image ne s'affiche pas
- Vérifier que la colonne `avatar_url` existe dans la table `users`
- Vérifier que la valeur commence par `data:image/`
- Vérifier la console pour les erreurs

### L'image est trop grande
- Le redimensionnement est automatique (400x400px max)
- La qualité est réduite à 80%
- Si toujours trop grande, réduire `maxSizeKB` dans `fileToBase64`

### Erreur lors de l'upload
- Vérifier que le fichier est bien une image
- Vérifier la taille du fichier original (< 5MB recommandé)
- Vérifier les permissions de la table `users`

