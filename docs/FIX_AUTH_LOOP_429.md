# Résolution de l'erreur 429 (Too Many Requests) - Boucle d'Authentification

Ce document explique comment l'erreur 429 rencontrée sur Supabase a été résolue dans l'application ISIRO GROUP.

## 1. Description du Problème
L'erreur `429 (Too Many Requests)` se produisait lors de l'appel au endpoint `refresh_token` de Supabase. Cela indiquait que l'application envoyait trop de requêtes d'authentification dans un laps de temps très court.

### Cause racine
Dans le fichier `src/components/providers/Providers.tsx`, un écouteur d'événements d'authentification (`onAuthStateChange`) était configuré pour réagir à chaque changement d'état.

```typescript
// Code AVANT la correction
supabase.auth.onAuthStateChange((_event, session) => {
  setUser(session?.user ?? null);
  if (session?.user) {
    fetchProfile(session.user.id); // Était appelé à CHAQUE événement
  }
  setLoading(false);
});
```

Le problème est que l'événement `TOKEN_REFRESHED` est déclenché par Supabase chaque fois que le jeton d'accès est renouvelé. Si le renouvellement échouait ou si une condition de course se produisait (particulièrement visible sur les nouveaux MacBook Pro M4 en raison de la gestion réseau ou de la rapidité d'exécution), l'application entrait dans une boucle infinie :
1. Supabase rafraîchit le token -> événement `TOKEN_REFRESHED`.
2. L'application reçoit l'événement et appelle `fetchProfile` (requête réseau).
3. Le re-rendu du composant ou la gestion de la session déclenche parfois un nouveau rafraîchissement.
4. Répétition ultra-rapide -> Supabase bloque les requêtes (Erreur 429).

## 2. Solution Implémentée

La solution consiste à filtrer intelligemment les événements d'authentification et à s'assurer que nous ne rechargeons le profil que lorsque c'est strictement nécessaire.

### Étape A : Suivi précis de l'utilisateur avec `useRef`
Nous avons ajouté un `useRef` pour garder une trace de l'ID utilisateur actuel. Contrairement au `useState`, le `ref` nous permet d'accéder à la valeur la plus récente à l'intérieur de la fermeture (closure) du `useEffect` sans provoquer de re-rendu inutile ou de comportement instable.

### Étape B : Filtrage des événements
Nous ignorons désormais l'événement `TOKEN_REFRESHED` si l'utilisateur est déjà le même que celui stocké dans notre référence.

### Échelle des changements dans `Providers.tsx` :

```typescript
// Code APRÈS la correction
const userIdRef = useRef<string | undefined>(undefined);

useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    // 1. IGNORER les rafraîchissements de token si l'utilisateur n'a pas changé
    if (event === 'TOKEN_REFRESHED' && session?.user?.id === userIdRef.current) {
      return;
    }

    const newUser = session?.user ?? null;
    
    // 2. NE METTRE À JOUR que si l'ID a changé ou si c'est une connexion/déconnexion explicite
    if (newUser?.id !== userIdRef.current || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
      setUser(newUser);
      userIdRef.current = newUser?.id; // Mise à jour de la référence
      
      if (newUser) {
        fetchProfile(newUser.id); // Chargement du profil seulement si nécessaire
      } else {
        setProfile(null);
      }
    }
    
    setLoading(false);
  });
  
  return () => subscription.unsubscribe();
}, []);
```

## 3. Résultats
- **Stabilité accrue** : L'application ne bombarde plus Supabase de requêtes lors du renouvellement automatique des sessions.
- **Réduction du trafic réseau** : Moins d'appels à la table `users`.
- **Correction sur Mac M4** : La boucle de redirection/rafraîchissement qui touchait particulièrement ces modèles est supprimée.
