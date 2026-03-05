'use client';

import { useEffect, useState, useMemo } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { Plus, Search, Check, X, Eye, TrendingUp, TrendingDown, Receipt } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/utils/cn';
import Button from '@/components/ui/Button';
import BackButton from '@/components/ui/BackButton';
import Pagination from '@/components/ui/Pagination';
import { normalizeEntityIds, getEntityUUID } from '@/utils/entityHelpers';
import { formatNumber } from '@/utils/formatNumber';
import type { Database } from '@/types/database.types';

type Expense = Database['public']['Tables']['expenses']['Row'];

const CATEGORY_LABELS: Record<string, string> = {
  rent: 'Loyer',
  salaries: 'Salaires',
  transport: 'Transport',
  supplies: 'Fournitures',
  procurement: 'Approvisionnement',
  purchases: 'Achats',
  other: 'Autres',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  approved: 'Approuvée',
  rejected: 'Rejetée',
};

export default function ExpensesPage() {
  const { profile } = useAuth();
  const toast = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const supabase = createSupabaseClient();

  useEffect(() => {
    fetchExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('expenses')
        .select('*')
        .order('created_at', { ascending: false });

      // Système intelligent : filtrer automatiquement selon le rôle et l'entité
      if (profile) {
        // Pour les admins (Super Admin et Admin Entity), pas de filtre (voient tout selon RLS)
        if (profile.role !== 'SUPER_ADMIN_GROUP' && profile.role !== 'ADMIN_ENTITY') {
          // Pour tous les autres utilisateurs (MANAGER_ENTITY, ACCOUNTANT, SECRETARY, etc.),
          // filtrer automatiquement par leur(s) entité(s)
          if (profile.entity_ids && profile.entity_ids.length > 0) {
            const uuids = await normalizeEntityIds(profile.entity_ids);
            if (uuids.length > 0) {
              query = query.in('entity_id', uuids);
            } else {
              query = query.eq('id', '00000000-0000-0000-0000-000000000000');
            }
          } else if (profile.entity_id) {
            const uuid = await getEntityUUID(profile.entity_id);
            if (uuid) {
              query = query.eq('entity_id', uuid);
            } else {
              query = query.eq('id', '00000000-0000-0000-0000-000000000000');
            }
          } else {
            // Si aucune entité n'est définie, retourner une requête vide
            query = query.eq('id', '00000000-0000-0000-0000-000000000000');
          }
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      setExpenses(data || []);
    } catch (error: any) {
      toast.error('Erreur lors du chargement des dépenses');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const { error } = await (supabase.from('expenses') as any)
        .update({
          status: 'approved',
          approved_by: profile?.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      toast.success('Dépense approuvée');
      fetchExpenses();
    } catch (error: any) {
      toast.error('Erreur lors de l\'approbation');
    }
  };

  const handleReject = async (id: string) => {
    try {
      const { error } = await (supabase.from('expenses') as any)
        .update({
          status: 'rejected',
          approved_by: profile?.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      toast.success('Dépense rejetée');
      fetchExpenses();
    } catch (error: any) {
      toast.error('Erreur lors du rejet');
    }
  };

  const filteredExpenses = useMemo(
    () =>
      expenses.filter(
        (expense) =>
          expense.expense_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
          expense.description.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [expenses, searchTerm]
  );

  // Pagination
  const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);
  const paginatedExpenses = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredExpenses.slice(startIndex, endIndex);
  }, [filteredExpenses, currentPage, itemsPerPage]);

  // Réinitialiser la page si elle est hors limites
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const stats = useMemo(() => {
    const total = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const approved = expenses.filter(exp => exp.status === 'approved').reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const pending = expenses.filter(exp => exp.status === 'pending').reduce((sum, exp) => sum + (exp.amount || 0), 0);
    return { total, approved, pending };
  }, [expenses]);

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
      <div className="space-y-8 animate-in pb-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="animate-in stagger-1">
            <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Dépenses</h1>
            <p className="text-[13px] font-bold text-slate-500 uppercase tracking-widest mt-1 opacity-70">Gestion des charges et dépenses</p>
          </div>
          <div className="animate-in stagger-2 w-full md:w-auto">
            <Link href="/expenses/new">
              <button className="w-full md:w-auto bg-slate-900 text-white px-5 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xl shadow-slate-900/10 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest">
                <Plus className="w-4 h-4" />
                Nouvelle dépense
              </button>
            </Link>
          </div>
        </div>

        {/* Global Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
          <div className="animate-in stagger-2">
            <div className="glass-card p-6 relative overflow-hidden group border-none ring-1 ring-slate-100 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-slate-200">
              <div className="absolute top-0 right-0 w-24 h-24 bg-slate-100 rounded-full -mr-8 -mt-8 transition-transform duration-500 group-hover:scale-110" />
              <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="p-4 bg-slate-100 rounded-2xl text-slate-600 transition-transform duration-300 group-hover:rotate-12 shadow-sm">
                  <Receipt className="w-6 h-6" />
                </div>
              </div>
              <div className="relative z-10">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Dépenses</p>
                <p className="text-3xl font-black text-slate-900">{formatNumber(stats.total)} $</p>
                <div className="mt-4 h-1 w-12 bg-slate-900 rounded-full" />
              </div>
            </div>
          </div>
          <div className="animate-in stagger-3">
            <div className="glass-card p-6 relative overflow-hidden group border-none ring-1 ring-slate-100 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-slate-200">
              <div className="absolute top-0 right-0 w-24 h-24 bg-success/5 rounded-full -mr-8 -mt-8 transition-transform duration-500 group-hover:scale-110" />
              <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="p-4 bg-success/10 rounded-2xl text-success transition-transform duration-300 group-hover:rotate-12 shadow-sm">
                  <TrendingUp className="w-6 h-6" />
                </div>
              </div>
              <div className="relative z-10">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Approuvées</p>
                <p className="text-3xl font-black text-success">{formatNumber(stats.approved)} $</p>
                <div className="mt-4 h-1 w-12 bg-success rounded-full" />
              </div>
            </div>
          </div>
          <div className="animate-in stagger-4">
            <div className="glass-card p-6 relative overflow-hidden group border-none ring-1 ring-slate-100 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-slate-200">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-full -mr-8 -mt-8 transition-transform duration-500 group-hover:scale-110" />
              <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="p-4 bg-amber-50 rounded-2xl text-amber-600 transition-transform duration-300 group-hover:rotate-12 shadow-sm">
                  <TrendingDown className="w-6 h-6" />
                </div>
              </div>
              <div className="relative z-10">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">En attente</p>
                <p className="text-3xl font-black text-amber-600">{formatNumber(stats.pending)} $</p>
                <div className="mt-4 h-1 w-12 bg-amber-500 rounded-full" />
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="animate-in stagger-3 space-y-4">
          <div className="glass-card p-2 border-none">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-slate-900 transition-colors" />
              <input
                type="text"
                placeholder="Rechercher une dépense..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50/50 pl-12 pr-4 py-4 rounded-xl font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all border border-transparent focus:bg-white"
              />
            </div>
          </div>

          <div className="glass-card border-none overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Référence
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest hidden sm:table-cell">
                      Date
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Description
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Montant
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Statut
                    </th>
                    <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginatedExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-bold italic">
                        {filteredExpenses.length === 0 ? 'Aucune dépense trouvée' : 'Aucune dépense sur cette page'}
                      </td>
                    </tr>
                  ) : (
                    paginatedExpenses.map((expense) => (
                      <tr key={expense.id} className="group hover:bg-slate-50 transition-all duration-300">
                        <td className="px-6 py-5 whitespace-nowrap">
                          <span className="text-sm font-black text-slate-900 tracking-tight">#{expense.expense_number}</span>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap hidden sm:table-cell">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-tighter">
                            {new Date(expense.expense_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="text-sm font-bold text-slate-700 max-w-xs">{expense.description}</div>
                          <div className="text-[10px] uppercase font-black tracking-widest text-slate-400 mt-1">
                            {CATEGORY_LABELS[expense.category] || expense.category}
                          </div>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <span className="text-sm font-black text-slate-900">
                            {formatNumber(expense.amount)} $
                          </span>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <span className={cn(
                            "px-3 py-1 text-[10px] font-black rounded-full uppercase tracking-tighter",
                            expense.status === 'approved' ? 'bg-success/10 text-success' :
                              expense.status === 'rejected' ? 'bg-error/10 text-error' :
                                'bg-amber-100 text-amber-600'
                          )}>
                            {STATUS_LABELS[expense.status] || expense.status}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2 opacity-10 md:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <Link
                              href={`/expenses/${expense.id}`}
                              className="p-2 hover:bg-slate-200 rounded-xl transition-colors"
                            >
                              <Eye className="w-4 h-4 text-slate-600" />
                            </Link>
                            {expense.status === 'pending' &&
                              (profile?.role === 'SUPER_ADMIN_GROUP' ||
                                profile?.role === 'ADMIN_ENTITY' ||
                                profile?.role === 'ACCOUNTANT') && (
                                <>
                                  <button
                                    onClick={() => handleApprove(expense.id)}
                                    className="p-2 hover:bg-green-50 rounded-xl transition-colors"
                                    title="Approuver"
                                  >
                                    <Check className="w-4 h-4 text-success" />
                                  </button>
                                  <button
                                    onClick={() => handleReject(expense.id)}
                                    className="p-2 hover:bg-red-50 rounded-xl transition-colors"
                                    title="Rejeter"
                                  >
                                    <X className="w-4 h-4 text-error" />
                                  </button>
                                </>
                              )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-6 py-4 bg-slate-50/30 border-t border-slate-100">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  itemsPerPage={itemsPerPage}
                  totalItems={filteredExpenses.length}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

