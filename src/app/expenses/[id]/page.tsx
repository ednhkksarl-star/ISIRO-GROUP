'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { ArrowLeft, Download } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
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

export default function ExpenseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuth();
  const toast = useToast();
  const supabase = createSupabaseClient();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      fetchExpense();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const fetchExpense = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('id', params.id)
        .single();

      if (error) throw error;
      setExpense(data);
    } catch (error: any) {
      toast.error('Erreur lors du chargement de la dépense');
      console.error(error);
    } finally {
      setLoading(false);
    }
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

  if (!expense) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Dépense non trouvée</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/expenses"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Retour</span>
          </Link>
          {expense.receipt_url && (
            <a
              href={expense.receipt_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
            >
              <Download className="w-5 h-5" />
              <span>Voir justificatif</span>
            </a>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Dépense {expense.expense_number}
            </h1>
            <p className="text-gray-600">
              Date: {new Date(expense.expense_date).toLocaleDateString('fr-FR')}
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="font-semibold text-gray-900 mb-2">Description</h2>
              <p className="text-gray-700">{expense.description}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h2 className="font-semibold text-gray-900 mb-2">Catégorie</h2>
                <p className="text-gray-700">
                  {CATEGORY_LABELS[expense.category] || expense.category}
                </p>
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 mb-2">Montant</h2>
                <p className="text-2xl font-bold text-gray-900">
                  {formatNumber(expense.amount)} $US
                </p>
              </div>
            </div>

            {expense.vendor_name && (
              <div>
                <h2 className="font-semibold text-gray-900 mb-2">Fournisseur</h2>
                <p className="text-gray-700">{expense.vendor_name}</p>
              </div>
            )}

            <div>
              <h2 className="font-semibold text-gray-900 mb-2">Statut</h2>
              <span
                className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                  expense.status === 'approved'
                    ? 'bg-green-100 text-green-800'
                    : expense.status === 'rejected'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {STATUS_LABELS[expense.status] || expense.status}
              </span>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

