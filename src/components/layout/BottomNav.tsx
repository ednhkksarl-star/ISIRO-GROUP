'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Calculator,
  Receipt,
  Mail,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { hasPermission } from '@/constants/permissions';
import type { UserRole } from '@/types/database.types';

interface BottomNavProps {
  currentPath: string;
  userRole: UserRole;
}

const navItems = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    href: '/dashboard',
    module: 'dashboard',
  },
  {
    label: 'Facturation',
    icon: FileText,
    href: '/billing',
    module: 'billing',
  },
  {
    label: 'Livre de Caisse',
    icon: Calculator,
    href: '/accounting',
    module: 'accounting',
  },
  {
    label: 'Services Courriers',
    icon: Mail,
    href: '/courriers',
    module: 'mail',
  },
];

export default function BottomNav({ currentPath, userRole }: BottomNavProps) {
  const filteredItems = navItems.filter((item) =>
    hasPermission(userRole, item.module, 'read')
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-cardBg border-t border-gray-200 z-40 lg:hidden safe-area-bottom shadow-lg">
      <div className="flex justify-around items-center h-14 sm:h-16 px-2 safe-area-bottom">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 sm:gap-1 flex-1 h-full transition-colors',
                isActive ? 'text-primary font-semibold' : 'text-text-light'
              )}
            >
              <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
              <span className="text-[10px] sm:text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

