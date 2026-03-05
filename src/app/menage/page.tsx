'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { Plus, Search, Trash2, Edit, Home, TrendingUp, TrendingDown, DollarSign, Calendar, Wallet, Filter } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/utils/cn';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
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
  const toast = useToast();
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
  const [errorExpenses, setErrorExpenses] = useState(false);
  const [errorBudget, setErrorBudget] = useState(false);

  const isFetchingRef = useRef(false);

  // Vérifier que seul le super admin peut accéder
  useEffect(() => {
    if (profile && profile.role !== 'SUPER_ADMIN_GROUP') {
      toast.error('Accès non autorisé');
      window.location.href = '/dashboard';
    }
  }, [profile]);

  const fetchExpenses = useCallback(async () => {
    if (isFetchingRef.current) return;
    try {
      isFetchingRef.current = true;
      setLoading(true);
      setErrorExpenses(false);
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
      setErrorExpenses(false);
    } catch (error: any) {
      setErrorExpenses(true);
      toast.error('Erreur lors du chargement des dépenses');
      console.error(error);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [profile?.id, profile?.role, supabase]);

  const fetchMonthlyBudget = useCallback(async () => {
    if (!profile?.id) return;

    try {
      setErrorBudget(false);
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      // Pour les super admins, chercher le budget partagé (le plus récent de n'importe quel super admin)
      if (profile.role === 'SUPER_ADMIN_GROUP') {
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
          const budget = allBudgets[0];
          setMonthlyBudget(Number(budget.budget_amount));
          setBudgetAmount(budget.budget_amount.toString());
        } else {
          setMonthlyBudget(null);
          setBudgetAmount('');
        }
      } else {
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
      setErrorBudget(false);
    } catch (error: any) {
      console.error('Erreur lors du chargement du budget:', error);
      setErrorBudget(true);
      toast.error('Erreur lors du chargement du budget');
    }
  }, [profile?.id, profile?.role, supabase]);

  useEffect(() => {
    if (profile?.role === 'SUPER_ADMIN_GROUP') {
      fetchExpenses();
      fetchMonthlyBudget();
    }
  }, [profile?.id, profile?.role, fetchExpenses, fetchMonthlyBudget]);

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
      {/* Header Block - Repertoire Style */}
      <div className="bg-white border-2 border-emerald-100 p-6 sm:p-8 rounded-xl relative overflow-hidden group shadow-sm transition-all hover:border-emerald-200">
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-50 rounded-full -mr-24 -mt-24 transition-transform duration-500 group-hover:scale-110 opacity-50" />

        <div className="flex flex-col md:flex-row justify-between items-center sm:items-end gap-6 relative z-10">
          <div className="space-y-4 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-100">
              <Home className="w-4 h-4 text-emerald-600" />
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800">Gestion du Foyer</span>
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-emerald-950 uppercase leading-none">Ménage</h1>
              <div className="h-1.5 w-24 bg-yellow-400 mt-4 rounded-full" />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={budgetModal.open}
              className="h-14 px-8 rounded-xl bg-white border-2 border-emerald-100 text-emerald-600 hover:bg-emerald-50 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-3 shadow-sm"
            >
              <Wallet className="w-5 h-5" />
              Budget Mensuel
            </button>
            <Link href="/menage/new">
              <button className="h-14 px-8 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 text-[10px] font-black uppercase tracking-widest shadow-xl shadow-success/20 border-b-4 border-emerald-700 transition-all active:scale-95 flex items-center gap-3">
                <Plus className="w-5 h-5 stroke-[4]" />
                Nouvelle dépense
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Statistiques - Redesigned Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <div className="bg-white border-2 border-emerald-100 p-6 rounded-xl relative overflow-hidden group hover:border-emerald-300 transition-all shadow-sm">
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50 rounded-full -mr-8 -mt-8 opacity-50" />
          <div className="flex flex-col relative z-10">
            <div className="flex justify-between items-start mb-1">
              <span className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest">Total dépenses</span>
              {errorExpenses && (
                <button onClick={fetchExpenses} className="text-[8px] font-black text-rose-500 uppercase tracking-tighter hover:underline">Réessayer</button>
              )}
            </div>
            {loading ? (
              <div className="h-8 w-32 bg-emerald-50 animate-pulse rounded-lg" />
            ) : errorExpenses ? (
              <span className="text-xl font-black text-rose-500 uppercase tracking-tighter">Erreur de flux</span>
            ) : (
              <span className="text-2xl font-black text-emerald-950 tabular-nums leading-tight">
                {formatNumber(stats.totalExpenses)} $
              </span>
            )}
            <div className="flex items-center gap-2 mt-3 p-2 bg-emerald-50 rounded-lg">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span className="text-[9px] font-black text-emerald-800 uppercase tracking-tight">Flux total foyer</span>
            </div>
          </div>
        </div>

        <div className={cn(
          "bg-white border-2 p-6 rounded-xl relative overflow-hidden group transition-all shadow-sm",
          (stats.isOverBudget || errorExpenses || errorBudget) ? "border-rose-100 hover:border-rose-300" : "border-emerald-100 hover:border-emerald-300"
        )}>
          <div className={cn("absolute right-0 top-0 w-1.5 h-full", (stats.isOverBudget || errorExpenses || errorBudget) ? "bg-rose-500" : "bg-emerald-500")} />
          <div className="flex flex-col relative z-10">
            <div className="flex justify-between items-start mb-1">
              <span className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest">Dépenses ce mois</span>
              {(errorExpenses || errorBudget) && (
                <button
                  onClick={() => { fetchExpenses(); fetchMonthlyBudget(); }}
                  className="text-[8px] font-black text-rose-500 uppercase tracking-tighter hover:underline"
                >
                  Réessayer
                </button>
              )}
            </div>

            {loading ? (
              <div className="h-8 w-24 bg-emerald-50 animate-pulse rounded-lg" />
            ) : errorExpenses ? (
              <span className="text-xl font-black text-rose-500 uppercase tracking-tighter">Erreur de données</span>
            ) : (
              <span className={cn("text-2xl font-black tabular-nums leading-tight", stats.isOverBudget ? "text-rose-600" : "text-emerald-950")}>
                {formatNumber(stats.monthlyExpenses)} $
              </span>
            )}

            {loading ? (
              <div className="mt-4 h-4 w-full bg-emerald-50 animate-pulse rounded-full" />
            ) : errorBudget ? (
              <div className="mt-3 p-2 bg-rose-50 rounded-lg">
                <p className="text-[8px] font-black text-rose-600 uppercase">Erreur chargement budget</p>
              </div>
            ) : stats.monthlyBudget !== null ? (
              <div className="mt-3 space-y-2">
                <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                  <span className="text-emerald-800/60">Budget: {formatNumber(stats.monthlyBudget)} $</span>
                  {stats.isOverBudget ? (
                    <span className="text-rose-600">Dépassement</span>
                  ) : (
                    <span className="text-emerald-600">En règle</span>
                  )}
                </div>
                <div className="w-full h-1.5 bg-emerald-50 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full transition-all duration-1000", stats.isOverBudget ? "bg-rose-500" : "bg-emerald-500")}
                    style={{ width: `${Math.min((stats.monthlyExpenses / (stats.monthlyBudget || 1)) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="mt-3 p-2 bg-emerald-50 rounded-lg border border-emerald-100 border-dashed">
                <p className="text-[8px] font-black text-emerald-800/40 uppercase tracking-tighter text-center">Aucun budget défini</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border-2 border-emerald-100 p-6 rounded-xl relative overflow-hidden group hover:border-emerald-300 transition-all shadow-sm">
          <div className="absolute right-0 top-0 w-1.5 h-full bg-yellow-400" />
          <div className="flex flex-col relative z-10">
            <div className="flex justify-between items-start mb-1">
              <span className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest">Épargne cumulée</span>
              {errorExpenses && (
                <button onClick={fetchExpenses} className="text-[8px] font-black text-rose-500 uppercase tracking-tighter hover:underline">Réessayer</button>
              )}
            </div>
            {loading ? (
              <div className="h-8 w-24 bg-emerald-50 animate-pulse rounded-lg" />
            ) : errorExpenses ? (
              <span className="text-xl font-black text-rose-500 uppercase tracking-tighter">Erreur</span>
            ) : (
              <span className="text-2xl font-black text-emerald-950 tabular-nums leading-tight">
                {formatNumber(stats.savings)} $
              </span>
            )}
            <div className="flex items-center gap-2 mt-3 p-2 bg-yellow-50 rounded-lg">
              <TrendingUp className="w-4 h-4 text-yellow-600" />
              <span className="text-[9px] font-black text-yellow-800 uppercase tracking-tight">Croissance du capital</span>
            </div>
          </div>
        </div>

        <div className="bg-white border-2 border-emerald-100 p-6 rounded-xl relative overflow-hidden group hover:border-emerald-300 transition-all shadow-sm">
          <div className="flex flex-col relative z-10">
            <span className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest mb-1">Nombre d'opérations</span>
            <span className="text-2xl font-black text-emerald-950 tabular-nums leading-tight">{stats.count}</span>
            <div className="flex items-center gap-2 mt-3 p-2 bg-emerald-50 rounded-lg">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span className="text-[9px] font-black text-emerald-800 uppercase tracking-tight">Activité ménage</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Block - Repertoire Style */}
      <div className="bg-white border-2 border-emerald-100 p-2 rounded-xl flex flex-col lg:flex-row gap-2 transition-all hover:border-emerald-200 shadow-sm mt-6">
        <div className="flex-1 relative group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400 group-focus-within:text-emerald-600 transition-colors" />
          <input
            type="text"
            placeholder="Rechercher une opération (description, fournisseur...)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-12 pl-14 pr-6 bg-transparent text-sm font-bold text-emerald-950 outline-none placeholder:text-emerald-200"
          />
        </div>

        <div className="h-px lg:h-8 lg:w-px bg-emerald-100 self-center hidden lg:block" />

        <div className="flex flex-col sm:flex-row gap-2 p-1">
          <div className="relative">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-400 pointer-events-none" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-10 pl-10 pr-10 bg-emerald-50 border-none rounded-lg text-[10px] font-black uppercase tracking-widest text-emerald-800 appearance-none focus:ring-2 focus:ring-emerald-500/10 transition-all w-full sm:w-48 cursor-pointer hover:bg-emerald-100"
            >
              <option value="all">Toutes catégories</option>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table - Redesigned */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
        </div>
      ) : filteredExpenses.length === 0 ? (
        <div className="text-center py-20 bg-white border-2 border-emerald-100 rounded-xl mt-6">
          <div className="flex flex-col items-center gap-4">
            <div className="p-6 bg-emerald-50 rounded-full">
              <Search className="w-12 h-12 text-emerald-200" />
            </div>
            <p className="text-emerald-800 font-bold uppercase text-xs tracking-[0.2em]">
              Aucune opération trouvée
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-6">
          <div className="bg-white border-2 border-emerald-100 rounded-xl overflow-hidden shadow-sm transition-all hover:border-emerald-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y-2 divide-emerald-50">
                <thead className="bg-emerald-50/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-emerald-950 uppercase tracking-widest">Date</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-emerald-950 uppercase tracking-widest">Catégorie</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-emerald-950 uppercase tracking-widest">Détails</th>
                    <th className="px-6 py-4 text-right text-[10px] font-black text-emerald-950 uppercase tracking-widest">Montant</th>
                    <th className="px-6 py-4 text-right text-[10px] font-black text-emerald-950 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-emerald-50">
                  {paginatedExpenses.map((expense) => (
                    <tr key={expense.id} className="group hover:bg-emerald-50/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-emerald-900/60">
                        {new Date(expense.expense_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-3 py-1 text-[10px] font-black rounded-lg bg-emerald-100 text-emerald-800 uppercase tracking-tighter">
                          {CATEGORY_LABELS[expense.category] || expense.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-emerald-950 uppercase leading-none mb-1 group-hover:text-emerald-700 transition-colors line-clamp-1">
                            {expense.description}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-800/40 uppercase tracking-widest">
                            {expense.worker_name || expense.vendor_name || 'Divers'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex flex-col items-end">
                          <span className={cn(
                            "text-sm font-black tabular-nums transition-colors",
                            stats.isOverBudget && (new Date(expense.expense_date).getMonth() === new Date().getMonth()) ? "text-rose-600" : "text-emerald-950"
                          )}>
                            {formatNumber(expense.amount)} $
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                          <Link href={`/menage/${expense.id}/edit`}>
                            <button className="p-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all">
                              <Edit className="w-4 h-4" />
                            </button>
                          </Link>
                          <button
                            onClick={() => {
                              setExpenseToDelete(expense.id);
                              deleteModal.open();
                            }}
                            className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-8">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={filteredExpenses.length}
              itemsPerPage={itemsPerPage}
            />
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={deleteModal.close}
        onConfirm={handleDelete}
        title="Supprimer la dépense"
        message="Êtes-vous sûr de vouloir supprimer cette dépense ? Cette action est irréversible."
        variant="danger"
        confirmText="Supprimer"
        cancelText="Annuler"
      />

      {/* Modal Budget Mensuel - Redesigned */}
      <Modal
        isOpen={budgetModal.isOpen}
        onClose={budgetModal.close}
        title="Configuration du Budget"
        size="sm"
      >
        <div className="space-y-6">
          <div className="bg-emerald-50 border-2 border-emerald-100 p-4 rounded-xl">
            <label className="block text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-3">
              Cible Mensuelle ($ USD)
            </label>
            <div className="relative">
              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
              <input
                type="number"
                step="0.1"
                min="0"
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(e.target.value)}
                placeholder="0.00"
                className="w-full h-12 pl-10 pr-4 bg-white border-2 border-emerald-100 rounded-lg text-sm font-black text-emerald-950 outline-none focus:border-emerald-500 transition-all tabular-nums"
              />
            </div>
            <p className="text-[10px] font-bold text-emerald-800/40 mt-3 uppercase tracking-tight">
              Le budget permet de suivre le dépassement en temps réel.
            </p>
          </div>

          {monthlyBudget !== null && (
            <div className={cn(
              "p-4 rounded-xl border-2 transition-all",
              stats.isOverBudget ? "bg-red-50 border-red-100 shadow-sm shadow-red-500/5 transition-all" : "bg-emerald-50 border-emerald-100 shadow-sm shadow-emerald-500/5 transition-all"
            )}>
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest leading-none">État du mois</span>
                <div className={cn(
                  "px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest leading-none",
                  stats.isOverBudget ? "bg-red-500 text-white" : "bg-emerald-500 text-white"
                )}>
                  {stats.isOverBudget ? 'Dépassement' : 'Sous budget'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <span className="text-sm font-black text-emerald-950 tabular-nums leading-none mb-1">{formatNumber(stats.monthlyExpenses)} $</span>
                  <span className="text-[8px] font-black text-emerald-800/40 uppercase tracking-widest">Utilisé</span>
                </div>
                <div className="flex flex-col text-right">
                  <span className={cn(
                    "text-sm font-black tabular-nums leading-none mb-1",
                    stats.isOverBudget ? "text-red-500" : "text-emerald-500"
                  )}>
                    {stats.isOverBudget ? `+${formatNumber(stats.budgetExceeded || 0)}` : `${formatNumber(stats.budgetRemaining || 0)}`} $
                  </span>
                  <span className="text-[8px] font-black text-emerald-800/40 uppercase tracking-widest">
                    {stats.isOverBudget ? 'Excédent' : 'Disponible'}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={budgetModal.close}
              disabled={budgetLoading}
              className="flex-1 h-12 rounded-xl bg-white border-2 border-emerald-100 text-[10px] font-black uppercase tracking-widest text-emerald-800 hover:bg-emerald-50 transition-all active:scale-95"
            >
              Annuler
            </button>
            <button
              onClick={handleSaveBudget}
              disabled={budgetLoading}
              className="flex-1 h-12 rounded-xl bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 shadow-lg shadow-emerald-500/10 border-b-4 border-emerald-700 transition-all active:scale-95 flex items-center justify-center"
            >
              {budgetLoading ? 'Enregistrement...' : 'Confirmer'}
            </button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}

