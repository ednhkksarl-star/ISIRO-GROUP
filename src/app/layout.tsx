import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/providers/Providers';

export const metadata: Metadata = {
  title: 'ISIRO GROUP - Holding Management Platform',
  description: 'Plateforme de gestion centralisée pour la holding ISIRO GROUP',
  manifest: '/manifest.json',
  // Ne pas utiliser appleWebApp ici car il génère apple-mobile-web-app-capable (deprecated)
  // Utiliser plutôt mobile-web-app-capable dans le head directement si nécessaire
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#0ea5e9',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}

