'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/Providers';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import Header from './Header';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user, profile, loading, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Charger l'état de repli depuis localStorage
  useEffect(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved !== null) {
      setSidebarCollapsed(saved === 'true');
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [user, loading, router]);

  // Afficher un message si l'utilisateur est connecté mais n'a pas de profil
  if (!loading && user && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 text-center">
          <div className="mb-6">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
              <svg
                className="h-6 w-6 text-yellow-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Compte non configuré
            </h2>
            <p className="text-gray-600 mb-4">
              Votre compte n&apos;est pas configuré dans le système.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Contactez un administrateur ou exécutez la commande suivante pour créer votre profil :
            </p>
            <div className="bg-gray-100 rounded-lg p-4 mb-6">
              <code className="text-sm text-gray-800">
                npm run make-super-admin {user.email}
              </code>
            </div>
            <button
              onClick={async () => {
                await signOut();
                router.push('/auth/login');
              }}
              className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user || !profile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        onToggleSidebar={() => {
          const newState = !sidebarCollapsed;
          setSidebarCollapsed(newState);
          localStorage.setItem('sidebarCollapsed', String(newState));
        }}
        sidebarCollapsed={sidebarCollapsed}
        user={profile}
        onSignOut={signOut}
      />

      <div className="flex">
        {/* Sidebar Desktop */}
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          collapsed={sidebarCollapsed}
          currentPath={pathname}
          userRole={profile.role}
          entityId={profile.entity_id}
        />

        {/* Main Content */}
        <main className={`flex-1 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'} pb-20 lg:pb-0 pt-14 sm:pt-16 min-w-0 transition-all duration-300`}>
          <div className="p-3 sm:p-4 md:p-5 lg:p-6 xl:p-8 max-w-full overflow-x-hidden">{children}</div>
        </main>
      </div>

      {/* Bottom Navigation Mobile */}
      <BottomNav currentPath={pathname} userRole={profile.role} />
    </div>
  );
}

