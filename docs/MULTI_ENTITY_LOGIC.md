# Logique et Workflow Multi-Entités - ISIRO GROUP

## Vue d'ensemble

ISIRO GROUP est une plateforme de gestion centralisée pour une holding qui regroupe plusieurs filiales (entités) :
- **CBI**
- **CEMC**
- **ABS**
- **ATSWAY**
- **KWILU SCOOPS**
- **JUDO**

La plateforme permet une gestion séparée par entité avec une vision consolidée au niveau du groupe.

---

## Architecture Multi-Entités

### 1. Structure de la Base de Données

#### Table `entities`
Chaque filiale est enregistrée dans la table `entities` avec :
- `id` (UUID) : Identifiant unique
- `code` : Code de l'entité (CBI, CEMC, etc.)
- `name` : Nom complet de l'entité

#### Table `users`
Les utilisateurs sont liés aux entités via :
- `entity_id` (UUID, nullable) : Entité principale de l'utilisateur
- `entity_ids` (Array<UUID>, nullable) : Liste des entités accessibles (pour multi-entités)

#### Tables de données (invoices, expenses, etc.)
Toutes les tables de données contiennent :
- `entity_id` (UUID) : Obligatoire, identifie l'entité propriétaire des données

---

## Système de Rôles et Permissions

### Rôles disponibles

1. **SUPER_ADMIN_GROUP**
   - Accès à toutes les entités
   - Peut voir la vue consolidée (groupe)
   - Peut créer/modifier/supprimer des utilisateurs
   - Accès complet à toutes les fonctionnalités

2. **ADMIN_ENTITY**
   - Accès à une ou plusieurs entités spécifiques
   - Gestion des utilisateurs de ses entités
   - Accès complet aux modules de ses entités

3. **ACCOUNTANT**
   - Accès à une ou plusieurs entités spécifiques
   - Gestion de la comptabilité et facturation

4. **SECRETARY**
   - Accès à une ou plusieurs entités spécifiques
   - Gestion administrative et courriers

5. **AUDITOR**
   - Accès en lecture seule à une ou plusieurs entités
   - Consultation des données

6. **READ_ONLY**
   - Accès en lecture seule limité

---

## Workflow de Sélection d'Entité

### 1. Hook `useEntity`

Le hook `useEntity` gère la sélection d'entité au niveau de l'application :

```typescript
const { selectedEntityId, setSelectedEntityId, isGroupView, canAccessEntity } = useEntity();
```

**Fonctionnalités :**
- `selectedEntityId` : ID de l'entité sélectionnée (null = vue groupe)
- `isGroupView` : Boolean indiquant si la vue consolidée est active
- `canAccessEntity(entityId)` : Vérifie si l'utilisateur peut accéder à une entité

**Logique d'initialisation :**
- **SUPER_ADMIN_GROUP** : Par défaut, vue groupe (null)
- **Autres rôles avec une seule entité** : Sélection automatique de cette entité
- **Autres rôles avec plusieurs entités** : Aucune sélection par défaut (l'utilisateur doit choisir)

### 2. Composant `EntitySelector`

Le composant `EntitySelector` affiche le dropdown de sélection d'entité dans le header.

**Fonctionnement :**
1. Récupère toutes les entités depuis Supabase (`entities` table)
2. Filtre les entités selon les permissions de l'utilisateur
3. Affiche :
   - "ISIRO GROUP (Vue consolidée)" pour SUPER_ADMIN_GROUP
   - Liste des entités accessibles

**Affichage conditionnel :**
- Visible uniquement si :
  - L'utilisateur est SUPER_ADMIN_GROUP, OU
  - L'utilisateur a accès à plusieurs entités (`entity_ids.length > 1`)

---

## Workflow Global vs Par Entité

### Vue Consolidée (Groupe)

**Quand :** `selectedEntityId === null` et `isGroupView === true`

**Qui peut y accéder :**
- Uniquement `SUPER_ADMIN_GROUP`

**Comportement :**
- Affiche les données agrégées de toutes les entités
- Les requêtes Supabase ne filtrent pas par `entity_id`
- Les KPIs du dashboard montrent les totaux consolidés
- Les graphiques montrent l'évolution globale

**Exemple dans le Dashboard :**
```typescript
if (isGroupView && profile?.role === 'SUPER_ADMIN_GROUP') {
  // Pas de filtre entity_id - récupère toutes les données
  invoicesQuery = supabase.from('invoices').select('*');
}
```

### Vue Par Entité

**Quand :** `selectedEntityId !== null`

**Qui peut y accéder :**
- Tous les utilisateurs ayant accès à cette entité

**Comportement :**
- Affiche uniquement les données de l'entité sélectionnée
- Toutes les requêtes filtrent par `entity_id`
- Les KPIs montrent les données de l'entité
- Les graphiques montrent l'évolution de l'entité

**Exemple dans le Dashboard :**
```typescript
if (selectedEntityId) {
  invoicesQuery = invoicesQuery.eq('entity_id', selectedEntityId);
}
```

---

## Implémentation dans les Pages

### Pattern Standard

Chaque page qui affiche des données doit :

1. **Récupérer la sélection d'entité :**
```typescript
const { selectedEntityId, isGroupView } = useEntity();
```

2. **Construire le filtre selon la vue :**
```typescript
let query = supabase.from('table_name').select('*');

if (isGroupView && profile?.role === 'SUPER_ADMIN_GROUP') {
  // Vue groupe : pas de filtre
} else if (selectedEntityId) {
  // Vue entité : filtrer
  query = query.eq('entity_id', selectedEntityId);
} else if (profile?.entity_id) {
  // Fallback : utiliser l'entité de l'utilisateur
  query = query.eq('entity_id', profile.entity_id);
}
```

3. **Gérer les permissions :**
```typescript
// Vérifier si l'utilisateur peut accéder à cette entité
if (selectedEntityId && !canAccessEntity(selectedEntityId)) {
  // Rediriger ou afficher une erreur
}
```

### Exemple : Page Facturation

```typescript
export default function BillingPage() {
  const { profile } = useAuth();
  const { selectedEntityId, isGroupView } = useEntity();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  
  const fetchInvoices = async () => {
    let query = supabase.from('invoices').select('*');
    
    // Vue groupe uniquement pour SUPER_ADMIN_GROUP
    if (isGroupView && profile?.role === 'SUPER_ADMIN_GROUP') {
      // Pas de filtre
    } else if (selectedEntityId) {
      query = query.eq('entity_id', selectedEntityId);
    } else if (profile?.entity_id) {
      query = query.eq('entity_id', profile.entity_id);
    }
    
    const { data, error } = await query;
    // ...
  };
}
```

---

## Gestion des Utilisateurs Multi-Entités

### Attribution d'Entités

Un utilisateur peut être associé à :
- **Une seule entité** : `entity_id` rempli, `entity_ids` null
- **Plusieurs entités** : `entity_id` null ou première entité, `entity_ids` = [UUID1, UUID2, ...]
- **Toutes les entités** (SUPER_ADMIN_GROUP uniquement) : `entity_id` null, `entity_ids` null

### Création d'Utilisateur

Lors de la création d'un utilisateur par le SUPER_ADMIN_GROUP :
1. Sélectionner le rôle
2. Sélectionner une ou plusieurs entités
3. Si une seule entité : remplir `entity_id`
4. Si plusieurs entités : remplir `entity_ids` (array)

---

## Sécurité et RLS (Row Level Security)

### Politiques RLS dans Supabase

Toutes les tables doivent avoir des politiques RLS qui :
1. Permettent la lecture si :
   - L'utilisateur est SUPER_ADMIN_GROUP, OU
   - L'utilisateur a accès à l'entité (`entity_id` dans `entity_ids` ou `entity_id`)

2. Permettent l'écriture si :
   - L'utilisateur a les permissions appropriées ET
   - L'utilisateur a accès à l'entité

**Exemple de politique RLS :**
```sql
-- Lecture
CREATE POLICY "Users can read their entity data"
ON invoices FOR SELECT
USING (
  auth.jwt() ->> 'role' = 'SUPER_ADMIN_GROUP'
  OR entity_id IN (
    SELECT unnest(entity_ids) FROM users WHERE id = auth.uid()
  )
  OR entity_id = (SELECT entity_id FROM users WHERE id = auth.uid())
);

-- Écriture
CREATE POLICY "Users can insert their entity data"
ON invoices FOR INSERT
WITH CHECK (
  (auth.jwt() ->> 'role' IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY', 'ACCOUNTANT'))
  AND (
    entity_id IN (
      SELECT unnest(entity_ids) FROM users WHERE id = auth.uid()
    )
    OR entity_id = (SELECT entity_id FROM users WHERE id = auth.uid())
  )
);
```

---

## Flux de Données

### 1. Connexion Utilisateur

```
1. Utilisateur se connecte
2. Providers.tsx récupère le profil utilisateur
3. useEntity() s'initialise avec les entités de l'utilisateur
4. Si une seule entité → sélection automatique
5. Si plusieurs entités → aucune sélection (utilisateur choisit)
6. Si SUPER_ADMIN_GROUP → vue groupe par défaut
```

### 2. Sélection d'Entité

```
1. Utilisateur clique sur le dropdown EntitySelector
2. EntitySelector récupère les entités depuis Supabase
3. Filtre selon les permissions (entity_ids)
4. Utilisateur sélectionne une entité
5. setSelectedEntityId() met à jour l'état
6. Toutes les pages se rechargent avec le nouveau filtre
```

### 3. Affichage des Données

```
1. Page charge useEntity()
2. Construit la requête Supabase selon selectedEntityId
3. Si vue groupe → pas de filtre entity_id
4. Si vue entité → filtre entity_id = selectedEntityId
5. Affiche les données filtrées
```

---

## Points d'Attention

### 1. Performance
- Les requêtes de vue groupe peuvent être lourdes
- Considérer la pagination pour les grandes quantités de données
- Utiliser des index sur `entity_id` dans Supabase

### 2. Cohérence des Données
- Toujours vérifier `entity_id` lors de la création/modification
- Ne jamais permettre la modification de `entity_id` d'un enregistrement existant
- Utiliser RLS pour garantir la sécurité au niveau base de données

### 3. UX
- Afficher clairement quelle entité est sélectionnée
- Permettre le changement d'entité facilement
- Sauvegarder la sélection dans localStorage (optionnel)

---

## Résumé

| Aspect | Vue Groupe | Vue Entité |
|--------|------------|------------|
| **Accès** | SUPER_ADMIN_GROUP uniquement | Tous les utilisateurs autorisés |
| **Filtre** | Aucun (`entity_id` ignoré) | `entity_id = selectedEntityId` |
| **Données** | Toutes les entités agrégées | Une seule entité |
| **KPIs** | Totaux consolidés | Totaux de l'entité |
| **Graphiques** | Évolution globale | Évolution de l'entité |

---

## Fichiers Clés

- `src/hooks/useEntity.ts` : Hook de gestion d'entité
- `src/components/entity/EntitySelector.tsx` : Composant de sélection
- `src/components/layout/Header.tsx` : Intégration du sélecteur
- `src/app/dashboard/page.tsx` : Exemple d'implémentation
- `src/constants/entities.ts` : Codes d'entités (référence)
- `src/types/database.types.ts` : Types TypeScript

---

**Dernière mise à jour :** 2025-01-08

