# Migration: Entity Code ENUM vers VARCHAR

## Problème
Le champ `code` dans la table `entities` est actuellement un ENUM PostgreSQL, ce qui empêche de modifier librement le code d'une entité. Par exemple, on ne peut pas changer "JUDO" en "IJ" car "IJ" n'est pas dans la liste des valeurs autorisées.

## Solution
Cette migration convertit le type `code` d'un ENUM (`entity_code`) vers un `VARCHAR(50)`, permettant ainsi de modifier librement le code des entités.

## Étapes d'application

### 1. Exécuter la migration SQL

Exécutez le fichier `migrate-entity-code-to-varchar.sql` dans l'éditeur SQL de Supabase :

1. Connectez-vous à votre projet Supabase
2. Allez dans l'éditeur SQL (SQL Editor)
3. Copiez le contenu de `migrate-entity-code-to-varchar.sql`
4. Collez-le dans l'éditeur et exécutez-le

### 2. Vérifier que la migration a réussi

Après l'exécution, vérifiez que :

```sql
-- Vérifier que la colonne code est maintenant VARCHAR
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'entities' AND column_name = 'code';
-- Devrait retourner: code | character varying

-- Tester avec un code personnalisé
UPDATE entities SET code = 'IJ' WHERE code = 'JUDO';
-- Devrait fonctionner sans erreur
```

### 3. Notes importantes

- Les fonctions PostgreSQL (`generate_invoice_number`, `generate_expense_number`, `generate_mail_number`) ont été mises à jour pour utiliser `VARCHAR` au lieu de `entity_code`
- L'enum `entity_code` peut être supprimé plus tard avec `DROP TYPE entity_code;` si vous êtes sûr qu'il n'est plus utilisé ailleurs
- Les types TypeScript ont déjà été mis à jour pour accepter n'importe quelle string

## Rollback (si nécessaire)

Si vous devez annuler cette migration :

```sql
-- 1. Recréer l'enum (si nécessaire)
CREATE TYPE entity_code AS ENUM (
  'CBI', 'CEMC', 'ABS', 'ATSWAY', 'KWILU_SCOOPS', 'JUDO', 'IJ'
);

-- 2. Convertir la colonne en enum (ATTENTION: assurez-vous que toutes les valeurs sont dans l'enum)
ALTER TABLE entities 
  ALTER COLUMN code TYPE entity_code USING code::entity_code;

-- 3. Restaurer les fonctions avec entity_code (copier depuis schema.sql)
```

