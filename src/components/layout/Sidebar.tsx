'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import {
  LayoutDashboard,
  FileText,
  Calculator,
  Receipt,
  Briefcase,
  Mail,
  Archive,
  Users,
  Settings,
  X,
  Shield,
  Home,
  BookUser,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { hasPermission } from '@/constants/permissions';
import type { UserRole } from '@/types/database.types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed?: boolean;
  currentPath: string;
  userRole: UserRole;
  entityId: string | null;
}

const menuItems = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    href: '/dashboard',
    permission: 'read',
    module: 'dashboard',
  },
  {
    label: 'Facturation',
    icon: FileText,
    href: '/billing',
    permission: 'read',
    module: 'billing',
  },
  {
    label: 'Livre de Caisse',
    icon: Calculator,
    href: '/accounting',
    permission: 'read',
    module: 'accounting',
  },
  {
    label: 'Administration',
    icon: Briefcase,
    href: '/administration',
    permission: 'read',
    module: 'administration',
  },
  {
    label: 'Services Courriers',
    icon: Mail,
    href: '/courriers',
    permission: 'read',
    module: 'mail',
  },
  {
    label: 'Répertoire',
    icon: BookUser,
    href: '/repertoire',
    permission: 'read',
    module: 'repertoire',
  },
  {
    label: 'Archives',
    icon: Archive,
    href: '/archives',
    permission: 'read',
    module: 'documents',
  },
  {
    label: 'Entités',
    icon: Briefcase,
    href: '/entities',
    permission: 'read',
    module: 'entities',
    roles: ['SUPER_ADMIN_GROUP'],
  },
  {
    label: 'Utilisateurs',
    icon: Users,
    href: '/users',
    permission: 'read',
    module: 'users',
    roles: ['SUPER_ADMIN_GROUP', 'ADMIN_ENTITY'],
  },
  {
    label: 'Rôles',
    icon: Shield,
    href: '/roles',
    permission: 'read',
    module: 'roles',
    roles: ['SUPER_ADMIN_GROUP', 'ADMIN_ENTITY'],
  },
  {
    label: 'Ménage',
    icon: Home,
    href: '/menage',
    permission: 'read',
    module: 'household',
    roles: ['SUPER_ADMIN_GROUP'],
  },
  {
    label: 'Paramètres',
    icon: Settings,
    href: '/settings',
    permission: 'read',
    module: 'billing',
  },
];

export default function Sidebar({
  isOpen,
  onClose,
  collapsed = false,
  currentPath,
  userRole,
  entityId,
}: SidebarProps) {
  const filteredItems = menuItems.filter((item) => {
    // Si l'item a des rôles spécifiques, vérifier que l'utilisateur a ce rôle
    if (item.roles && item.roles.length > 0 && !item.roles.includes(userRole)) {
      return false;
    }
    // Vérifier les permissions pour le module
    return hasPermission(userRole, item.module, item.permission as any);
  });

  return (
    <>
      {/* Overlay Mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-14 sm:top-16 left-0 h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] bg-cardBg border-r border-gray-200 z-50 transform transition-all duration-300 ease-in-out',
          collapsed ? 'lg:w-16' : 'lg:w-64',
          isOpen ? 'translate-x-0 w-64' : '-translate-x-full',
          'lg:translate-x-0'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className={cn('p-4 border-b bg-gradient-to-r from-primary to-primary-dark', collapsed && 'lg:p-2')}>
            <div className={cn('relative w-full', collapsed ? 'lg:h-12' : 'h-16')}>
              {collapsed ? (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-white font-bold text-xl">I</span>
                </div>
              ) : (
                <Image
                  src="/logo_isiro.png"
                  alt="ISIRO GROUP"
                  fill
                  className="object-contain"
                  priority
                  unoptimized
                />
              )}
            </div>
          </div>

          <div className="flex items-center justify-between p-4 border-b lg:hidden">
            <h2 className="font-semibold text-gray-800">Menu</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto p-4">
            <ul className="space-y-2">
              {filteredItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPath.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => {
                        if (window.innerWidth < 1024) {
                          onClose();
                        }
                      }}
                      className={cn(
                        'flex items-center gap-3 px-3 sm:px-4 py-2 sm:py-3 rounded-lg transition-all duration-200 group',
                        collapsed && 'lg:justify-center lg:px-2',
                        isActive
                          ? 'bg-gradient-to-r from-primary/20 to-primary/10 text-primary font-semibold shadow-md border-l-4 border-primary'
                          : 'text-text hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent hover:translate-x-1 hover:shadow-sm'
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon className={cn('w-5 h-5 flex-shrink-0', collapsed && 'lg:mx-auto')} />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {entityId && !collapsed && (
            <div className="p-4 border-t text-xs text-gray-500 truncate">
              Entité: {entityId.slice(0, 8)}...
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

