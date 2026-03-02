# ISIRO GROUP - Holding Management Platform

Plateforme de gestion centralisée pour la holding ISIRO GROUP, permettant la gestion multi-filiales avec séparation complète des données par entité.

## 🏢 Entités gérées

- **CBI**
- **CEMC**
- **ABS**
- **ATSWAY**
- **KWILU SCOOPS**
- **JUDO**

## 🚀 Stack Technique

- **Frontend**: Next.js 14 (App Router) + React 18 + TypeScript
- **Backend**: Supabase (PostgreSQL, Auth, Storage, RLS)
- **Déploiement**: Vercel
- **UI**: Tailwind CSS
- **PWA**: next-pwa

## 📋 Fonctionnalités

### Modules par entité

1. **Facturation**
   - Création de devis et factures
   - Numérotation automatique par entité
   - Gestion clients/fournisseurs
   - Statuts (brouillon, payée, impayée)
   - Export PDF & CSV
   - Historique des paiements

2. **Comptabilité**
   - Journal comptable simplifié
   - Écritures (Débit/Crédit)
   - Calcul automatique du solde
   - Filtrage et recherche
   - Export CSV

3. **Dépenses/Charges**
   - CRUD complet
   - Catégories (Loyer, Salaires, Transport, etc.)
   - Upload de justificatifs
   - Workflow de validation
   - Historique

4. **Gestion Administrative**
   - Tâches
   - Notes internes
   - Réunions
   - Suivi de contrats

5. **Courriers**
   - Types : Entrant, Sortant, Interne
   - Workflow complet (Enregistrement → Archivage)
   - Numérotation automatique
   - Affectation et suivi

6. **Archivage & GED**
   - Upload de fichiers (PDF, images, vidéos, CSV)
   - Capture photo mobile
   - Classement par entité/module/année
   - Recherche avancée

### Dashboard Groupe

- KPIs par entité
- Vue consolidée ISIRO GROUP
- Graphiques (Revenus, Dépenses, Résultat)
- Filtres par période

### Authentification & Sécurité

- Email + mot de passe (Supabase Auth)
- Sessions persistantes
- RBAC avec 6 rôles :
  - `SUPER_ADMIN_GROUP`
  - `ADMIN_ENTITY`
  - `ACCOUNTANT`
  - `SECRETARY`
  - `AUDITOR`
  - `READ_ONLY`
- Row Level Security (RLS) sur toutes les tables
- Permissions par entité, module et action

### PWA

- Installable sur Android & iOS
- Mode offline partiel
- Service Worker
- Manifest.json

## 🛠️ Installation

### Prérequis

- Node.js 18+
- Compte Supabase
- Compte Vercel (pour le déploiement)

### Étapes

1. **Cloner le projet**

```bash
git clone <repository-url>
cd isiro-group
```

2. **Installer les dépendances**

```bash
npm install
```

3. **Configurer les variables d'environnement**

Créer un fichier `.env.local` :

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. **Configurer Supabase**

- Créer un projet Supabase
- Exécuter le script SQL dans `supabase/schema.sql` via l'éditeur SQL de Supabase
- Configurer le storage :
  ```bash
  # Ajouter SUPABASE_SERVICE_KEY dans .env.local
  npm run setup-storage
  ```
  Ou suivre le guide manuel dans `supabase/STORAGE_SETUP.md`

5. **Créer le premier utilisateur (Super Admin)**

**Méthode A - Via Script (Recommandé):**
```bash
# Créer l'utilisateur dans Supabase Dashboard → Authentication → Users
# Puis exécuter:
npm run make-super-admin nicolianza@isirogroup.com
```

**Méthode B - Manuellement:**
- Aller dans Authentication → Users
- Créer un nouvel utilisateur
- Aller dans Table Editor → users
- Ajouter une entrée avec :
  - `id` : l'UUID de l'utilisateur créé
  - `email` : l'email de l'utilisateur
  - `role` : `SUPER_ADMIN_GROUP`
  - `entity_id` : `NULL` (pour super admin)
  - `is_active` : `true`

**Méthode C - Via SQL:**
Exécuter le script `supabase/make-super-admin.sql` dans l'éditeur SQL

6. **Lancer l'application en développement**

```bash
npm run dev
```

L'application sera accessible sur `http://localhost:3000`

## 📦 Déploiement sur Vercel

1. **Préparer le projet**

```bash
npm run build
```

2. **Déployer sur Vercel**

- Connecter votre repository GitHub à Vercel
- Ajouter les variables d'environnement dans Vercel :
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_APP_URL` (URL de production)

3. **Configurer le domaine**

- Ajouter votre domaine personnalisé dans Vercel
- Mettre à jour `NEXT_PUBLIC_APP_URL` avec le nouveau domaine

## 🗄️ Structure de la base de données

Le schéma SQL complet est disponible dans `supabase/schema.sql`. Il inclut :

- Tables principales (entities, users, invoices, expenses, etc.)
- Indexes pour les performances
- Fonctions SQL (génération de numéros, calculs)
- Triggers (updated_at automatique)
- Row Level Security (RLS) avec policies par rôle

## 🔐 Sécurité

- **Row Level Security (RLS)** activé sur toutes les tables
- **Policies** définies par rôle et par entité
- **Audit logs** pour tracer toutes les actions
- **Validation** côté client et serveur
- **HTTPS** obligatoire en production

## 📱 PWA

L'application est installable comme une PWA :

- **Android** : Via le navigateur Chrome
- **iOS** : Via Safari (ajouter à l'écran d'accueil)

Le mode offline permet :
- Consultation des données en cache
- Création de brouillons
- Synchronisation automatique lors de la reconnexion

## 🧪 Développement

### Structure du projet

```
src/
├── app/              # Pages Next.js (App Router)
│   ├── auth/         # Authentification
│   ├── dashboard/    # Dashboard
│   ├── billing/      # Facturation
│   ├── accounting/   # Comptabilité
│   ├── expenses/     # Dépenses
│   ├── administration/ # Administration
│   ├── courriers/    # Courriers
│   └── archives/     # Archives
├── components/        # Composants React
├── hooks/            # Hooks personnalisés
├── services/         # Services (Supabase)
├── utils/            # Utilitaires
├── constants/        # Constantes
└── types/            # Types TypeScript
```

### Commandes disponibles

```bash
npm run dev          # Développement
npm run build        # Build de production
npm run start        # Démarrer en production
npm run lint         # Linter
npm run type-check   # Vérification TypeScript
```

## 📝 Notes importantes

- **Pas de backend séparé** : Toute la logique est dans React + Supabase
- **Multi-tenant** : Chaque entité a ses propres données isolées
- **Scalable** : Architecture prête pour la croissance
- **Production-ready** : Code testé et optimisé

## 🤝 Support

Pour toute question ou problème, contactez l'équipe de développement.

## 📄 Licence

Propriétaire - ISIRO GROUP © 2024

