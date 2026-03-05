'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/Providers';
import { cn } from '@/utils/cn';
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

  useEffect(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved !== null) setSidebarCollapsed(saved === 'true');
  }, []);

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading, router]);

  /* ── No profile ── */
  if (!loading && user && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#f0f7f4' }}>
        <div className="max-w-md w-full rounded-3xl p-8 text-center bg-white shadow-xl shadow-slate-200/60">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
            <svg className="h-6 w-6" style={{ color: '#f59e0b' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">Compte non configuré</h2>
          <p className="text-sm text-slate-500 mb-4">Votre compte n&apos;est pas configuré dans le système.</p>
          <div className="rounded-xl p-4 mb-6 text-left bg-slate-50 border border-slate-100">
            <code className="text-sm text-emerald-700">npm run make-super-admin {user.email}</code>
          </div>
          <button
            onClick={async () => { await signOut(); router.push('/auth/login'); }}
            className="w-full h-10 rounded-xl font-black text-[11px] uppercase tracking-widest text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
          >
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f0f7f4' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-transparent animate-spin"
            style={{ borderTopColor: '#10b981', borderRightColor: 'rgba(16,185,129,0.2)' }} />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Chargement…</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) return null;

  return (
    <div className="min-h-screen" style={{
      /* Light mint-to-white gradient background */
      background: 'linear-gradient(145deg, #eef8f4 0%, #f4f8f6 40%, #f8fafc 100%)',
    }}>
      {/* Very subtle ambient tint — top-left emerald, top-right cyan */}
      <div className="fixed inset-0 pointer-events-none z-0" aria-hidden>
        <div className="absolute inset-0" style={{
          background: `
            radial-gradient(ellipse 50% 40% at 0% 0%, rgba(16,185,129,0.07) 0%, transparent 55%),
            radial-gradient(ellipse 40% 30% at 100% 0%, rgba(6,182,212,0.05) 0%, transparent 50%)
          `,
        }} />
      </div>

      {/* Sidebar — stays dark */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggle={() => {
          const next = !sidebarCollapsed;
          setSidebarCollapsed(next);
          localStorage.setItem('sidebarCollapsed', String(next));
        }}
        currentPath={pathname}
        userRole={profile.role}
        entityId={profile.entity_id}
      />

      {/* Header — frosted white */}
      <Header
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        onToggleSidebar={() => {
          const next = !sidebarCollapsed;
          setSidebarCollapsed(next);
          localStorage.setItem('sidebarCollapsed', String(next));
        }}
        sidebarCollapsed={sidebarCollapsed}
        user={profile}
        onSignOut={signOut}
      />

      {/* Main content */}
      <main
        className={cn(
          'relative z-10 flex-1 min-w-0 transition-all duration-300',
          sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-[256px]',
        )}
        style={{
          paddingTop: 56,
          paddingBottom: 'calc(72px + env(safe-area-inset-bottom))',
        }}
      >
        <div className="p-4 sm:p-6 md:p-8 lg:p-10 max-w-[1600px] mx-auto overflow-x-hidden">
          {children}
        </div>
      </main>

      {/* Bottom Nav */}
      <BottomNav currentPath={pathname} userRole={profile.role} />
    </div>
  );
}
