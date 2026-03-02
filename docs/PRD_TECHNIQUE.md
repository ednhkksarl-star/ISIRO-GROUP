# PRD Technique — Plateforme de gestion centralisée ISIRO GROUP

**Version:** 1.0  
**Date:** Février 2026  
**Statut:** Document de référence technique

---

## 1. Vue d’ensemble

### 1.1 Objectif produit

Application web de type **ERP** pour la holding **ISIRO GROUP**, permettant la gestion multi-entités (filiales) : facturation, livre de caisse, dépenses, administration, courriers, archives, répertoire de contacts, ménage, utilisateurs et rôles, le tout sécurisé par authentification et permissions par rôle et par entité.

### 1.2 Cibles

- **Super Admin Groupe** : vue consolidée, gestion des entités et des utilisateurs.
- **Admin Entité** : gestion complète d’une ou plusieurs entités, sans suppression sur certains modules.
- **Manager Entité, Comptable, Secrétaire, Auditeur, Lecture seule** : accès différencié par module (CRUD, export, approbation selon le rôle).

### 1.3 Principes techniques

- **Multi-entité** : la plupart des données sont scopées par `entity_id` ; le contexte (entité sélectionnée ou `?entity=`) détermine les données affichées.
- **RLS (Row Level Security)** : toutes les tables métier sont protégées par des politiques Supabase basées sur `can_access_entity(auth.uid(), entity_id)` et le rôle.
- **Design système** : couleurs (primary #00A896, primary-dark #00897B), typo Poppins, composants réutilisables (Button, Card, Input, Modals, Pagination).

---

## 2. Stack technique

| Couche | Technologie |
|--------|-------------|
| Framework | Next.js 14 (App Router) |
| Langage | TypeScript |
| UI | React 18, Tailwind CSS, lucide-react |
| State / Data | React (useState, useEffect), Supabase client-side |
| Auth | Supabase Auth (email/password), @supabase/auth-helpers-nextjs |
| BDD | Supabase (PostgreSQL) |
| Stockage fichiers | Supabase Storage (buckets publics/privés) |
| PDF | jsPDF, jspdf-autotable |
| Graphiques | Recharts |
| Formulaires | react-hook-form, zod (@hookform/resolvers) |
| PWA | next-pwa (service worker, manifest) |
| Hébergement | Vercel (production) |

### 2.1 Variables d’environnement

- `NEXT_PUBLIC_SUPABASE_URL` : URL du projet Supabase  
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` : clé anon  
- `SUPABASE_SERVICE_ROLE_KEY` : clé service (scripts, API server-side)  
- `NEXT_PUBLIC_APP_URL` : URL de l’app (ex. `http://localhost:3000` ou URL Vercel)

---

## 3. Architecture applicative

### 3.1 Structure des dossiers (principale)

```
src/
├── app/                    # App Router Next.js
│   ├── layout.tsx          # Layout racine (Providers, ToastContainer)
│   ├── page.tsx            # Redirection vers /splash ou /dashboard
│   ├── globals.css         # Design system (variables CSS, Polices)
│   ├── auth/login/         # Connexion
│   ├── splash/             # Écran de chargement initial
│   ├── dashboard/          # Dashboard (consolidé ou entité)
│   ├── billing/            # Facturation (liste, new, [id], [id]/edit)
│   ├── accounting/         # Livre de caisse (liste, new, [id], [id]/edit)
│   ├── expenses/           # Dépenses
│   ├── administration/     # Tâches / Administration
│   ├── courriers/          # Services courriers (mail)
│   ├── archives/           # Archives / GED
│   ├── repertoire/         # Répertoire (onglets clients, fournisseurs, partenaires, collaborateurs)
│   ├── clients/, suppliers/, partenaires/, collaborateurs/  # CRUD Répertoire
│   ├── entities/           # Liste entités + [id] dashboard entité
│   ├── users/              # Gestion utilisateurs (super admin / admin entity)
│   ├── roles/              # Gestion rôles
│   ├── menage/             # Module ménage (budgets, dépenses ménage)
│   ├── settings/           # Paramètres (profil, sécurité, taux de change)
│   └── api/                # API Routes (ex. users/create, users/delete)
├── components/
│   ├── layout/             # AppLayout, Header, Sidebar, BottomNav
│   ├── providers/          # Providers (Auth context)
│   ├── entity/             # EntitySelector
│   ├── ui/                 # Button, Card, Input, Modal, Pagination, Badge, etc.
│   ├── mail/               # UserAssignmentModal
│   └── wrappers/            # SearchParamsWrapper (Suspense + useSearchParams)
├── hooks/                  # useEntity, useEntityContext, useExchangeRate, useModal, useSmartDataFilter
├── services/                # supabaseClient (createSupabaseClient, createSupabaseServerClient)
├── constants/               # permissions (ROLE_PERMISSIONS, hasPermission), entities
├── types/                   # database.types.ts (Database, UserRole, EntityCode, tables)
├── utils/                   # cn, entityHelpers, imageUtils, generateInvoicePDF, generateAccountingPDF
└── middleware.ts           # Protection routes, redirections auth
```

### 3.2 Flux d’authentification et de contexte

1. **Splash** (`/splash`) : affichage court puis redirection vers `/dashboard` si session valide et profil actif, sinon `/auth/login`.
2. **Login** (`/auth/login`) : `signInWithPassword` Supabase, vérification du profil en table `users` (existence, `is_active`), puis redirection `/dashboard`.
3. **Providers** : `Providers` enveloppe l’app, expose `useAuth()` (user, profile, loading, signOut, refreshProfile). Le profil est chargé depuis la table `users` après `getSession()`.
4. **Contexte entité** : `useEntity()` (selectedEntityId, setSelectedEntityId, isGroupView) ; synchronisation avec `?entity=` en URL sur les pages concernées.
5. **Middleware** : vérifie la session Supabase ; redirige vers `/auth/login` sur routes protégées si non connecté, et vers `/dashboard` si connecté sur `/auth/login`.

### 3.3 Règles d’accès aux données (entité)

- **SUPER_ADMIN_GROUP / ADMIN_ENTITY** :  
  - Si une entité est sélectionnée (contexte ou `?entity=`) → filtre `entity_id = uuid`.  
  - Sinon (vue groupe) → pas de filtre (toutes les entités).
- **Autres rôles** : filtre par `profile.entity_id` ou `profile.entity_ids` (normalisés en UUIDs).
- Si aucun contexte valide : requête vide (ex. `entity_id = '00000000-0000-0000-0000-000000000000'`).

Les politiques RLS en base réutilisent une fonction `can_access_entity(p_user_id, p_entity_id)` (SECURITY DEFINER) qui s’appuie sur le rôle et les champs `entity_id` / `entity_ids` de la table `users`.

---

## 4. Modules fonctionnels (spécification technique)

### 4.1 Dashboard

- **Routes** : `/dashboard`.
- **Données** : factures (payées), écritures comptables (entrées/sorties), dépenses, courriers ; agrégations par entité et mensuelles.
- **Logique** : entrées = factures payées + entrées livre de caisse ; sorties = dépenses + sorties livre de caisse ; résultat net = entrées − sorties.
- **UI** : cartes KPI (Entrées, Dépenses, Résultat net, Factures), graphiques Recharts (évolution mensuelle, entrées par entité).
- **Export** : aucun.

### 4.2 Facturation (Billing)

- **Routes** : `/billing`, `/billing/new`, `/billing/[id]`, `/billing/[id]/edit`.
- **Tables** : `invoices`, `invoice_items`, `payments`.
- **Fonctionnalités** : CRUD, numérotation auto (RPC), statuts (draft, sent, paid, overdue, cancelled), lignes de facture, TVA et taxes additionnelles, devise USD/CDF, export PDF (generateInvoicePDF).
- **Design PDF** : logo/header entité, filigrane optionnel, couleurs design system.

### 4.3 Livre de caisse (Accounting)

- **Routes** : `/accounting`, `/accounting/new`, `/accounting/[id]`, `/accounting/[id]/edit`.
- **Table** : `accounting_entries` (entry_number, entry_date, code, description, numero_piece, debit, credit, entrees, sorties, balance, currency, reference_type, reference_id, entity_id).
- **Fonctionnalités** : CRUD, filtres avancés (dates, code, type entrées/sorties, montants), recherche texte, pagination, solde total, export CSV, **export PDF** (generateAccountingPDF — paysage, tableau autoTable, couleurs primary/success/error, entête entité et période).

### 4.4 Dépenses (Expenses)

- **Routes** : `/expenses`, `/expenses/new`, `/expenses/[id]`.
- **Table** : `expenses` (catégories, montants, justificatifs, workflow approbation).
- **Stockage** : Supabase Storage pour les pièces jointes.

### 4.5 Administration (Tâches)

- **Routes** : `/administration`, `/administration/new`, `/administration/[id]`, `/administration/[id]/edit`.
- **Table** : `tasks` (titre, description, priorité, statut, date d’échéance, assignation, pièces jointes).
- **UI** : vue Kanban et liste, filtres par statut/priorité/assigné.

### 4.6 Services courriers (Mail)

- **Routes** : `/courriers`, `/courriers/new`, `/courriers/[id]`, `/courriers/[id]/edit`.
- **Table** : `mail_items` (type entrant/sortant/interne, statut, numérotation, affectation).
- **Stockage** : documents liés dans Storage.

### 4.7 Archives (GED)

- **Route** : `/archives`.
- **Table** : `documents` (module, année, métadonnées).
- **Fonctionnalités** : upload, recherche, filtres par module/année.

### 4.8 Répertoire

- **Route principale** : `/repertoire` (onglets : Clients, Fournisseurs, Partenaires, Collaborateurs).
- **Tables** : `clients`, `suppliers`, `partners`, `collaborators` (champs communs : entity_id, name, phone, email, address, notes, is_active, created_by, created_at, updated_at ; `collaborators` en plus : role_position).
- **CRUD** : `/clients/new`, `/clients/[id]`, `/clients/[id]/edit` ; idem pour `/suppliers`, `/partenaires`, `/collaborateurs`.
- **Fonctionnalités** : liste par onglet, recherche (nom, email, téléphone, fonction pour collaborateurs), pagination, filtre par entité (contexte ou `?entity=`), uniquement `is_active = true`, tri par nom.

### 4.9 Entités

- **Routes** : `/entities`, `/entities/[id]` (dashboard par entité).
- **Table** : `entities` (id, code, name, logo_url, header_url, watermark_url, footer_text, office_address, contacts).
- **Dashboard entité** : cartes de navigation (Facturation, Livre de caisse, Administration, Courriers, Répertoire, Archives, Paramètres), KPIs (Entrées, Sorties, Résultat net, Factures, Écritures, Tâches, Courriers), graphiques (évolution mensuelle, entrées vs sorties).

### 4.10 Utilisateurs

- **Routes** : `/users`, `/users/new`, `/users/[id]`, `/users/[id]/edit`.
- **Table** : `users` (id = auth.uid(), email, full_name, role, entity_id, entity_ids, avatar_url, is_active, created_at, updated_at).
- **Rôles** : SUPER_ADMIN_GROUP, ADMIN_ENTITY, ACCOUNTANT, SECRETARY, AUDITOR, MANAGER_ENTITY, READ_ONLY (et rôles dynamiques via table `roles`).
- **Script** : `npm run make-super-admin <email>` pour créer/promouvoir un utilisateur en SUPER_ADMIN_GROUP (utilise SUPABASE_SERVICE_ROLE_KEY).

### 4.11 Rôles

- **Route** : `/roles`.
- **Table** : `roles` (code, label, description, is_active). Les permissions par module sont définies en dur dans `constants/permissions.ts` (ROLE_PERMISSIONS) ; les rôles en base permettent d’étendre les libellés et la liste des rôles actifs.

### 4.12 Ménage

- **Routes** : `/menage`, `/menage/new`, `/menage/[id]/edit`.
- **Tables** : `household_budgets`, `household_expenses` (liées à l’entité / utilisateur selon le schéma).
- **Accès** : réservé au rôle SUPER_ADMIN_GROUP (menu).

### 4.13 Paramètres

- **Routes** : `/settings`, `/settings/profile`, `/settings/security`, `/settings/exchange-rates`.
- **Fonctionnalités** : profil (nom, avatar), changement de mot de passe (Supabase Auth), taux de change (table `exchange_rates`) pour affichage CDF/USD.

---

## 5. Design system (technique)

### 5.1 Couleurs (CSS & Tailwind)

- **Primary** : `#00A896` (--primary, primary)
- **Primary dark** : `#00897B` (--primary-dark, primary-dark)
- **Primary light** : `#4DB6AC`
- **Texte** : `#1A1A1A` (text), `#6B7280` (text-light)
- **Feedback** : success `#10B981`, error `#EF4444`, warning `#F59E0B`, info `#3B82F6`
- **Fond** : dégradé léger (ex. #F5F7FA → #E8EDF2), card #FFFFFF

### 5.2 Typographie

- **Police** : Poppins (Google Fonts), fallback system fonts.
- **Tailles** : hiérarchie via Tailwind (text-2xl, text-xl, text-sm, etc.).

### 5.3 Composants UI

- **Button** : variants (primary, secondary, outline), loading, icon.
- **Card** : conteneur avec ombre, option hover.
- **Input** : label, erreur, style focus (ring primary).
- **Modals** : AlertModal, ConfirmModal, PromptModal, Modal.
- **Pagination** : currentPage, totalPages, onPageChange.
- **BackButton** : lien retour avec icône.
- **Badge** : statuts et rôles.

### 5.4 PDF (factures et livre de caisse)

- **Factures** : `generateInvoicePDF` (jsPDF, autoTable), logo/header/filigrane entité, couleurs cohérentes avec le design.
- **Livre de caisse** : `generateAccountingPDF` (jsPDF, autoTable), format paysage, en-tête “Livre de Caisse” + entité + période, tableau N° / Date / Code / Libellé / N° Pièce / Entrées / Sorties / Solde, solde total (vert/rouge), pied de page “ISIRO GROUP”.

---

## 6. Sécurité

### 6.1 Authentification

- Supabase Auth (email/mot de passe), sessions persistantes, refresh token.
- Vérification du profil en table `users` après login (présence, is_active) ; sinon message “compte non configuré” et suggestion `npm run make-super-admin`.

### 6.2 Autorisation

- **Côté client** : menu et boutons filtrés via `hasPermission(role, module, permission)` (constants/permissions.ts).
- **Côté serveur / BDD** : RLS sur toutes les tables métier ; politiques SELECT/INSERT/UPDATE/DELETE basées sur `can_access_entity(auth.uid(), entity_id)` et, selon les tables, sur le rôle (ex. create/update/delete).

### 6.3 Middleware

- Routes protégées : dashboard, billing, accounting, expenses, administration, courriers, archives, users, settings (à étendre si ajout de entities, repertoire, menage, roles en protégé).
- Routes publiques : splash, auth/login.
- API routes : exclues du middleware (gestion auth propre si nécessaire).

### 6.4 Bonnes pratiques

- Pas d’exposition de la clé service en client ; utilisation de `NEXT_PUBLIC_SUPABASE_ANON_KEY` côté navigateur.
- Scripts admin (make-super-admin, setup-storage) utilisent `SUPABASE_SERVICE_ROLE_KEY` côté Node uniquement.

---

## 7. Base de données (résumé)

### 7.1 Tables principales

- **entities** : filiales (code, name, branding).
- **users** : profils applicatifs (lien auth.uid(), role, entity_id, entity_ids).
- **roles** : rôles dynamiques (code, label).
- **invoices**, **invoice_items**, **payments** : facturation.
- **accounting_entries** : livre de caisse.
- **expenses** : dépenses.
- **tasks** : administration / tâches.
- **mail_items** : courriers.
- **documents** : archives.
- **clients**, **suppliers**, **partners**, **collaborators** : répertoire.
- **exchange_rates** : taux de change.
- **household_budgets**, **household_expenses** : ménage.
- **audit_logs** : journaux d’audit (si utilisé).

### 7.2 RLS

- Fonction `can_access_entity(p_user_id, p_entity_id)` (SECURITY DEFINER) pour centraliser la logique d’accès par entité et par rôle.
- Politiques CRUD par table avec `can_access_entity(auth.uid(), entity_id)` (ou équivalent pour les tables sans entity_id si applicable).

---

## 8. API Routes

- **POST /api/users/create** : création d’utilisateur (service role), utilisée par l’admin.
- **DELETE /api/users/delete** : suppression/logique (service role) si implémenté.

Toute autre logique métier est exécutée côté client via le client Supabase (anon key + RLS).

---

## 9. PWA & déploiement

### 9.1 PWA

- next-pwa : service worker dans `public/sw.js`, enregistrement automatique, désactivé en développement.
- `manifest.json` dans `public/`, icônes dans `public/icons/`.
- Thème : primary (#00A896) pour theme_color si cohérent avec le design.

### 9.2 Déploiement

- **Plateforme** : Vercel.
- **Build** : `npm run build` (Next.js).
- **Variables d’environnement** : configurer sur Vercel (NEXT_PUBLIC_SUPABASE_*, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_APP_URL).
- **Migrations Supabase** : exécuter manuellement (Dashboard SQL ou CLI) ; migrations dans `supabase/migrations/`.

---

## 10. Scripts et opérations

- `npm run dev` : développement.
- `npm run build` : build production.
- `npm run make-super-admin <email>` : création/promotion super admin (requiert .env.local avec SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_SERVICE_KEY).
- `npm run setup-storage` : configuration buckets Storage si utilisé.
- `npm run generate-icons` : génération icônes PWA.

---

## 11. Évolutions recommandées (technique)

1. **Middleware** : ajouter les routes `/entities`, `/repertoire`, `/menage`, `/roles` et sous-routes (clients, suppliers, partenaires, collaborateurs) aux routes protégées.
2. **Tests** : tests unitaires (utils, hooks), tests d’intégration (flux critiques), E2E (login, création facture, export PDF).
3. **Performance** : pagination côté serveur pour les grosses listes (accounting, billing, etc.) ; cache ou prefetch pour les listes d’entités.
4. **Accessibilité** : labels, rôles ARIA, contraste (déjà partiellement respecté via design system).
5. **i18n** : si besoin multilingue, structurer les chaînes et utiliser une librairie (next-intl ou équivalent).

---

## 12. Glossaire

- **Entité** : filiale ou structure juridique de la holding (table `entities`).
- **Vue groupe** : vue consolidée (toutes les entités) pour Super Admin / Admin Entity sans entité sélectionnée.
- **RLS** : Row Level Security (Supabase/PostgreSQL).
- **Design system** : ensemble des couleurs, typo et composants UI réutilisables (globals.css, tailwind, composants src/components/ui).
