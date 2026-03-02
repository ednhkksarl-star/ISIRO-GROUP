/**
 * Configuration de la console pour réduire le bruit
 * Masque les warnings non critiques en développement
 */

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalLog = console.log;

  // Liste des messages à filtrer
  const filteredMessages = [
    'Download the React DevTools',
    'GoTrueClient',
    'Multiple GoTrueClient instances',
    'apple-mobile-web-app-capable',
    'Skipping auto-scroll',
    'Fast Refresh',
    '[Fast Refresh]',
    'HotReload',
    'layout-router',
    'react-dom.development',
    'webpack-internal',
    'react-dev-overlay',
  ];

  console.warn = (...args: any[]) => {
    const message = args.join(' ');
    if (!filteredMessages.some((filter) => message.includes(filter))) {
      originalWarn.apply(console, args);
    }
  };

  console.log = (...args: any[]) => {
    const message = args.join(' ');
    if (!filteredMessages.some((filter) => message.includes(filter))) {
      originalLog.apply(console, args);
    }
  };

  // Garder toutes les erreurs importantes
  console.error = (...args: any[]) => {
    const message = args.join(' ');
    // Filtrer seulement les erreurs React internes non critiques
    if (
      !message.includes('react-dom.development') &&
      !message.includes('webpack-internal') &&
      !message.includes('HotReload')
    ) {
      originalError.apply(console, args);
    }
  };
}

