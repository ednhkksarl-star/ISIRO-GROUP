/**
 * Ordre des tables pour export/import (respect des clés étrangères)
 * Export = lecture dans cet ordre; Import = écriture dans cet ordre
 */
/**
 * Toutes les tables métier exportées (ordre = respect des FK à l'import).
 * audit_logs en dernier car il référence users et entities.
 */
export const DATA_EXPORT_TABLE_ORDER = [
  'entities',
  'roles',
  'users',
  'exchange_rates',
  'invoices',
  'invoice_items',
  'payments',
  'accounting_entries',
  'expenses',
  'tasks',
  'mail_items',
  'documents',
  'household_budgets',
  'household_expenses',
  'clients',
  'suppliers',
  'partners',
  'collaborators',
  'audit_logs',
] as const;

export type ExportTableName = (typeof DATA_EXPORT_TABLE_ORDER)[number];

export const EXPORT_VERSION = 1;

export interface DataExportPayload {
  version: number;
  exportedAt: string;
  app: string;
  data: Record<ExportTableName, unknown[]>;
}
