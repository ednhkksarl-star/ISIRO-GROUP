# Gestion des Devises et Taux de Change

## Vue d'ensemble

L'application supporte maintenant deux devises :
- **USD** (Dollar américain) - Devise par défaut
- **CDF** (Franc congolais)

Tous les montants sont stockés en USD dans la base de données, mais peuvent être saisis et affichés en CDF avec conversion automatique basée sur le taux de change du jour.

## Fonctionnalités

### 1. Gestion des Taux de Change

Les super admins, admins d'entité, et comptables peuvent gérer les taux de change via :
**Paramètres → Taux de change**

#### Fonctionnalités :
- ✅ Créer un nouveau taux de change pour une date donnée
- ✅ Modifier un taux existant
- ✅ Supprimer un taux
- ✅ Activer/désactiver un taux
- ✅ Rechercher par date ou montant

#### Taux par défaut
Si aucun taux n'est défini pour une date, le système utilise le dernier taux actif disponible, ou 2400 CDF par défaut.

### 2. Sélection de Devise dans les Formulaires

Les formulaires suivants permettent de choisir la devise :
- **Facturation** (`/billing/new`)
- **Dépenses** (`/expenses/new`)
- **Comptabilité** (`/accounting/new`)

#### Comportement :
- L'utilisateur sélectionne USD ou CDF
- Les montants sont saisis dans la devise choisie
- Le taux du jour est affiché automatiquement si CDF est sélectionné
- Les montants sont convertis en USD avant d'être stockés en base de données
- La devise choisie est également stockée pour référence

### 3. Champs Numériques Effaçables

Tous les champs numériques (quantités, montants, prix unitaires, etc.) ont maintenant un comportement amélioré :
- ✅ Les zéros sont effaçables (le champ devient vide au focus)
- ✅ Permet de saisir directement une nouvelle valeur sans avoir à effacer manuellement
- ✅ Meilleure expérience utilisateur

## Structure de la Base de Données

### Table `exchange_rates`

```sql
CREATE TABLE exchange_rates (
  id UUID PRIMARY KEY,
  rate_date DATE NOT NULL,
  usd_to_cdf DECIMAL(10, 2) NOT NULL, -- 1 USD = X CDF
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Colonnes `currency` ajoutées

Les tables suivantes ont maintenant une colonne `currency` :
- `invoices.currency` (VARCHAR(3), DEFAULT 'USD')
- `expenses.currency` (VARCHAR(3), DEFAULT 'USD')
- `accounting_entries.currency` (VARCHAR(3), DEFAULT 'USD')

## Migration SQL

Pour appliquer les changements, exécutez dans Supabase :

1. **Créer la table des taux de change** :
   ```sql
   -- Voir: supabase/create-exchange-rates-table.sql
   ```

2. **Ajouter les colonnes currency** :
   ```sql
   -- Voir: supabase/add-currency-columns.sql
   ```

## Hook `useExchangeRate`

Un hook React personnalisé est disponible pour récupérer et utiliser les taux de change :

```typescript
import { useExchangeRate } from '@/hooks/useExchangeRate';

const { rate, loading, convertToCDF, convertToUSD, refresh } = useExchangeRate();

// Convertir 100 USD en CDF
const amountInCDF = convertToCDF(100);

// Convertir 240000 CDF en USD
const amountInUSD = convertToUSD(240000);
```

## Permissions

### Gestion des Taux de Change
- ✅ `SUPER_ADMIN_GROUP`
- ✅ `ADMIN_ENTITY`
- ✅ `ACCOUNTANT`

### Consultation
- ✅ Tous les utilisateurs authentifiés peuvent voir les taux actifs

## Exemple d'Utilisation

### Créer une facture en CDF

1. Aller sur `/billing/new`
2. Sélectionner "CDF (Franc congolais)" dans le champ Devise
3. Le taux du jour s'affiche automatiquement (ex: "1 USD = 2,400.00 CDF")
4. Saisir les montants en CDF
5. Les montants sont automatiquement convertis en USD pour le stockage
6. La facture est créée avec `currency = 'CDF'`

### Gérer les Taux de Change

1. Aller sur `/settings/exchange-rates`
2. Cliquer sur "Nouveau taux"
3. Entrer la date et le taux (ex: 2400 pour 1 USD = 2400 CDF)
4. Cocher "Taux actif" si c'est le taux à utiliser
5. Sauvegarder

## Notes Importantes

⚠️ **Stockage** : Tous les montants sont stockés en USD dans la base de données, même si saisis en CDF.

⚠️ **Conversion** : La conversion se fait au moment de la création/modification, basée sur le taux actif du jour.

⚠️ **Historique** : La devise choisie est stockée dans la colonne `currency` pour référence, mais les montants sont toujours en USD.

⚠️ **Taux par défaut** : Si aucun taux n'est trouvé, le système utilise 2400 CDF par défaut.

## Améliorations Futures Possibles

- [ ] Historique des conversions
- [ ] Affichage des montants dans les deux devises
- [ ] Export en CDF
- [ ] Graphiques d'évolution des taux
- [ ] Import de taux depuis une API externe

