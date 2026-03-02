'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { toast } from 'react-toastify';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import BackButton from '@/components/ui/BackButton';
import { Save, X } from 'lucide-react';
import Link from 'next/link';
import { formatNumber } from '@/utils/formatNumber';
import type { Database } from '@/types/database.types';

type AccountingEntry = Database['public']['Tables']['accounting_entries']['Row'];

interface EntryFormData {
  entry_date: string;
  code: string;
  description: string;
  numero_piece: string;
  entrees: number;
  sorties: number;
}

function EditAccountingEntryContent() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuth();
  const [entry, setEntry] = useState<AccountingEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<EntryFormData>({
    entry_date: '',
    code: '',
    description: '',
    numero_piece: '',
    entrees: 0,
    sorties: 0,
  });
  const supabase = createSupabaseClient();

  const entryId = params?.id as string;

  useEffect(() => {
    if (entryId) {
      fetchEntry();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId]);

  const fetchEntry = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('accounting_entries')
        .select('*')
        .eq('id', entryId)
        .single();

      if (error) throw error;
      
      const entryData = data as AccountingEntry;
      setEntry(entryData);
      setFormData({
        entry_date: entryData.entry_date,
        code: entryData.code || '',
        description: entryData.description,
        numero_piece: entryData.numero_piece || '',
        entrees: entryData.entrees || 0,
        sorties: entryData.sorties || 0,
      });
    } catch (error: any) {
      toast.error('Erreur lors du chargement de l\'écriture');
      console.error(error);
      router.push('/accounting');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof EntryFormData, value: any) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      // Si entrees est renseigné, réinitialiser sorties et vice versa
      if (field === 'entrees' && value !== '' && parseFloat(value) > 0) {
        updated.sorties = 0;
      } else if (field === 'sorties' && value !== '' && parseFloat(value) > 0) {
        updated.entrees = 0;
      }
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.description.trim()) {
      toast.error('Le libellé est obligatoire');
      return;
    }

    if (formData.entrees === 0 && formData.sorties === 0) {
      toast.error('Vous devez saisir une entrée ou une sortie');
      return;
    }

    setSaving(true);
    try {
      // Calculer la différence pour mettre à jour le solde
      const oldEntrees = entry?.entrees || 0;
      const oldSorties = entry?.sorties || 0;
      const newEntrees = formData.entrees;
      const newSorties = formData.sorties;
      
      const difference = (newEntrees - newSorties) - (oldEntrees - oldSorties);
      const newBalance = (entry?.balance || 0) + difference;

      const { error } = await (supabase
        .from('accounting_entries') as any)
        .update({
          entry_date: formData.entry_date,
          code: formData.code || null,
          description: formData.description,
          numero_piece: formData.numero_piece || null,
          entrees: formData.entrees,
          sorties: formData.sorties,
          debit: formData.entrees,
          credit: formData.sorties,
          balance: newBalance,
          updated_at: new Date().toISOString(),
        })
        .eq('id', entryId);

      if (error) throw error;

      toast.success('Écriture modifiée avec succès');
      router.push(`/accounting/${entryId}`);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la modification');
      console.error(error);
    } finally {
      setSaving(false);
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

  if (!entry) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Écriture non trouvée</p>
          <Link href="/accounting">
            <Button variant="secondary" className="mt-4">
              Retour au livre de caisse
            </Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* En-tête */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <BackButton href={`/accounting/${entryId}`} />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-text">Modifier l&apos;écriture</h1>
              <p className="text-text-light mt-1">{entry.entry_number}</p>
            </div>
          </div>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit}>
          <Card>
            <div className="p-6 space-y-6">
              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.entry_date}
                  onChange={(e) => handleChange('entry_date', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary"
                />
              </div>

              {/* Code et N° Pièce */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Code
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => handleChange('code', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary"
                    placeholder="Code optionnel"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Numéro de pièce
                  </label>
                  <input
                    type="text"
                    value={formData.numero_piece}
                    onChange={(e) => handleChange('numero_piece', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary"
                    placeholder="N° de pièce optionnel"
                  />
                </div>
              </div>

              {/* Libellé */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Libellé *
                </label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary resize-none"
                  placeholder="Description de l'opération"
                />
              </div>

              {/* Montants */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Entrées (USD)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.entrees === 0 ? '' : formData.entrees}
                    onChange={(e) => {
                      const value = e.target.value;
                      handleChange('entrees', value === '' ? 0 : parseFloat(value) || 0);
                    }}
                    onFocus={(e) => {
                      if (e.target.value === '0') {
                        e.target.value = '';
                      }
                    }}
                    className="w-full px-4 py-2 border-2 border-green-300 rounded-lg bg-green-50/50 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-right"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sorties (USD)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.sorties === 0 ? '' : formData.sorties}
                    onChange={(e) => {
                      const value = e.target.value;
                      handleChange('sorties', value === '' ? 0 : parseFloat(value) || 0);
                    }}
                    onFocus={(e) => {
                      if (e.target.value === '0') {
                        e.target.value = '';
                      }
                    }}
                    className="w-full px-4 py-2 border-2 border-red-300 rounded-lg bg-red-50/50 focus:ring-2 focus:ring-red-500 focus:border-red-500 text-right"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Aperçu du solde */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">Aperçu après modification:</p>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Nouveau solde estimé:</span>
                  <span className={`text-lg font-bold ${
                    ((entry?.balance || 0) + ((formData.entrees - formData.sorties) - ((entry?.entrees || 0) - (entry?.sorties || 0)))) >= 0 
                      ? 'text-green-600' 
                      : 'text-red-600'
                  }`}>
                    {formatNumber((entry?.balance || 0) + ((formData.entrees - formData.sorties) - ((entry?.entrees || 0) - (entry?.sorties || 0))))} $US
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Boutons */}
          <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6">
            <Link href={`/accounting/${entryId}`}>
              <Button type="button" variant="secondary" icon={<X className="w-5 h-5" />} className="w-full sm:w-auto">
                Annuler
              </Button>
            </Link>
            <Button
              type="submit"
              loading={saving}
              disabled={saving}
              icon={<Save className="w-5 h-5" />}
              className="w-full sm:w-auto"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}

export default function EditAccountingEntryPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    }>
      <EditAccountingEntryContent />
    </Suspense>
  );
}
