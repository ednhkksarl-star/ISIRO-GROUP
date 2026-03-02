# Modales Personnalisées

## Vue d'ensemble

Tous les popups natifs de Windows (`prompt()`, `confirm()`, `alert()`) ont été remplacés par des modales personnalisées, modernes et stylées, cohérentes avec le design system de l'application.

## Composants Disponibles

### 1. ConfirmModal

Modale de confirmation pour remplacer `confirm()`.

**Props :**
- `isOpen: boolean` - État d'ouverture
- `onClose: () => void` - Fonction de fermeture
- `onConfirm: () => void` - Fonction de confirmation
- `title?: string` - Titre (défaut: "Confirmation")
- `message: string` - Message à afficher
- `confirmText?: string` - Texte du bouton de confirmation (défaut: "Confirmer")
- `cancelText?: string` - Texte du bouton d'annulation (défaut: "Annuler")
- `variant?: 'danger' | 'warning' | 'info'` - Variante de style (défaut: 'danger')
- `loading?: boolean` - État de chargement

**Exemple :**
```tsx
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useModal } from '@/hooks/useModal';

const deleteModal = useModal();
const [itemToDelete, setItemToDelete] = useState<string | null>(null);

// Dans le JSX
<ConfirmModal
  isOpen={deleteModal.isOpen}
  onClose={() => {
    deleteModal.close();
    setItemToDelete(null);
  }}
  onConfirm={async () => {
    if (itemToDelete) {
      await deleteItem(itemToDelete);
      setItemToDelete(null);
    }
  }}
  title="Supprimer l'élément"
  message="Êtes-vous sûr de vouloir supprimer cet élément ? Cette action est irréversible."
  confirmText="Supprimer"
  cancelText="Annuler"
  variant="danger"
/>
```

### 2. PromptModal

Modale de saisie pour remplacer `prompt()`.

**Props :**
- `isOpen: boolean` - État d'ouverture
- `onClose: () => void` - Fonction de fermeture
- `onConfirm: (value: string) => void` - Fonction de confirmation avec la valeur saisie
- `title?: string` - Titre (défaut: "Saisie")
- `message: string` - Message à afficher
- `placeholder?: string` - Placeholder de l'input
- `defaultValue?: string` - Valeur par défaut
- `confirmText?: string` - Texte du bouton de confirmation (défaut: "Valider")
- `cancelText?: string` - Texte du bouton d'annulation (défaut: "Annuler")
- `required?: boolean` - Champ requis (défaut: false)
- `type?: 'text' | 'number' | 'email' | 'tel'` - Type d'input (défaut: 'text')

**Exemple :**
```tsx
import PromptModal from '@/components/ui/PromptModal';
import { useModal } from '@/hooks/useModal';

const modulePrompt = useModal();
const [value, setValue] = useState('');

<PromptModal
  isOpen={modulePrompt.isOpen}
  onClose={modulePrompt.close}
  onConfirm={(module) => {
    setValue(module);
    modulePrompt.close();
  }}
  title="Module du document"
  message="Sélectionnez le module pour ce document"
  placeholder="billing, accounting, expenses, etc."
  defaultValue="archive"
  confirmText="Valider"
  cancelText="Annuler"
/>
```

### 3. AlertModal

Modale d'alerte pour remplacer `alert()`.

**Props :**
- `isOpen: boolean` - État d'ouverture
- `onClose: () => void` - Fonction de fermeture
- `title?: string` - Titre (optionnel, généré automatiquement selon variant)
- `message: string` - Message à afficher
- `variant?: 'success' | 'error' | 'warning' | 'info'` - Variante de style (défaut: 'info')
- `confirmText?: string` - Texte du bouton (défaut: "OK")
- `autoClose?: boolean` - Fermeture automatique (défaut: false)
- `autoCloseDelay?: number` - Délai de fermeture automatique en ms (défaut: 3000)

**Exemple :**
```tsx
import AlertModal from '@/components/ui/AlertModal';
import { useModal } from '@/hooks/useModal';

const alertModal = useModal();

<AlertModal
  isOpen={alertModal.isOpen}
  onClose={alertModal.close}
  title="Succès"
  message="L'opération a été effectuée avec succès."
  variant="success"
  autoClose={true}
  autoCloseDelay={3000}
/>
```

## Hook useModal

Hook utilitaire pour gérer l'état d'une modale.

**Retourne :**
- `isOpen: boolean` - État d'ouverture
- `open: () => void` - Ouvrir la modale
- `close: () => void` - Fermer la modale
- `toggle: () => void` - Basculer l'état

**Exemple :**
```tsx
import { useModal } from '@/hooks/useModal';

const myModal = useModal();

// Ouvrir
myModal.open();

// Fermer
myModal.close();

// Basculer
myModal.toggle();
```

## Pages Modifiées

### 1. Archives (`src/app/archives/page.tsx`)
- ✅ Remplacé `confirm()` pour la suppression de documents
- ✅ Remplacé `prompt()` pour la saisie du module (2 fois)
- ✅ Utilise `ConfirmModal` et `PromptModal`

### 2. Facturation (`src/app/billing/page.tsx`)
- ✅ Remplacé `confirm()` pour la suppression de factures
- ✅ Utilise `ConfirmModal`

### 3. Utilisateurs (`src/app/users/page.tsx`)
- ✅ Remplacé `confirm()` pour la suppression d'utilisateurs
- ✅ Utilise `ConfirmModal`

## Design

Toutes les modales suivent le design system de l'application :

- **Couleurs** : Utilisation des couleurs primaires, erreur, warning, success
- **Animations** : Fade-in, scale-in, bounce-light
- **Responsive** : Adapté mobile et desktop
- **Accessibilité** : Support clavier (Enter pour valider, Escape pour fermer)
- **Icônes** : Icônes Lucide React cohérentes

## Avantages

✅ **Design moderne** : Modales stylées et cohérentes avec l'application
✅ **Responsive** : S'adaptent à tous les écrans
✅ **Accessibilité** : Support clavier et navigation
✅ **Personnalisable** : Variantes de couleurs et styles
✅ **Type-safe** : TypeScript complet
✅ **Réutilisable** : Composants modulaires

## Migration

Si vous devez ajouter une nouvelle modale :

1. Importer le composant approprié
2. Utiliser `useModal()` pour gérer l'état
3. Ajouter la modale dans le JSX
4. Gérer les callbacks `onConfirm` et `onClose`

**Ne plus utiliser :**
- ❌ `window.confirm()`
- ❌ `window.prompt()`
- ❌ `window.alert()`

**Utiliser à la place :**
- ✅ `ConfirmModal`
- ✅ `PromptModal`
- ✅ `AlertModal`

