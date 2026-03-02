# Blocage de l’application (maintenance / impayé)

Ce document explique **où** l’affichage de l’app a été bloqué et **comment débloquer** (décommenter) pour remettre l’app en service.

---

## Où c’est commenté

**Fichier :** `src/app/layout.tsx`

Dans le layout racine, le contenu normal de l’app (toutes les pages) est **commenté** et remplacé par un message plein écran.

- **Ligne concernée :** le rendu de `{children}` est commenté.
- **À la place :** un bloc affiche le message « Service indisponible – contacter l'administrateur. »

Tant que ce blocage est en place, **toute** l’application (y compris login, dashboard, etc.) affiche uniquement ce message.

---

## Comment décommenter (réactiver l’app)

1. Ouvrir **`src/app/layout.tsx`**.
2. Dans le `<body>`, à l’intérieur de `<Providers>` :
   - **Décommenter** la ligne :  
     `{children}`
   - **Commenter ou supprimer** le bloc du message (le `<div>` avec « Service indisponible – contacter l'administrateur »).
3. Sauvegarder, puis **redéployer** (ex. `npm run build` puis déploiement Vercel).

Exemple après modification (app réactivée) :

```tsx
<Providers>
  {children}
  <ToastContainer ... />
</Providers>
```

---

## Comment re-bloquer l’app (remettre le message)

1. Ouvrir **`src/app/layout.tsx`**.
2. **Commenter** la ligne `{children}` (ajouter `{/* */}` autour).
3. **Décommenter** (ou réinsérer) le bloc du message « Service indisponible – contacter l'administrateur ».
4. Sauvegarder et redéployer.

---

## Résumé

| Action        | Dans `src/app/layout.tsx`                                      |
|---------------|-----------------------------------------------------------------|
| **Bloquer**   | Commenter `{children}`, afficher le div « Service indisponible » |
| **Débloquer** | Décommenter `{children}`, enlever ou commenter le div message   |

Après chaque changement, un **nouveau déploiement** est nécessaire pour que l’effet soit visible en production.
