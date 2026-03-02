'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { useEntity } from '@/hooks/useEntity';
import { createSupabaseClient } from '@/services/supabaseClient';
import { normalizeEntityIds, getEntityUUID } from '@/utils/entityHelpers';
import { formatNumber } from '@/utils/formatNumber';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  FileText,
  Mail,
  Building2,
  Globe,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import Card from '@/components/ui/Card';
import { ENTITIES } from '@/constants/entities';
import type { EntityCode } from '@/types/database.types';

interface DashboardStats {
  totalRevenue: number;
  totalExpenses: number;
  netResult: number;
  invoicesCount: number;
  expensesCount: number;
  mailCount: number;
  revenueByEntity: Array<{ entity: string; revenue: number }>;
  monthlyData: Array<{ month: string; revenue: number; expenses: number }>;
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const { selectedEntityId, isGroupView } = useEntity();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createSupabaseClient();

  useEffect(() => {
    if (!profile) {
      setStats({
        totalRevenue: 0,
        totalExpenses: 0,
        netResult: 0,
        invoicesCount: 0,
        expensesCount: 0,
        mailCount: 0,
        revenueByEntity: [],
        monthlyData: [],
      });
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadData = async () => {
      try {
        await fetchDashboardData();
        if (cancelled) return;
      } catch (error) {
        if (cancelled) return;
        console.error('Error in dashboard data fetch:', error);
      }
    };

    loadData();

    // Cleanup function pour éviter les mises à jour si le composant est démonté
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, selectedEntityId, isGroupView]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      if (!profile) {
        setStats({
          totalRevenue: 0,
          totalExpenses: 0,
          netResult: 0,
          invoicesCount: 0,
          expensesCount: 0,
          mailCount: 0,
          revenueByEntity: [],
          monthlyData: [],
        });
        return;
      }

      // Déterminer si on doit afficher toutes les entités (vue groupe)
      const isGroupViewMode = isGroupView && (profile.role === 'SUPER_ADMIN_GROUP' || profile.role === 'ADMIN_ENTITY');

      // Récupérer les entités pour mapper les IDs aux noms
      const { data: entitiesData, error: entitiesError } = await supabase
        .from('entities')
        .select('id, name, code');

      if (entitiesError) {
        console.error('Error fetching entities:', entitiesError);
      }

      const entitiesMap = new Map<string, { name: string; code: string }>();
      entitiesData?.forEach((entity: any) => {
        entitiesMap.set(entity.id, { name: entity.name, code: entity.code });
      });

      // Récupérer les factures - Système intelligent de filtrage automatique
      let invoicesQuery = supabase
        .from('invoices')
        .select('total, status, entity_id, issue_date');
      
      if (isGroupViewMode) {
        // Vue groupe : pas de filtre (Super Admin et Admin Entity voient tout)
      } else if (selectedEntityId && (profile.role === 'SUPER_ADMIN_GROUP' || profile.role === 'ADMIN_ENTITY')) {
        // Admin qui sélectionne une entité spécifique
        const uuid = await getEntityUUID(selectedEntityId);
        if (uuid) {
          invoicesQuery = invoicesQuery.eq('entity_id', uuid);
        } else {
          invoicesQuery = invoicesQuery.eq('id', '00000000-0000-0000-0000-000000000000');
        }
      } else {
        // Système intelligent : filtrer automatiquement selon le rôle et l'entité
        if (profile.entity_ids && profile.entity_ids.length > 0) {
          const uuids = await normalizeEntityIds(profile.entity_ids);
          if (uuids.length > 0) {
            invoicesQuery = invoicesQuery.in('entity_id', uuids);
          } else {
            invoicesQuery = invoicesQuery.eq('id', '00000000-0000-0000-0000-000000000000');
          }
        } else if (profile.entity_id) {
          const uuid = await getEntityUUID(profile.entity_id);
          if (uuid) {
            invoicesQuery = invoicesQuery.eq('entity_id', uuid);
          } else {
            invoicesQuery = invoicesQuery.eq('id', '00000000-0000-0000-0000-000000000000');
          }
        } else {
          invoicesQuery = invoicesQuery.eq('id', '00000000-0000-0000-0000-000000000000');
        }
      }
      
      const { data: invoices, error: invoicesError } = await invoicesQuery;
      
      if (invoicesError) {
        console.error('Error fetching invoices:', invoicesError);
      }

      // Récupérer les dépenses - Système intelligent de filtrage automatique
      let expensesQuery = supabase
        .from('expenses')
        .select('amount, entity_id, expense_date');
      
      if (isGroupViewMode) {
        // Vue groupe : pas de filtre (Super Admin et Admin Entity voient tout)
      } else if (selectedEntityId && (profile.role === 'SUPER_ADMIN_GROUP' || profile.role === 'ADMIN_ENTITY')) {
        const uuid = await getEntityUUID(selectedEntityId);
        if (uuid) {
          expensesQuery = expensesQuery.eq('entity_id', uuid);
        } else {
          expensesQuery = expensesQuery.eq('id', '00000000-0000-0000-0000-000000000000');
        }
      } else {
        if (profile.entity_ids && profile.entity_ids.length > 0) {
          const uuids = await normalizeEntityIds(profile.entity_ids);
          if (uuids.length > 0) {
            expensesQuery = expensesQuery.in('entity_id', uuids);
          } else {
            expensesQuery = expensesQuery.eq('id', '00000000-0000-0000-0000-000000000000');
          }
        } else if (profile.entity_id) {
          const uuid = await getEntityUUID(profile.entity_id);
          if (uuid) {
            expensesQuery = expensesQuery.eq('entity_id', uuid);
          } else {
            expensesQuery = expensesQuery.eq('id', '00000000-0000-0000-0000-000000000000');
          }
        } else {
          expensesQuery = expensesQuery.eq('id', '00000000-0000-0000-0000-000000000000');
        }
      }
      
      const { data: expenses, error: expensesError } = await expensesQuery;
      
      if (expensesError) {
        console.error('Error fetching expenses:', expensesError);
      }

      // Récupérer les écritures du livre de caisse - Système intelligent de filtrage automatique
      let accountingQuery = supabase
        .from('accounting_entries')
        .select('entrees, sorties, entity_id, entry_date');
      
      if (isGroupViewMode) {
        // Vue groupe : pas de filtre (Super Admin et Admin Entity voient tout)
      } else if (selectedEntityId && (profile.role === 'SUPER_ADMIN_GROUP' || profile.role === 'ADMIN_ENTITY')) {
        const uuid = await getEntityUUID(selectedEntityId);
        if (uuid) {
          accountingQuery = accountingQuery.eq('entity_id', uuid);
        } else {
          accountingQuery = accountingQuery.eq('id', '00000000-0000-0000-0000-000000000000');
        }
      } else {
        if (profile.entity_ids && profile.entity_ids.length > 0) {
          const uuids = await normalizeEntityIds(profile.entity_ids);
          if (uuids.length > 0) {
            accountingQuery = accountingQuery.in('entity_id', uuids);
          } else {
            accountingQuery = accountingQuery.eq('id', '00000000-0000-0000-0000-000000000000');
          }
        } else if (profile.entity_id) {
          const uuid = await getEntityUUID(profile.entity_id);
          if (uuid) {
            accountingQuery = accountingQuery.eq('entity_id', uuid);
          } else {
            accountingQuery = accountingQuery.eq('id', '00000000-0000-0000-0000-000000000000');
          }
        } else {
          accountingQuery = accountingQuery.eq('id', '00000000-0000-0000-0000-000000000000');
        }
      }
      
      const { data: accountingEntries, error: accountingError } = await accountingQuery;
      
      if (accountingError) {
        console.error('Error fetching accounting entries:', accountingError);
      }

      // Récupérer les courriers - Système intelligent de filtrage automatique
      let mailQuery = supabase
        .from('mail_items')
        .select('id, entity_id');
      
      if (isGroupViewMode) {
        // Vue groupe : pas de filtre (Super Admin et Admin Entity voient tout)
      } else if (selectedEntityId && (profile.role === 'SUPER_ADMIN_GROUP' || profile.role === 'ADMIN_ENTITY')) {
        const uuid = await getEntityUUID(selectedEntityId);
        if (uuid) {
          mailQuery = mailQuery.eq('entity_id', uuid);
        } else {
          mailQuery = mailQuery.eq('id', '00000000-0000-0000-0000-000000000000');
        }
      } else {
        if (profile.entity_ids && profile.entity_ids.length > 0) {
          const uuids = await normalizeEntityIds(profile.entity_ids);
          if (uuids.length > 0) {
            mailQuery = mailQuery.in('entity_id', uuids);
          } else {
            mailQuery = mailQuery.eq('id', '00000000-0000-0000-0000-000000000000');
          }
        } else if (profile.entity_id) {
          const uuid = await getEntityUUID(profile.entity_id);
          if (uuid) {
            mailQuery = mailQuery.eq('entity_id', uuid);
          } else {
            mailQuery = mailQuery.eq('id', '00000000-0000-0000-0000-000000000000');
          }
        } else {
          mailQuery = mailQuery.eq('id', '00000000-0000-0000-0000-000000000000');
        }
      }
      
      const { data: mail, error: mailError } = await mailQuery;
      
      if (mailError) {
        console.error('Error fetching mail items:', mailError);
      }

      // Calculer les statistiques avec formatage correct
      const invoicesData = (invoices || []) as any[];
      const expensesData = (expenses || []) as any[];
      const accountingData = (accountingEntries || []) as any[];
      
      // Revenus = Factures payées + Entrées du livre de caisse
      const revenueFromInvoices = invoicesData
        .filter((inv: any) => inv.status === 'paid')
        .reduce((sum: number, inv: any) => {
          const total = typeof inv.total === 'string' ? parseFloat(inv.total) : (inv.total || 0);
          return sum + (isNaN(total) ? 0 : total);
        }, 0);
      
      const revenueFromAccounting = accountingData.reduce((sum: number, entry: any) => {
        const entrees = typeof entry.entrees === 'string' ? parseFloat(entry.entrees) : (entry.entrees || 0);
        return sum + (isNaN(entrees) ? 0 : entrees);
      }, 0);
      
      const totalRevenue = revenueFromInvoices + revenueFromAccounting;
      
      // Dépenses = Dépenses (expenses) + Sorties du livre de caisse
      const expensesFromExpenses = expensesData.reduce((sum: number, exp: any) => {
        const amount = typeof exp.amount === 'string' ? parseFloat(exp.amount) : (exp.amount || 0);
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);
      
      const expensesFromAccounting = accountingData.reduce((sum: number, entry: any) => {
        const sorties = typeof entry.sorties === 'string' ? parseFloat(entry.sorties) : (entry.sorties || 0);
        return sum + (isNaN(sorties) ? 0 : sorties);
      }, 0);
      
      const totalExpenses = expensesFromExpenses + expensesFromAccounting;
      
      const netResult = totalRevenue - totalExpenses;

      // Grouper par entité avec les noms (factures + livre de caisse)
      const revenueByEntityMap = new Map<string, number>();
      
      // Ajouter les revenus des factures payées
      invoicesData.forEach((inv: any) => {
        if (inv.status === 'paid') {
          const entityInfo = entitiesMap.get(inv.entity_id);
          const entityLabel = entityInfo ? entityInfo.name : (inv.entity_id || 'Inconnue');
          const current = revenueByEntityMap.get(entityLabel) || 0;
          const total = typeof inv.total === 'string' ? parseFloat(inv.total) : (inv.total || 0);
          revenueByEntityMap.set(entityLabel, current + (isNaN(total) ? 0 : total));
        }
      });
      
      // Ajouter les entrées du livre de caisse
      accountingData.forEach((entry: any) => {
        const entrees = typeof entry.entrees === 'string' ? parseFloat(entry.entrees) : (entry.entrees || 0);
        if (!isNaN(entrees) && entrees > 0) {
          const entityInfo = entitiesMap.get(entry.entity_id);
          const entityLabel = entityInfo ? entityInfo.name : (entry.entity_id || 'Inconnue');
          const current = revenueByEntityMap.get(entityLabel) || 0;
          revenueByEntityMap.set(entityLabel, current + entrees);
        }
      });

      const revenueByEntity = Array.from(revenueByEntityMap.entries())
        .map(([entity, revenue]) => ({ entity, revenue }))
        .sort((a, b) => b.revenue - a.revenue);

      // Données mensuelles (6 derniers mois)
      const monthlyData = generateMonthlyData(invoicesData, expensesData, accountingData);

      setStats({
        totalRevenue: isNaN(totalRevenue) ? 0 : totalRevenue,
        totalExpenses: isNaN(totalExpenses) ? 0 : totalExpenses,
        netResult: isNaN(netResult) ? 0 : netResult,
        invoicesCount: invoicesData.length,
        expensesCount: expensesData.length,
        mailCount: mail?.length || 0,
        revenueByEntity,
        monthlyData,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // En cas d'erreur, initialiser avec des valeurs par défaut
      setStats({
        totalRevenue: 0,
        totalExpenses: 0,
        netResult: 0,
        invoicesCount: 0,
        expensesCount: 0,
        mailCount: 0,
        revenueByEntity: [],
        monthlyData: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const generateMonthlyData = (
    invoices: any[],
    expenses: any[],
    accountingEntries: any[]
  ): Array<{ month: string; revenue: number; expenses: number }> => {
    const months: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }));
    }

    return months.map((month, index) => {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const targetMonth = targetDate.getMonth();
      const targetYear = targetDate.getFullYear();

      // Revenus mensuels : Factures payées + Entrées du livre de caisse
      const monthRevenueFromInvoices = invoices
        .filter((inv) => {
          if (inv.status !== 'paid' || !inv.issue_date) return false;
          try {
            const issueDate = new Date(inv.issue_date);
            return issueDate.getMonth() === targetMonth && issueDate.getFullYear() === targetYear;
          } catch {
            return false;
          }
        })
        .reduce((sum, inv) => {
          const total = typeof inv.total === 'string' ? parseFloat(inv.total) : (inv.total || 0);
          return sum + (isNaN(total) ? 0 : total);
        }, 0);

      const monthRevenueFromAccounting = accountingEntries
        .filter((entry) => {
          if (!entry.entry_date) return false;
          try {
            const entryDate = new Date(entry.entry_date);
            return entryDate.getMonth() === targetMonth && entryDate.getFullYear() === targetYear;
          } catch {
            return false;
          }
        })
        .reduce((sum, entry) => {
          const entrees = typeof entry.entrees === 'string' ? parseFloat(entry.entrees) : (entry.entrees || 0);
          return sum + (isNaN(entrees) ? 0 : entrees);
        }, 0);

      const monthRevenue = monthRevenueFromInvoices + monthRevenueFromAccounting;

      // Dépenses mensuelles : Expenses + Sorties du livre de caisse
      const monthExpensesFromExpenses = expenses
        .filter((exp) => {
          if (!exp.expense_date) return false;
          try {
            const expenseDate = new Date(exp.expense_date);
            return expenseDate.getMonth() === targetMonth && expenseDate.getFullYear() === targetYear;
          } catch {
            return false;
          }
        })
        .reduce((sum, exp) => {
          const amount = typeof exp.amount === 'string' ? parseFloat(exp.amount) : (exp.amount || 0);
          return sum + (isNaN(amount) ? 0 : amount);
        }, 0);

      const monthExpensesFromAccounting = accountingEntries
        .filter((entry) => {
          if (!entry.entry_date) return false;
          try {
            const entryDate = new Date(entry.entry_date);
            return entryDate.getMonth() === targetMonth && entryDate.getFullYear() === targetYear;
          } catch {
            return false;
          }
        })
        .reduce((sum, entry) => {
          const sorties = typeof entry.sorties === 'string' ? parseFloat(entry.sorties) : (entry.sorties || 0);
          return sum + (isNaN(sorties) ? 0 : sorties);
        }, 0);

      const monthExpenses = monthExpensesFromExpenses + monthExpensesFromAccounting;

      return { month, revenue: monthRevenue, expenses: monthExpenses };
    });
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-text">Dashboard</h1>
            <p className="text-text-light mt-1 text-sm sm:text-base">
              {isGroupView ? (
                <>
                  <Globe className="w-4 h-4 inline mr-1" />
                  Vue consolidée ISIRO GROUP
                </>
              ) : selectedEntityId ? (
                <>
                  <Building2 className="w-4 h-4 inline mr-1" />
                  {ENTITIES[selectedEntityId as EntityCode]?.name || selectedEntityId}
                </>
              ) : (
                'Vue d&apos;ensemble'
              )}
            </p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <Card hover>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-text-light">Entrées</p>
                <p className="text-xl sm:text-2xl font-bold text-text mt-2">
                  {formatNumber(stats?.totalRevenue ?? 0)} $US
                </p>
              </div>
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-success/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-6 h-6 sm:w-7 sm:h-7 text-success" />
              </div>
            </div>
          </Card>

          <Card hover>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-text-light">Dépenses totales</p>
                <p className="text-xl sm:text-2xl font-bold text-text mt-2">
                  {formatNumber(stats?.totalExpenses ?? 0)} $US
                </p>
              </div>
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-error/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <TrendingDown className="w-6 h-6 sm:w-7 sm:h-7 text-error" />
              </div>
            </div>
          </Card>

          <Card hover>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-text-light">Résultat net</p>
                <p
                  className={`text-xl sm:text-2xl font-bold mt-2 ${
                    (stats?.netResult || 0) >= 0 ? 'text-success' : 'text-error'
                  }`}
                >
                  {formatNumber(stats?.netResult ?? 0)} $US
                </p>
              </div>
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
              </div>
            </div>
          </Card>

          <Card hover>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-text-light">Factures</p>
                <p className="text-xl sm:text-2xl font-bold text-text mt-2">
                  {stats?.invoicesCount}
                </p>
              </div>
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-info/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="w-6 h-6 sm:w-7 sm:h-7 text-info" />
              </div>
            </div>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <Card>
            <h2 className="text-base sm:text-lg font-semibold text-text mb-4">
              Évolution mensuelle
            </h2>
            <div className="w-full" style={{ height: '250px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats?.monthlyData || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 10 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip 
                    formatter={(value: number) => 
                      `${formatNumber(value)} $US`
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#0ea5e9"
                    name="Entrées"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="expenses"
                    stroke="#ef4444"
                    name="Dépenses"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <h2 className="text-base sm:text-lg font-semibold text-text mb-4">
              Entrées par entité
            </h2>
            {stats?.revenueByEntity && stats.revenueByEntity.length > 0 ? (
            <div className="w-full" style={{ height: '250px' }}>
              <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.revenueByEntity}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="entity" 
                    tick={{ fontSize: 10 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip 
                      formatter={(value: number) => 
                        `${formatNumber(value)} $US`
                      }
                    />
                  <Bar dataKey="revenue" fill="#0ea5e9" name="Entrées" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-gray-500">
                <p className="text-sm">Aucune donnée disponible</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

