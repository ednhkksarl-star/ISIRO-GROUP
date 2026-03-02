# Guide de Déploiement - ISIRO GROUP

Ce guide détaille les étapes pour déployer l'application ISIRO GROUP sur Vercel.

## Prérequis

- Compte GitHub
- Compte Supabase
- Compte Vercel

## Étapes de déploiement

### 1. Préparer Supabase

1. Créer un projet Supabase
2. Exécuter le script SQL (`supabase/schema.sql`)
3. Créer le bucket de stockage `documents`
4. Noter les credentials :
   - URL du projet
   - Clé anonyme (anon key)

### 2. Préparer le code

1. Pousser le code sur GitHub
2. S'assurer que tous les fichiers sont commités

### 3. Déployer sur Vercel

1. Aller sur [vercel.com](https://vercel.com)
2. Cliquer sur "New Project"
3. Importer le repository GitHub
4. Configurer le projet :
   - Framework Preset: Next.js
   - Root Directory: ./
   - Build Command: `npm run build`
   - Output Directory: `.next`
5. Ajouter les variables d'environnement :
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
   ```
6. Cliquer sur "Deploy"

### 4. Post-déploiement

1. Vérifier que l'application fonctionne
2. Créer le premier utilisateur via Supabase Dashboard
3. Tester l'authentification
4. Configurer un domaine personnalisé (optionnel)

## Configuration du domaine personnalisé

1. Dans Vercel, aller dans Settings → Domains
2. Ajouter votre domaine
3. Suivre les instructions DNS
4. Mettre à jour `NEXT_PUBLIC_APP_URL` avec le nouveau domaine

## Variables d'environnement

### Production

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### Développement

Créer un fichier `.env.local` :

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Dépannage

### Erreur de build

- Vérifier que toutes les dépendances sont dans `package.json`
- Vérifier les imports et les chemins de fichiers
- Vérifier la configuration TypeScript

### Erreurs d'authentification

- Vérifier les variables d'environnement
- Vérifier la configuration Supabase
- Vérifier les policies RLS

### Erreurs de storage

- Vérifier que le bucket `documents` existe
- Vérifier les politiques de stockage
- Vérifier les permissions

## Support

Pour toute question, consulter la documentation :
- [Next.js](https://nextjs.org/docs)
- [Supabase](https://supabase.com/docs)
- [Vercel](https://vercel.com/docs)

