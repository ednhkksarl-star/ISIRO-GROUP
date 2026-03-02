# Différence entre `entity_id` et `entity_ids` dans la table `users`

## Vue d'ensemble

Dans la table `users`, il existe deux colonnes pour gérer les entités associées aux utilisateurs :

### 1. `entity_id` (UUID, nullable)
- **Type** : `UUID` (clé étrangère vers `entities.id`)
- **Nullable** : Oui (`NULL` autorisé)
- **Usage** : **Déprécié / Legacy**
  - Ancienne méthode pour associer un utilisateur à une seule entité
  - Utilisé comme fallback pour la compatibilité avec l'ancien code
  - Dans votre base de données, tous les utilisateurs ont `entity_id = NULL`

### 2. `entity_ids` (JSONB, nullable)
- **Type** : `JSONB` (tableau JSON de chaînes)
- **Nullable** : Oui (`NULL` autorisé)
- **Usage** : **Méthode actuelle et recommandée**
  - Permet à un utilisateur d'être associé à **plusieurs entités**
  - Peut contenir soit des **codes d'entité** (ex: `["CBI", "CEMC", "ABS"]`)
  - Soit des **UUIDs** (ex: `["927380ce-783c-4d11-b51b-a75eb6701181"]`)
  - Soit un **mélange** des deux

## Exemples dans votre base de données

D'après les captures d'écran :

1. **Nicolas LIANZA** (Super Admin) :
   - `entity_id`: `NULL`
   - `entity_ids`: `["CBI","CEMC","ABS","ATSWAY","KWILU,...]` (codes d'entité)

2. **Espoir BOMBEKE** (Manager Entity) :
   - `entity_id`: `NULL`
   - `entity_ids`: `["1c0a4899-85e0-4d9b-bc38-7b225129f2...]` (UUID)

3. **Amour KASONGO** (Manager Entity) :
   - `entity_id`: `NULL`
   - `entity_ids`: `["927380ce-783c-4d11-b51b-a75eb6701181...]` (UUID)

## Pourquoi cette structure ?

### Avantages de `entity_ids` (JSONB)
1. **Multi-entités** : Un utilisateur peut appartenir à plusieurs entités
2. **Flexibilité** : Accepte codes et UUIDs
3. **Évolutivité** : Facile d'ajouter/retirer des entités sans modifier le schéma

### Inconvénients
1. **Complexité** : Nécessite des fonctions spéciales pour interroger (ex: `normalizeEntityIds()`)
2. **Performance** : Les requêtes JSONB peuvent être plus lentes que les clés étrangères simples
3. **Validation** : Pas de contrainte de clé étrangère automatique

## Comment le code gère cela

Le code utilise la fonction `normalizeEntityIds()` dans `src/utils/entityHelpers.ts` pour :
1. Séparer les UUIDs valides des codes
2. Convertir les codes en UUIDs via une requête à la base de données
3. Retourner un tableau d'UUIDs normalisés

## Migration recommandée

Pour les nouveaux utilisateurs, utilisez **uniquement `entity_ids`** avec des UUIDs pour de meilleures performances :

```sql
-- Exemple pour un nouvel utilisateur
UPDATE users 
SET entity_ids = '["927380ce-783c-4d11-b51b-a75eb6701181", "1c0a4899-85e0-4d9b-bc38-7b225129f2a1"]'::jsonb
WHERE id = 'user-uuid-here';
```

## Conclusion

- **`entity_id`** : Ancien système, un seul entité par utilisateur, déprécié
- **`entity_ids`** : Système actuel, plusieurs entités par utilisateur, flexible (codes ou UUIDs)

Dans votre application, **tous les utilisateurs utilisent `entity_ids`** et `entity_id` est toujours `NULL`.

