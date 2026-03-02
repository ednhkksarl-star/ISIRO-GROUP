import type { UserRole } from '@/types/database.types';

export const ROLE_TRANSLATIONS: Record<UserRole, string> = {
  SUPER_ADMIN_GROUP: 'Super Admin',
  ADMIN_ENTITY: 'Admin',
  ACCOUNTANT: 'Comptable',
  SECRETARY: 'Secrétaire',
  AUDITOR: 'Auditeur',
  READ_ONLY: 'Lecture seule',
};

export function getRoleLabel(role: UserRole): string {
  return ROLE_TRANSLATIONS[role] || role;
}

