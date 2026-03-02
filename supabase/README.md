# Configuration Supabase

Ce dossier contient les scripts SQL pour configurer la base de données Supabase.

## Installation

1. **Créer un projet Supabase**
   - Aller sur [supabase.com](https://supabase.com)
   - Créer un nouveau projet
   - Noter l'URL du projet et la clé anonyme

2. **Exécuter le schéma SQL**
   - Aller dans l'éditeur SQL de Supabase
   - Copier le contenu de `schema.sql`
   - Exécuter le script complet

3. **Configurer le Storage**
   
   **Option A - Via Script (Recommandé)**
   ```bash
   # Ajouter dans .env.local :
   SUPABASE_SERVICE_KEY=votre-service-role-key
   
   # Exécuter le script
   npm run setup-storage
   ```
   
   **Option B - Manuellement**
   - Aller dans Storage → Buckets
   - Créer un nouveau bucket nommé `documents`
   - Configurer les paramètres :
     - Public: false (privé)
     - File size limit: 10MB
     - Allowed MIME types: image/*, application/pdf, text/csv, video/*
   - Exécuter le script SQL `supabase/storage.sql` dans l'éditeur SQL pour créer les politiques RLS

4. **Créer le premier utilisateur**
   - Aller dans Authentication → Users
   - Créer un nouvel utilisateur avec email/mot de passe
   - Noter l'UUID de l'utilisateur
   - Aller dans Table Editor → users
   - Insérer une ligne :
     ```sql
     INSERT INTO users (id, email, role, is_active)
     VALUES ('<uuid>', 'admin@isiro.com', 'SUPER_ADMIN_GROUP', true);
     ```

5. **Configurer les variables d'environnement**
   - Créer un fichier `.env.local` à la racine du projet
   - Ajouter :
     ```
     NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
     NEXT_PUBLIC_APP_URL=http://localhost:3000
     ```

## Structure de la base de données

- **entities** : Les filiales (CBI, CEMC, ABS, etc.)
- **users** : Utilisateurs avec rôles et permissions
- **invoices** : Factures et devis
- **invoice_items** : Lignes de facture
- **payments** : Paiements
- **accounting_entries** : Écritures comptables
- **expenses** : Dépenses et charges
- **tasks** : Tâches administratives
- **mail_items** : Courriers
- **documents** : Archives et GED
- **audit_logs** : Logs d'audit

## Sécurité

Toutes les tables ont Row Level Security (RLS) activé avec des politiques définies par rôle et par entité.

Les utilisateurs ne peuvent accéder qu'aux données de leur entité (sauf SUPER_ADMIN_GROUP qui voit tout).

