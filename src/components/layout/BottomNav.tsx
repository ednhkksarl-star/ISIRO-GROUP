'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FileText, Calculator, Mail, Settings } from 'lucide-react';
import { hasPermission } from '@/constants/permissions';
import type { UserRole } from '@/types/database.types';

interface BottomNavProps {
  currentPath: string;
  userRole: UserRole;
}

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', module: 'dashboard' },
  { label: 'Facturation', icon: FileText, href: '/billing', module: 'billing' },
  { label: 'Caisse', icon: Calculator, href: '/accounting', module: 'accounting' },
  { label: 'Courriers', icon: Mail, href: '/courriers', module: 'mail' },
  { label: 'Paramètres', icon: Settings, href: '/settings', module: 'billing' },
];

export default function BottomNav({ currentPath, userRole }: BottomNavProps) {
  const items = navItems.filter(item => hasPermission(userRole, item.module, 'read'));

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden flex items-center"
      style={{
        height: 'calc(56px + env(safe-area-inset-bottom))',
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'rgba(5,15,25,0.95)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {items.map(item => {
        const Icon = item.icon;
        const isActive = currentPath === item.href || currentPath.startsWith(item.href + '/');
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-all duration-200"
            style={{ color: isActive ? '#10b981' : 'rgba(255,255,255,0.3)' }}
          >
            <div
              className="flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200"
              style={{
                background: isActive ? 'rgba(16,185,129,0.15)' : 'transparent',
                border: isActive ? '1px solid rgba(16,185,129,0.3)' : '1px solid transparent',
              }}
            >
              <Icon className="w-4 h-4" strokeWidth={isActive ? 2.5 : 2} />
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
