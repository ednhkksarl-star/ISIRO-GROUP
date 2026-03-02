# Guide de Démarrage Rapide - ISIRO GROUP

## 🚀 Démarrage en 5 minutes

### 1. Installation

```bash
# Installer les dépendances
npm install
```

### 2. Configuration Supabase

1. Créer un projet sur [supabase.com](https://supabase.com)
2. Exécuter le script SQL dans `supabase/schema.sql`
3. Créer un bucket de stockage nommé `documents`
4. Noter l'URL et la clé anonyme

### 3. Variables d'environnement

Créer un fichier `.env.local` :

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Créer le premier utilisateur

1. Aller dans Supabase Dashboard → Authentication → Users
2. Créer un utilisateur avec email/mot de passe
3. Noter l'UUID de l'utilisateur
4. Aller dans Table Editor → users
5. Insérer :
   ```sql
   INSERT INTO users (id, email, role, is_active)
   VALUES ('<uuid>', 'admin@isiro.com', 'SUPER_ADMIN_GROUP', true);
   ```

### 5. Lancer l'application

```bash
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000)

## 📱 Créer les icônes PWA

Les icônes PWA doivent être créées et placées dans `public/icons/` :

- icon-72x72.png
- icon-96x96.png
- icon-128x128.png
- icon-144x144.png
- icon-152x152.png
- icon-192x192.png
- icon-384x384.png
- icon-512x512.png

Vous pouvez utiliser un outil comme [PWA Asset Generator](https://github.com/onderceylan/pwa-asset-generator) pour les générer.

## ✅ Vérification

1. ✅ L'application démarre sans erreur
2. ✅ La connexion fonctionne
3. ✅ Le dashboard s'affiche
4. ✅ Les modules sont accessibles
5. ✅ Les données s'affichent correctement

## 🐛 Dépannage

### Erreur de connexion Supabase
- Vérifier les variables d'environnement
- Vérifier que le projet Supabase est actif

### Erreur RLS
- Vérifier que le schéma SQL a été exécuté
- Vérifier que l'utilisateur existe dans la table `users`

### Erreur de build
- Vérifier Node.js version (18+)
- Supprimer `node_modules` et `package-lock.json`
- Réinstaller : `npm install`

## 📚 Documentation

- [README.md](README.md) - Documentation complète
- [DEPLOYMENT.md](DEPLOYMENT.md) - Guide de déploiement
- [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) - Structure du projet
- [supabase/README.md](supabase/README.md) - Configuration Supabase

## 🎯 Prochaines étapes

1. Personnaliser les couleurs dans `tailwind.config.js`
2. Ajouter votre logo
3. Créer les icônes PWA
4. Configurer un domaine personnalisé
5. Déployer sur Vercel

## 💡 Astuces

- Utilisez le rôle `SUPER_ADMIN_GROUP` pour voir toutes les entités
- Les autres rôles voient uniquement leur entité
- Les permissions sont définies dans `src/constants/permissions.ts`
- Les entités sont définies dans `src/constants/entities.ts`

## 🆘 Support

Pour toute question, consulter la documentation ou créer une issue.

