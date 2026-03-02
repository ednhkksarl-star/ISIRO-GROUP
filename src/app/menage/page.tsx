'use client';

import { useEffect, useState, useMemo } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { Plus, Search, Trash2, Edit, Home, TrendingUp, TrendingDown, DollarSign, Calendar, Wallet } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'react-toastify';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import BackButton from '@/components/ui/BackButton';
import Pagination from '@/components/ui/Pagination';
import ConfirmModal from '@/components/ui/ConfirmModal';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { useModal } from '@/hooks/useModal';
import { formatNumber } from '@/utils/formatNumber';

interface HouseholdExpense {
  id: string;
  expense_date: string;
  category: string;
  description: string;
  amount: number;
  vendor_name: string | null;
  receipt_url: string | null;
  notes: string | null;
  is_recurring: boolean;
  recurring_frequency: string | null;
  worker_name: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  subscriptions: 'Abonnements',
  rent: 'Loyer',
  worker_salary: 'Salaire travailleurs',
  maintenance: 'Entretien',
  utilities: 'Services publics',
  food: 'Alimentation',
  health: 'Santé',
  education: 'Éducation',
  savings: 'Épargne',
  other: 'Autres',
};

export default function MenagePage() {
  const { profile } = useAuth();
  const [expenses, setExpenses] = useState<HouseholdExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const itemsPerPage = 10;
  const supabase = createSupabaseClient();
  const deleteModal = useModal();
  const budgetModal = useModal();
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [monthlyBudget, setMonthlyBudget] = useState<number | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [budgetAmount, setBudgetAmount] = useState<string>('');

  // Vérifier que seul le super admin peut accéder
  useEffect(() => {
    if (profile && profile.role !== 'SUPER_ADMIN_GROUP') {
      toast.error('Accès non autorisé');
      window.location.href = '/dashboard';
    }
  }, [profile]);

  useEffect(() => {
    if (profile?.role === 'SUPER_ADMIN_GROUP') {
      fetchExpenses();
      fetchMonthlyBudget();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      let query = (supabase.from('household_expenses') as any)
        .select('*')
        .order('expense_date', { ascending: false });

      // Les super admins voient toutes les dépenses, les autres voient seulement les leurs
      if (profile?.role !== 'SUPER_ADMIN_GROUP') {
        query = query.eq('created_by', profile?.id || '');
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

  const fetchMonthlyBudget = async () => {
    if (!profile?.id) return;

    try {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      // Pour les super admins, chercher le budget partagé (le plus récent de n'importe quel super admin)
      // Pour les autres, chercher seulement leur propre budget
      if (profile.role === 'SUPER_ADMIN_GROUP') {
        // Chercher le budget le plus récent de n'importe quel super admin pour ce mois
        // Comme c'est un seul foyer, tous les super admins partagent le même budget
        const { data: allBudgets, error: allBudgetsError } = await (supabase.from('household_budgets') as any)
          .select('*')
          .eq('budget_month', currentMonth)
          .eq('budget_year', currentYear)
          .order('created_at', { ascending: false })
          .limit(1);

        if (allBudgetsError && allBudgetsError.code !== 'PGRST116') {
          throw allBudgetsError;
        }

        if (allBudgets && allBudgets.length > 0) {
          // Utiliser le budget le plus récent (peu importe à qui il appartient)
          const budget = allBudgets[0];
          setMonthlyBudget(Number(budget.budget_amount));
          setBudgetAmount(budget.budget_amount.toString());
        } else {
          setMonthlyBudget(null);
          setBudgetAmount('');
        }
      } else {
        // Pour les non-super admins, chercher seulement leur propre budget
        const { data, error } = await (supabase.from('household_budgets') as any)
          .select('*')
          .eq('user_id', profile.id)
          .eq('budget_month', currentMonth)
          .eq('budget_year', currentYear)
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        if (data) {
          setMonthlyBudget(Number(data.budget_amount));
          setBudgetAmount(data.budget_amount.toString());
        } else {
          setMonthlyBudget(null);
          setBudgetAmount('');
        }
      }
    } catch (error: any) {
      console.error('Erreur lors du chargement du budget:', error);
    }
  };

  const handleSaveBudget = async () => {
    if (!profile?.id) return;

    const amount = parseFloat(budgetAmount);
    if (isNaN(amount) || amount < 0) {
      toast.error('Veuillez entrer un montant valide');
      return;
    }

    try {
      setBudgetLoading(true);
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      // Pour les super admins, mettre à jour ou créer le budget partagé
      // Pour les autres, créer/mettre à jour seulement leur propre budget
      if (profile.role === 'SUPER_ADMIN_GROUP') {
        // Chercher le budget partagé (le plus récent de n'importe quel super admin)
        const { data: allBudgets } = await (supabase.from('household_budgets') as any)
          .select('id, user_id')
          .eq('budget_month', currentMonth)
          .eq('budget_year', currentYear)
          .order('created_at', { ascending: false })
          .limit(1);

        if (allBudgets && allBudgets.length > 0) {
          // Mettre à jour le budget partagé existant (peu importe à qui il appartient)
          const existingBudget = allBudgets[0];
          const { error } = await (supabase.from('household_budgets') as any)
            .update({
              budget_amount: amount,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingBudget.id);

          if (error) throw error;
          toast.success('Budget mensuel mis à jour');
        } else {
          // Créer un nouveau budget partagé
          const { error } = await (supabase.from('household_budgets') as any)
            .insert({
              user_id: profile.id,
              budget_month: currentMonth,
              budget_year: currentYear,
              budget_amount: amount,
            });

          if (error) throw error;
          toast.success('Budget mensuel défini');
        }
      } else {
        // Pour les non-super admins, créer/mettre à jour seulement leur propre budget
        const { data: existingBudget } = await (supabase.from('household_budgets') as any)
          .select('id')
          .eq('user_id', profile.id)
          .eq('budget_month', currentMonth)
          .eq('budget_year', currentYear)
          .single();

        if (existingBudget) {
          // Mettre à jour le budget existant
          const { error } = await (supabase.from('household_budgets') as any)
            .update({
              budget_amount: amount,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingBudget.id);

          if (error) throw error;
          toast.success('Budget mensuel mis à jour');
        } else {
          // Créer un nouveau budget
          const { error } = await (supabase.from('household_budgets') as any)
            .insert({
              user_id: profile.id,
              budget_month: currentMonth,
              budget_year: currentYear,
              budget_amount: amount,
            });

          if (error) throw error;
          toast.success('Budget mensuel défini');
        }
      }

      await fetchMonthlyBudget();
      budgetModal.close();
    } catch (error: any) {
      toast.error('Erreur lors de la sauvegarde du budget');
      console.error(error);
    } finally {
      setBudgetLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!expenseToDelete) return;

    try {
      let query = (supabase.from('household_expenses') as any)
        .delete()
        .eq('id', expenseToDelete);

      // Les super admins peuvent supprimer toutes les dépenses, les autres seulement les leurs
      if (profile?.role !== 'SUPER_ADMIN_GROUP') {
        query = query.eq('created_by', profile?.id || '');
      }

      const { error } = await query;

      if (error) throw error;
      toast.success('Dépense supprimée');
      fetchExpenses();
      deleteModal.close();
      setExpenseToDelete(null);
    } catch (error: any) {
      toast.error('Erreur lors de la suppression');
      console.error(error);
    }
  };

  // Calculer les statistiques
  const stats = useMemo(() => {
    const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
    const monthlyExpenses = expenses
      .filter((exp) => {
        const expenseDate = new Date(exp.expense_date);
        const now = new Date();
        return expenseDate.getMonth() === now.getMonth() && expenseDate.getFullYear() === now.getFullYear();
      })
      .reduce((sum, exp) => sum + Number(exp.amount), 0);
    
    const byCategory = expenses.reduce((acc, exp) => {
      const cat = exp.category;
      acc[cat] = (acc[cat] || 0) + Number(exp.amount);
      return acc;
    }, {} as Record<string, number>);

    const savings = expenses
      .filter((exp) => exp.category === 'savings')
      .reduce((sum, exp) => sum + Number(exp.amount), 0);

    // Calculer si le budget est dépassé
    const isOverBudget = monthlyBudget !== null && monthlyExpenses > monthlyBudget;
    const budgetRemaining = monthlyBudget !== null ? monthlyBudget - monthlyExpenses : null;
    const budgetExceeded = monthlyBudget !== null && monthlyExpenses > monthlyBudget ? monthlyExpenses - monthlyBudget : null;

    return {
      totalExpenses,
      monthlyExpenses,
      byCategory,
      savings,
      count: expenses.length,
      monthlyBudget,
      isOverBudget,
      budgetRemaining,
      budgetExceeded,
    };
  }, [expenses, monthlyBudget]);

  const filteredExpenses = useMemo(
    () =>
      expenses.filter((expense) => {
        const matchesSearch =
          expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (expense.vendor_name && expense.vendor_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (expense.worker_name && expense.worker_name.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesCategory = selectedCategory === 'all' || expense.category === selectedCategory;
        return matchesSearch && matchesCategory;
      }),
    [expenses, searchTerm, selectedCategory]
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

  if (profile?.role !== 'SUPER_ADMIN_GROUP') {
    return null;
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <BackButton />
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Home className="w-8 h-8" />
              Ménage
            </h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">
              Gestion de vos dépenses personnelles
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={budgetModal.open}
              className="bg-green-600 hover:bg-green-700 text-white"
              icon={<Wallet className="w-5 h-5" />}
            >
              BUDGET MENSUEL
            </Button>
            <Link href="/menage/new">
              <Button icon={<Plus className="w-5 h-5" />}>
                Nouvelle dépense/épargne
              </Button>
            </Link>
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total dépenses</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatNumber(stats.totalExpenses)} $US
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-primary" />
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Ce mois</p>
                <p className={`text-2xl font-bold ${stats.isOverBudget ? 'text-red-600' : 'text-gray-900'}`}>
                  {formatNumber(stats.monthlyExpenses)} $US
                </p>
                {stats.monthlyBudget !== null && (
                  <p className="text-xs text-gray-500 mt-1">
                    Budget: {formatNumber(stats.monthlyBudget)} $US
                    {stats.isOverBudget && stats.budgetExceeded !== null && (
                      <span className="text-red-600 font-semibold ml-2">
                        (+{formatNumber(stats.budgetExceeded)} $US)
                      </span>
                    )}
                    {!stats.isOverBudget && stats.budgetRemaining !== null && (
                      <span className="text-green-600 font-semibold ml-2">
                        (Reste: {formatNumber(stats.budgetRemaining)} $US)
                      </span>
                    )}
                  </p>
                )}
              </div>
              <Calendar className={`w-8 h-8 ${stats.isOverBudget ? 'text-red-600' : 'text-primary'}`} />
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Épargne</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatNumber(stats.savings)} $US
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Nombre de dépenses</p>
                <p className="text-2xl font-bold text-gray-900">{stats.count}</p>
              </div>
              <TrendingDown className="w-8 h-8 text-primary" />
            </div>
          </Card>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-lg shadow p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              title="Filtrer par catégorie"
              aria-label="Filtrer les dépenses par catégorie"
            >
              <option value="all">Toutes les catégories</option>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-gray-500">Aucune dépense enregistrée</p>
            </div>
          </Card>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                        Date
                      </th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                        Catégorie
                      </th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Montant
                      </th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                        Fournisseur/Travailleur
                      </th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedExpenses.map((expense) => (
                      <tr key={expense.id} className="hover:bg-gray-50">
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 hidden sm:table-cell">
                          {new Date(expense.expense_date).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap hidden md:table-cell">
                          <span className="px-2 py-1 text-[10px] sm:text-xs font-semibold rounded-full bg-primary/10 text-primary">
                            {CATEGORY_LABELS[expense.category] || expense.category}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-900">
                          <div className="truncate max-w-[200px] sm:max-w-none">
                            {expense.description}
                            {expense.is_recurring && (
                              <span className="ml-2 text-xs text-gray-500">
                                (Récurrent: {expense.recurring_frequency})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium">
                          {(() => {
                            const expenseDate = new Date(expense.expense_date);
                            const now = new Date();
                            const isCurrentMonth = expenseDate.getMonth() === now.getMonth() && expenseDate.getFullYear() === now.getFullYear();
                            // Si le budget est dépassé ce mois, toutes les dépenses du mois sont en rouge
                            const isOverBudget = monthlyBudget !== null && isCurrentMonth && stats.isOverBudget;
                            const expenseAmount = Number(expense.amount);
                            
                            return (
                              <span className={isOverBudget ? 'text-red-600 font-semibold' : 'text-gray-900'}>
                                {formatNumber(expenseAmount)} $US
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-900 hidden lg:table-cell">
                          <div className="truncate max-w-[150px] xl:max-w-none">
                            {expense.worker_name || expense.vendor_name || '-'}
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium">
                          <div className="flex items-center gap-1 sm:gap-2">
                            <Link href={`/menage/${expense.id}/edit`} prefetch={false}>
                              <Button variant="secondary" size="sm" icon={<Edit className="w-3 h-3 sm:w-4 sm:h-4" />} className="text-xs">
                                <span className="hidden sm:inline">Modifier</span>
                              </Button>
                            </Link>
                            <Button
                              variant="danger"
                              size="sm"
                              icon={<Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />}
                              onClick={() => {
                                setExpenseToDelete(expense.id);
                                deleteModal.open();
                              }}
                              className="text-xs"
                            >
                              <span className="hidden sm:inline">Supprimer</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={filteredExpenses.length}
              itemsPerPage={itemsPerPage}
            />
          </>
        )}

        <ConfirmModal
          isOpen={deleteModal.isOpen}
          onClose={deleteModal.close}
          onConfirm={handleDelete}
          title="Supprimer la dépense"
          message="Êtes-vous sûr de vouloir supprimer cette dépense ? Cette action est irréversible."
        />

        {/* Modal Budget Mensuel */}
        <Modal
          isOpen={budgetModal.isOpen}
          onClose={budgetModal.close}
          title="Budget Mensuel"
          size="sm"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Montant du budget mensuel (USD)
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(e.target.value)}
                placeholder="0.00"
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-2">
                Définissez votre budget mensuel pour suivre vos dépenses et épargnes.
              </p>
            </div>
            {monthlyBudget !== null && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Budget actuel:</strong>{' '}
                  {formatNumber(monthlyBudget)} $US
                </p>
                <p className="text-sm text-blue-800 mt-1">
                  <strong>Dépenses ce mois:</strong>{' '}
                  {formatNumber(stats.monthlyExpenses)} $US
                </p>
                {stats.isOverBudget && stats.budgetExceeded !== null && (
                  <p className="text-sm text-red-600 font-semibold mt-1">
                    ⚠️ Dépassement: {formatNumber(stats.budgetExceeded)} $US
                  </p>
                )}
                {!stats.isOverBudget && stats.budgetRemaining !== null && (
                  <p className="text-sm text-green-600 font-semibold mt-1">
                    ✓ Reste: {formatNumber(stats.budgetRemaining)} $US
                  </p>
                )}
              </div>
            )}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="secondary"
                onClick={budgetModal.close}
                disabled={budgetLoading}
              >
                Annuler
              </Button>
              <Button
                onClick={handleSaveBudget}
                loading={budgetLoading}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Enregistrer
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </AppLayout>
  );
}

