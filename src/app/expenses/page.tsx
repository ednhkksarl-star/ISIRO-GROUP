'use client';

import { useEffect, useState, useMemo } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { Plus, Search, Check, X, Eye } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'react-toastify';
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
      <div className="space-y-6">
        {/* Bouton retour */}
        <BackButton href="/dashboard" />

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dépenses</h1>
            <p className="text-gray-600 mt-1">Gestion des charges et dépenses</p>
          </div>
          <Link href="/expenses/new">
            <Button icon={<Plus className="w-5 h-5" />}>
              Nouvelle dépense
            </Button>
          </Link>
        </div>

        {/* Search */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher une dépense..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Expenses Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Numéro
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                    Date
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    Catégorie
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Montant
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      {filteredExpenses.length === 0 ? 'Aucune dépense trouvée' : 'Aucune dépense sur cette page'}
                    </td>
                  </tr>
                ) : (
                  paginatedExpenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {expense.expense_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(expense.expense_date).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {expense.description}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {CATEGORY_LABELS[expense.category] || expense.category}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatNumber(expense.amount)} $US
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            expense.status === 'approved'
                              ? 'bg-green-100 text-green-800'
                              : expense.status === 'rejected'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {STATUS_LABELS[expense.status] || expense.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/expenses/${expense.id}`}
                            className="text-primary-600 hover:text-primary-900"
                            title="Voir"
                          >
                            <Eye className="w-5 h-5" />
                          </Link>
                          {expense.status === 'pending' &&
                            (profile?.role === 'SUPER_ADMIN_GROUP' ||
                              profile?.role === 'ADMIN_ENTITY' ||
                              profile?.role === 'ACCOUNTANT') && (
                              <>
                                <button
                                  onClick={() => handleApprove(expense.id)}
                                  className="text-green-600 hover:text-green-900"
                                  title="Approuver"
                                >
                                  <Check className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={() => handleReject(expense.id)}
                                  className="text-red-600 hover:text-red-900"
                                  title="Rejeter"
                                >
                                  <X className="w-5 h-5" />
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
        </div>
      </div>
    </AppLayout>
  );
}

