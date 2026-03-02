import type { UserRole } from '@/types/database.types';

export type Permission = 'create' | 'read' | 'update' | 'delete' | 'approve' | 'export';

export const ROLE_PERMISSIONS: Record<UserRole, Record<string, Permission[]>> = {
  SUPER_ADMIN_GROUP: {
    dashboard: ['read'], // Dashboard accessible
    entities: ['create', 'read', 'update', 'delete'],
    users: ['create', 'read', 'update', 'delete'],
    roles: ['create', 'read', 'update', 'delete'], // CRUD des rôles
    billing: ['create', 'read', 'update', 'delete', 'export'],
    accounting: ['create', 'read', 'update', 'delete', 'export'],
    expenses: ['create', 'read', 'update', 'delete', 'approve', 'export'],
    administration: ['create', 'read', 'update', 'delete'],
    mail: ['create', 'read', 'update', 'delete', 'export'],
    documents: ['create', 'read', 'update', 'delete', 'export'],
    household: ['create', 'read', 'update', 'delete', 'export'], // Module MENAGE
    repertoire: ['create', 'read', 'update', 'delete'],
  },
  ADMIN_ENTITY: {
    dashboard: ['read'], // Dashboard accessible
    // Admin Entity can view all entities but cannot manage them (only Super Admin can)
    entities: ['read'], // Read-only access to entities
    users: ['create', 'read', 'update', 'delete'], // Can do full CRUD on users
    roles: ['create', 'read', 'update', 'delete'], // CRUD des rôles
    billing: ['create', 'read', 'update', 'export'], // Can create, read, update but NOT delete
    accounting: ['create', 'read', 'update', 'export'], // Can create, read, update but NOT delete
    expenses: ['create', 'read', 'update', 'approve', 'export'], // Can create, read, update, approve but NOT delete
    administration: ['create', 'read', 'update'], // Can create, read, update but NOT delete
    mail: ['create', 'read', 'update', 'export'], // Can create, read, update but NOT delete
    documents: ['create', 'read', 'update', 'export'], // Can create, read, update but NOT delete
    repertoire: ['create', 'read', 'update', 'delete'],
  },
  ACCOUNTANT: {
    dashboard: ['read'], // Dashboard accessible
    billing: ['create', 'read', 'update', 'export'],
    accounting: ['create', 'read', 'update', 'export'],
    expenses: ['read', 'update', 'approve', 'export'],
    administration: ['read'],
    mail: ['read'],
    documents: ['read', 'export'],
    repertoire: ['read'],
  },
  SECRETARY: {
    dashboard: ['read'], // Dashboard accessible
    billing: ['create', 'read', 'update'],
    accounting: ['read'],
    expenses: ['create', 'read', 'update'],
    administration: ['create', 'read', 'update'],
    mail: ['create', 'read', 'update'],
    documents: ['create', 'read', 'update'],
    repertoire: ['create', 'read', 'update'],
  },
  AUDITOR: {
    dashboard: ['read'], // Dashboard accessible
    billing: ['read', 'export'],
    accounting: ['read', 'export'],
    expenses: ['read', 'export'],
    administration: ['read'],
    mail: ['read'],
    documents: ['read', 'export'],
    repertoire: ['read'],
  },
  MANAGER_ENTITY: {
    dashboard: ['read'], // Dashboard accessible
    // Manager d'entité : accès complet à son entité (lecture et écriture)
    billing: ['create', 'read', 'update', 'export'],
    accounting: ['create', 'read', 'update', 'export'],
    expenses: ['create', 'read', 'update', 'approve', 'export'],
    administration: ['create', 'read', 'update'],
    mail: ['create', 'read', 'update', 'export'],
    documents: ['create', 'read', 'update', 'export'],
    repertoire: ['create', 'read', 'update'],
  },
  READ_ONLY: {
    dashboard: ['read'], // Dashboard accessible
    billing: ['read'],
    accounting: ['read'],
    expenses: ['read'],
    administration: ['read'],
    mail: ['read'],
    documents: ['read'],
    repertoire: ['read'],
  },
};

export function hasPermission(
  role: UserRole,
  module: string,
  permission: Permission
): boolean {
  // Si le rôle n'existe pas dans ROLE_PERMISSIONS, retourner false
  const rolePermissions = ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS];
  if (!rolePermissions) {
    console.warn(`Role "${role}" not found in ROLE_PERMISSIONS`);
    return false;
  }
  return rolePermissions[module]?.includes(permission) ?? false;
}

