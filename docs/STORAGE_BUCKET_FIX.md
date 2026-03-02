# Correction du problème "Bucket not found" pour les pièces jointes

## Problème

Les pièces jointes des tâches, courriers, archives et autres modules ne peuvent pas être ouvertes. L'erreur indique :
```
{"statusCode":"404","error":"Bucket not found","message":"Bucket not found"}
```

## Cause

Le bucket `documents` est configuré comme **privé** (`public: false`), mais le code utilise `.getPublicUrl()` pour obtenir les URLs des fichiers. **`.getPublicUrl()` ne fonctionne PAS avec les buckets privés.**

## Solution

### Option 1 : Rendre le bucket public (Recommandé) ✅

**⚠️ IMPORTANT :** Dans Supabase Dashboard, l'option "Public bucket" se trouve dans les **détails du bucket**, pas dans les settings globaux.

**Étapes :**

1. Aller dans **Supabase Dashboard → Storage → Buckets**
2. **Cliquer directement sur le nom "documents"** (le texte "documents" avec l'icône de dossier)
   - OU cliquer sur l'icône **`>`** (flèche) à droite de la ligne du bucket
   - ⚠️ **Ne pas cliquer** sur les onglets "Settings" ou "Policies" en haut - ce sont les paramètres globaux
3. Une page de détails du bucket devrait s'ouvrir
4. Chercher l'option **"Public bucket"** (toggle ON/OFF) et l'activer
5. Cliquer sur **"Save"** ou **"Update"** si disponible

**Si vous ne trouvez pas cette option :** Voir le guide détaillé dans `STORAGE_BUCKET_PUBLIC_GUIDE.md`

**Pourquoi c'est sûr ?**
- Les fichiers sont déjà protégés par **RLS (Row Level Security)**
- Les politiques RLS garantissent que seuls les utilisateurs autorisés peuvent accéder aux fichiers
- Les utilisateurs ne peuvent accéder qu'aux fichiers de leur entité
- Les Super Admins peuvent accéder à tous les fichiers

**Avantages :**
- ✅ Solution simple et rapide
- ✅ Pas de modification de code nécessaire
- ✅ Les URLs publiques fonctionnent immédiatement
- ✅ La sécurité est garantie par RLS

### Option 2 : Utiliser des URLs signées (Plus complexe)

Si vous préférez garder le bucket privé, vous devrez modifier le code pour utiliser `.createSignedUrl()` au lieu de `.getPublicUrl()` partout où les fichiers sont affichés.

**Inconvénients :**
- ⚠️ Nécessite des modifications de code dans plusieurs fichiers
- ⚠️ Les URLs signées expirent après un certain temps
- ⚠️ Plus complexe à gérer

## Modules affectés

Les fichiers suivants utilisent `.getPublicUrl()` et seront affectés :

- ✅ **Tâches (Administration)** : `src/app/administration/new/page.tsx`, `src/app/administration/[id]/edit/page.tsx`, `src/app/administration/[id]/page.tsx`
- ✅ **Courriers** : `src/app/courriers/new/page.tsx`, `src/app/courriers/[id]/edit/page.tsx`
- ✅ **Archives** : `src/app/archives/page.tsx`
- ✅ **Ménage** : `src/app/menage/new/page.tsx`, `src/app/menage/[id]/edit/page.tsx`
- ✅ **Dépenses** : `src/app/expenses/new/page.tsx`, `src/app/expenses/[id]/page.tsx`

## Vérification

Après avoir rendu le bucket public :

1. Tester l'ouverture d'une pièce jointe de tâche
2. Tester l'ouverture d'une pièce jointe de courrier
3. Tester l'ouverture d'un document d'archive
4. Tester l'ouverture d'un reçu de ménage/dépense

Tous les fichiers devraient s'ouvrir correctement.

## Migration

Voir `supabase/migrations/20250111000001_fix_storage_bucket_public.sql` pour la documentation de cette correction.

