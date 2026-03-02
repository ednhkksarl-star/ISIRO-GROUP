'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { getEntityUUID, isValidUUID } from '@/utils/entityHelpers';
import { formatNumber } from '@/utils/formatNumber';
import { toast } from 'react-toastify';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  FileText,
  Mail,
  CheckCircle,
  Clock,
  Building2,
  ArrowLeft,
  Settings,
  Archive,
  BookOpen,
  Briefcase,
  BookUser,
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
import Button from '@/components/ui/Button';
import Link from 'next/link';
import Image from 'next/image';
import type { Database } from '@/types/database.types';

type Entity = Database['public']['Tables']['entities']['Row'];

interface EntityDashboardStats {
  totalRevenue: number;
  totalSorties: number; // Sorties du livre de caisse (pas le module dépenses)
  netResult: number;
  invoicesCount: number;
  accountingEntriesCount: number;
  tasksCount: number;
  assignedTasksCount: number;
  mailCount: number;
  monthlyData: Array<{ month: string; revenue: number; sorties: number }>;
}

export default function EntityDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuth();
  const supabase = createSupabaseClient();
  const [entity, setEntity] = useState<Entity | null>(null);
  const [stats, setStats] = useState<EntityDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [entityUUID, setEntityUUID] = useState<string | null>(null);
  const entityId = params.id as string;

  useEffect(() => {
    if (entityId) {
      fetchEntity();
      fetchDashboardData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId]);

  const fetchEntity = async () => {
    try {
      // Vérifier si entityId est un UUID ou un code d'entité
      const isUUID = isValidUUID(entityId);
      let query = supabase.from('entities').select('*');
      
      if (isUUID) {
        query = query.eq('id', entityId);
      } else {
        query = query.eq('code', entityId);
      }
      
      const { data, error } = await query.single();

      if (error) throw error;
      if (data) {
        const entityData = data as Entity;
        setEntity(entityData);
        // Stocker l'UUID pour l'utiliser dans les liens
        setEntityUUID(entityData.id);
      }
    } catch (error: any) {
      toast.error('Erreur lors du chargement de l\'entité');
      console.error(error);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Convertir le code d'entité en UUID si nécessaire
      const uuid = await getEntityUUID(entityId);
      if (!uuid) {
        toast.error('Entité non trouvée');
        setLoading(false);
        return;
      }

      // Récupérer les factures de l'entité
      const { data: invoices } = await supabase
        .from('invoices')
        .select('total, status, issue_date')
        .eq('entity_id', uuid);

      // Récupérer les écritures comptables
      const { data: accountingEntries } = await supabase
        .from('accounting_entries')
        .select('entrees, sorties, entry_date')
        .eq('entity_id', uuid);

      // Récupérer les tâches
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, assigned_to, status')
        .eq('entity_id', uuid);

      // Récupérer les courriers
      const { data: mailItems } = await supabase
        .from('mail_items')
        .select('id')
        .eq('entity_id', uuid);

      // Calculer les statistiques
      const invoicesData = (invoices || []) as Array<{ total: number; status: string; issue_date: string }>;
      const accountingEntriesData = (accountingEntries || []) as Array<{ entrees: number; sorties: number; entry_date: string }>;

      // Entrées = Factures payées + Entrées du livre de caisse (comme dashboard consolidé)
      const revenueFromInvoices = invoicesData
        .filter((inv) => inv.status === 'paid')
        .reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);
      const revenueFromAccounting = accountingEntriesData
        .reduce((sum, entry) => sum + (Number(entry.entrees) || 0), 0);
      const totalRevenue = revenueFromInvoices + revenueFromAccounting;

      // Sorties du livre de caisse (pas le module dépenses qui a été supprimé)
      const totalSorties = accountingEntriesData
        .reduce((sum, entry) => sum + (Number(entry.sorties) || 0), 0);

      const netResult = totalRevenue - totalSorties;

      // Tâches assignées à l'utilisateur actuel
      const tasksData = (tasks || []) as Array<{ id: string; assigned_to: string | null; status: string }>;
      const assignedTasksCount = tasksData.filter(
        (task) => task.assigned_to === profile?.id
      ).length;

      // Préparer les données mensuelles (revenue = factures payées + entrées livre de caisse)
      const monthlyDataMap = new Map<string, { revenue: number; sorties: number }>();

      invoicesData.forEach((inv) => {
        if (inv.status === 'paid' && inv.issue_date) {
          const month = new Date(inv.issue_date).toLocaleDateString('fr-FR', {
            month: 'short',
            year: 'numeric',
          });
          const current = monthlyDataMap.get(month) || { revenue: 0, sorties: 0 };
          monthlyDataMap.set(month, {
            ...current,
            revenue: current.revenue + (Number(inv.total) || 0),
          });
        }
      });

      accountingEntriesData.forEach((entry) => {
        if (entry.entry_date) {
          const month = new Date(entry.entry_date).toLocaleDateString('fr-FR', {
            month: 'short',
            year: 'numeric',
          });
          const current = monthlyDataMap.get(month) || { revenue: 0, sorties: 0 };
          monthlyDataMap.set(month, {
            ...current,
            revenue: current.revenue + (Number(entry.entrees) || 0),
            sorties: current.sorties + (Number(entry.sorties) || 0),
          });
        }
      });

      const monthlyData = Array.from(monthlyDataMap.entries())
        .map(([month, data]) => ({ month, ...data }))
        .sort((a, b) => {
          const dateA = new Date(a.month);
          const dateB = new Date(b.month);
          return dateA.getTime() - dateB.getTime();
        })
        .slice(-6); // Derniers 6 mois

      setStats({
        totalRevenue,
        totalSorties,
        netResult,
        invoicesCount: invoicesData?.length || 0,
        accountingEntriesCount: accountingEntriesData?.length || 0,
        tasksCount: tasksData?.length || 0,
        assignedTasksCount,
        mailCount: mailItems?.length || 0,
        monthlyData,
      });
    } catch (error: any) {
      toast.error('Erreur lors du chargement des statistiques');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  if (!entity) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Entité non trouvée</p>
          <Link href="/entities">
            <Button variant="secondary" className="mt-4">
              Retour aux entités
            </Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header avec logo et nom de l'entité */}
        <div className="bg-gradient-to-r from-primary to-primary-dark rounded-xl p-6 text-white">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {entity.logo_url && (
                <div className="relative w-16 h-16 rounded-lg bg-white/20 p-2">
                  <Image
                    src={entity.logo_url}
                    alt={entity.name}
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
              )}
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">{entity.name}</h1>
                <p className="text-white/80 text-sm sm:text-base">Code: {entity.code}</p>
              </div>
            </div>
            <Link href="/entities">
              <Button variant="secondary" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
                Vue groupe
              </Button>
            </Link>
          </div>
        </div>

        {/* Navigation rapide */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          <Link href={`/billing?entity=${entityUUID || entity?.id || entityId}`}>
            <Card className="p-4 hover:shadow-lg transition-all cursor-pointer text-center">
              <Receipt className="w-8 h-8 mx-auto mb-2 text-primary" />
              <p className="text-sm font-medium text-text">Facturation</p>
            </Card>
          </Link>
          <Link href={`/accounting?entity=${entityUUID || entity?.id || entityId}`}>
            <Card className="p-4 hover:shadow-lg transition-all cursor-pointer text-center">
              <BookOpen className="w-8 h-8 mx-auto mb-2 text-primary" />
              <p className="text-sm font-medium text-text">Livre de Caisse</p>
            </Card>
          </Link>
          <Link href={`/administration?entity=${entityUUID || entity?.id || entityId}`}>
            <Card className="p-4 hover:shadow-lg transition-all cursor-pointer text-center">
              <Briefcase className="w-8 h-8 mx-auto mb-2 text-primary" />
              <p className="text-sm font-medium text-text">Administration</p>
            </Card>
          </Link>
          <Link href={`/courriers?entity=${entityUUID || entity?.id || entityId}`}>
            <Card className="p-4 hover:shadow-lg transition-all cursor-pointer text-center">
              <Mail className="w-8 h-8 mx-auto mb-2 text-primary" />
              <p className="text-sm font-medium text-text">Services Courriers</p>
            </Card>
          </Link>
          <Link href={`/repertoire?entity=${entityUUID || entity?.id || entityId}`}>
            <Card className="p-4 hover:shadow-lg transition-all cursor-pointer text-center">
              <BookUser className="w-8 h-8 mx-auto mb-2 text-primary" />
              <p className="text-sm font-medium text-text">Répertoire</p>
            </Card>
          </Link>
          <Link href={`/archives?entity=${entityUUID || entity?.id || entityId}`}>
            <Card className="p-4 hover:shadow-lg transition-all cursor-pointer text-center">
              <Archive className="w-8 h-8 mx-auto mb-2 text-primary" />
              <p className="text-sm font-medium text-text">Archives</p>
            </Card>
          </Link>
          <Link href={`/settings?entity=${entityUUID || entity?.id || entityId}`}>
            <Card className="p-4 hover:shadow-lg transition-all cursor-pointer text-center">
              <Settings className="w-8 h-8 mx-auto mb-2 text-primary" />
              <p className="text-sm font-medium text-text">Paramètres</p>
            </Card>
          </Link>
        </div>

        {/* Statistiques principales */}
        {stats && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <Card className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-text-light mb-1">Entrées</p>
                    <p className="text-2xl sm:text-3xl font-bold text-text">
                      {formatNumber(stats.totalRevenue)} $US
                    </p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-lg">
                    <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
                  </div>
                </div>
              </Card>

              <Card className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-text-light mb-1">Sorties (Livre de Caisse)</p>
                    <p className="text-2xl sm:text-3xl font-bold text-text">
                      {formatNumber(stats.totalSorties)} $US
                    </p>
                  </div>
                  <div className="p-3 bg-red-100 rounded-lg">
                    <TrendingDown className="w-6 h-6 sm:w-8 sm:h-8 text-red-600" />
                  </div>
                </div>
              </Card>

              <Card className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-text-light mb-1">Résultat net</p>
                    <p
                      className={`text-2xl sm:text-3xl font-bold ${
                        stats.netResult >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {formatNumber(stats.netResult)} $US
                    </p>
                  </div>
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                  </div>
                </div>
              </Card>

              <Card className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-text-light mb-1">Factures</p>
                    <p className="text-2xl sm:text-3xl font-bold text-text">
                      {stats.invoicesCount}
                    </p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Receipt className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
                  </div>
                </div>
              </Card>
            </div>

            {/* Statistiques secondaires */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card className="p-4 text-center">
                <FileText className="w-6 h-6 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold text-text">{stats.accountingEntriesCount}</p>
                <p className="text-sm text-text-light">Écritures</p>
              </Card>
              <Card className="p-4 text-center">
                <CheckCircle className="w-6 h-6 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold text-text">{stats.tasksCount}</p>
                <p className="text-sm text-text-light">Tâches</p>
              </Card>
              <Card className="p-4 text-center">
                <Clock className="w-6 h-6 mx-auto mb-2 text-orange-500" />
                <p className="text-2xl font-bold text-text">{stats.assignedTasksCount}</p>
                <p className="text-sm text-text-light">Mes tâches</p>
              </Card>
              <Card className="p-4 text-center">
                <Mail className="w-6 h-6 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold text-text">{stats.mailCount}</p>
                <p className="text-sm text-text-light">Courriers</p>
              </Card>
            </div>

            {/* Graphiques */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-4 sm:p-6">
                <h3 className="text-lg font-semibold text-text mb-4">
                  Évolution mensuelle
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={stats.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#00A896"
                      strokeWidth={2}
                      name="Entrées"
                    />
                    <Line
                      type="monotone"
                      dataKey="sorties"
                      stroke="#EF4444"
                      strokeWidth={2}
                      name="Sorties"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              <Card className="p-4 sm:p-6">
                <h3 className="text-lg font-semibold text-text mb-4">
                  Entrées vs Sorties
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="revenue" fill="#00A896" name="Entrées" />
                    <Bar dataKey="sorties" fill="#EF4444" name="Sorties" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
