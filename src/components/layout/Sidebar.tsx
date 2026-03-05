'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import {
  LayoutDashboard, FileText, Calculator, Mail,
  Archive, Users, Settings, Shield, Home, BookUser, Briefcase,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { hasPermission } from '@/constants/permissions';
import type { UserRole } from '@/types/database.types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed?: boolean;
  onToggle?: () => void;
  currentPath: string;
  userRole: UserRole;
  entityId: string | null;
}

const menuGroups = [
  {
    title: 'Général',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', module: 'dashboard' },
      { label: 'Répertoire', icon: BookUser, href: '/repertoire', module: 'repertoire' },
    ],
  },
  {
    title: 'Opérations',
    items: [
      { label: 'Facturation', icon: FileText, href: '/billing', module: 'billing' },
      { label: 'Livre de Caisse', icon: Calculator, href: '/accounting', module: 'accounting' },
      { label: 'Courriers', icon: Mail, href: '/courriers', module: 'mail' },
      { label: 'Archives', icon: Archive, href: '/archives', module: 'documents' },
      { label: 'Ménage', icon: Home, href: '/menage', module: 'household', roles: ['SUPER_ADMIN_GROUP'] },
    ],
  },
  {
    title: 'Administration',
    items: [
      { label: 'Administration', icon: Briefcase, href: '/administration', module: 'administration' },
      { label: 'Entités', icon: Briefcase, href: '/entities', module: 'entities', roles: ['SUPER_ADMIN_GROUP'] },
      { label: 'Utilisateurs', icon: Users, href: '/users', module: 'users', roles: ['SUPER_ADMIN_GROUP', 'ADMIN_ENTITY'] },
      { label: 'Rôles', icon: Shield, href: '/roles', module: 'roles', roles: ['SUPER_ADMIN_GROUP', 'ADMIN_ENTITY'] },
    ],
  },
  {
    title: 'Config',
    items: [
      { label: 'Paramètres', icon: Settings, href: '/settings', module: 'billing' },
    ],
  },
];

export default function Sidebar({
  isOpen, onClose, collapsed = false, onToggle,
  currentPath, userRole, entityId,
}: SidebarProps) {
  const getItems = (items: any[]) =>
    items.filter(item =>
      (!item.roles || item.roles.includes(userRole)) &&
      hasPermission(userRole, item.module, 'read' as any)
    );

  const sidebarW = collapsed ? 72 : 256;

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 h-full z-50 flex flex-col transition-all duration-300',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
        style={{
          width: sidebarW,
          background: 'rgba(5,15,25,0.95)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          borderRight: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {/* ── Logo Section ─────────────────────────────── */}
        <div
          className="flex flex-col items-center justify-center relative overflow-hidden flex-shrink-0"
          style={{
            height: collapsed ? 72 : 180,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            transition: 'height 0.3s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          {/* Ambient glow behind logo */}
          {!collapsed && (
            <div className="absolute inset-0" style={{
              background: 'radial-gradient(ellipse 80% 60% at 50% 70%, rgba(16,185,129,0.12) 0%, transparent 70%)',
            }} />
          )}

          {/* Logo */}
          <div className="relative" style={{ transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)' }}>
            {/* Glow ring */}
            <div
              className="absolute inset-0 rounded-2xl"
              style={{
                background: 'rgba(16,185,129,0.25)',
                filter: 'blur(16px)',
                animation: 'glowPulse 3s ease-in-out infinite',
                borderRadius: collapsed ? 12 : 20,
              }}
            />
            <div
              className="relative overflow-hidden bg-white/5 border border-white/15 p-2.5 shadow-2xl"
              style={{
                width: collapsed ? 44 : 100,
                height: collapsed ? 44 : 100,
                borderRadius: collapsed ? 12 : 24,
                transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
              }}
            >
              <Image
                src="/logo_isiro.png"
                alt="ISIRO GROUP"
                fill
                className="object-contain"
                priority
                unoptimized
              />
            </div>
          </div>

          {/* Name — only expanded */}
          {!collapsed && (
            <div className="mt-4 text-center relative z-10 transition-all duration-300">
              <p className="text-white font-black text-[18px] sm:text-[20px] tracking-tighter leading-none">ISIRO</p>
              <p className="font-black text-[18px] sm:text-[20px] tracking-tighter leading-none" style={{ color: '#10b981' }}>GROUP</p>
            </div>
          )}

          {/* Collapse toggle — desktop only */}
          {onToggle && (
            <button
              onClick={onToggle}
              className="hidden lg:flex absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full items-center justify-center z-[60] transition-all duration-200"
              style={{
                background: '#0d1f36',
                border: '1.5px solid rgba(16,185,129,0.55)',
                color: '#10b981',
                boxShadow: '0 0 14px rgba(16,185,129,0.25), 0 2px 8px rgba(0,0,0,0.6)',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = '#10b981';
                el.style.color = '#fff';
                el.style.boxShadow = '0 0 20px rgba(16,185,129,0.5)';
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = '#0d1f36';
                el.style.color = '#10b981';
                el.style.boxShadow = '0 0 14px rgba(16,185,129,0.25), 0 2px 8px rgba(0,0,0,0.6)';
              }}
            >
              {collapsed
                ? <ChevronRight className="w-3.5 h-3.5" />
                : <ChevronLeft className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        {/* ── Navigation ───────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-8 custom-scrollbar relative z-10">
          {menuGroups.map((group, groupIdx) => {
            const items = getItems(group.items);
            if (items.length === 0) return null;
            return (
              <div key={group.title} className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-500" style={{ animationDelay: `${groupIdx * 100}ms` }}>
                {/* Group label with Divider */}
                {!collapsed && (
                  <div className="flex items-center gap-4 px-2 mb-4">
                    <p
                      className="text-[10px] font-black uppercase tracking-[0.3em] whitespace-nowrap"
                      style={{ color: 'rgba(16,185,129,0.5)' }}
                    >
                      {group.title}
                    </p>
                    <div className="h-px flex-1 bg-white/5" />
                  </div>
                )}

                {/* Group items container */}
                <div className={cn(
                  "space-y-1 transition-all duration-300",
                  !collapsed && "bg-white/[0.02] border border-white/[0.05] p-1.5 rounded-2xl backdrop-blur-sm"
                )}>
                  {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentPath === item.href || currentPath.startsWith(item.href + '/');
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => { if (window.innerWidth < 1024) onClose(); }}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          'flex items-center gap-3 rounded-xl transition-all duration-300 relative group overflow-hidden',
                          collapsed ? 'justify-center px-0 py-3 mx-auto w-12' : 'px-4 py-3',
                          isActive
                            ? 'bg-emerald-500 text-white shadow-xl shadow-emerald-500/30 scale-[1.02] z-20'
                            : 'text-white/40 hover:text-white hover:bg-white/[0.07] z-10'
                        )}
                      >
                        {/* Decorative background circle on active */}
                        {isActive && (
                          <div className="absolute top-0 right-0 w-20 h-20 bg-white/20 rounded-full -mr-8 -mt-8 transition-transform duration-700 group-hover:scale-125 opacity-60" />
                        )}

                        {/* Active indicator (yellow pulse) */}
                        {isActive && !collapsed && (
                          <div
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-yellow-400 rounded-r-full shadow-[0_0_20px_rgba(250,204,21,0.8)] z-30"
                          />
                        )}

                        <Icon
                          className={cn(
                            "w-4 h-4 flex-shrink-0 transition-all duration-300 relative z-30",
                            isActive ? "rotate-6 scale-110" : "text-emerald-500/30 group-hover:text-emerald-400 group-hover:scale-110"
                          )}
                          strokeWidth={isActive ? 3 : 2}
                        />
                        {!collapsed && (
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] truncate relative z-30">
                            {item.label}
                          </span>
                        )}

                        {/* Tooltip on collapsed */}
                        {collapsed && (
                          <div
                            className="absolute left-16 top-1/2 -translate-y-1/2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-[999] shadow-2xl"
                            style={{ background: 'rgba(5,15,25,0.98)', border: '1px solid rgba(16,185,129,0.3)', backdropFilter: 'blur(16px)' }}
                          >
                            {item.label}
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* ── Entity tag at bottom ─────────────────────── */}
        {entityId && !collapsed && (
          <div className="flex-shrink-0 px-6 py-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-2xl group transition-all duration-300 hover:bg-white/[0.03]"
              style={{ background: 'rgba(16,185,129,0.03)', border: '1px solid rgba(16,185,129,0.1)' }}
            >
              <div className="w-2 h-2 rounded-full animate-pulse flex-shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{ background: '#10b981' }} />
              <div className="flex flex-col min-w-0">
                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-emerald-500/50 mb-0.5">Entité Active</span>
                <span className="text-[10px] font-black uppercase tracking-widest truncate text-white/40">
                  {entityId.slice(0, 18)}…
                </span>
              </div>
            </div>
          </div>
        )}
      </aside>

      <style jsx global>{`
        @keyframes glowPulse {
          0%,100% { opacity:.4; transform:scale(1); }
          50%      { opacity:.8; transform:scale(1.2); }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 99px; }
      `}</style>
    </>
  );
}
