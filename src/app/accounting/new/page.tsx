'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { toast } from 'react-toastify';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { useEntity } from '@/hooks/useEntity';
import { useEntityContext } from '@/hooks/useEntityContext';
import EntitySelector from '@/components/entity/EntitySelector';
import Button from '@/components/ui/Button';
import { Plus, Trash2 } from 'lucide-react';

interface AccountingEntryForm {
  id: string; // ID temporaire pour la gestion dans le tableau
  entry_date: string;
  code: string;
  description: string;
  numero_piece: string;
  entrees: number;
  sorties: number;
  reference_type: string;
  reference_id: string;
}

function NewAccountingEntryPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const supabase = createSupabaseClient();
  const { selectedEntityId, setSelectedEntityId } = useEntity();
  const { activeEntityId } = useEntityContext();
  const [loading, setLoading] = useState(false);
  
  // Déterminer l'entité à utiliser (priorité: paramètre URL > contexte > sélection > profil)
  const targetEntityId = searchParams?.get('entity') || activeEntityId || selectedEntityId || profile?.entity_id || null;
  
  // Vérifier si l'utilisateur peut sélectionner une entité
  const canSelectEntity = profile?.role === 'SUPER_ADMIN_GROUP' || 
                          profile?.role === 'ADMIN_ENTITY' ||
                          (profile?.entity_ids && profile.entity_ids.length > 1);
  
  const [currency, setCurrency] = useState<'USD' | 'CDF'>('USD');
  const { convertToUSD } = useExchangeRate();
  
  // Tableau d'écritures
  const [entries, setEntries] = useState<AccountingEntryForm[]>([
    {
      id: Date.now().toString(),
      entry_date: new Date().toISOString().split('T')[0],
      code: '',
      description: '',
      numero_piece: '',
      entrees: 0,
      sorties: 0,
      reference_type: '',
      reference_id: '',
    },
  ]);

  const addEntry = () => {
    setEntries([
      ...entries,
      {
        id: Date.now().toString(),
        entry_date: entries[0]?.entry_date || new Date().toISOString().split('T')[0],
        code: '',
        description: '',
        numero_piece: '',
        entrees: 0,
        sorties: 0,
        reference_type: '',
        reference_id: '',
      },
    ]);
  };

  const removeEntry = (id: string) => {
    if (entries.length > 1) {
      setEntries(entries.filter((entry) => entry.id !== id));
    } else {
      toast.error('Vous devez avoir au moins une écriture');
    }
  };

  const updateEntry = (id: string, field: keyof AccountingEntryForm, value: any) => {
    setEntries(
      entries.map((entry) => {
        if (entry.id === id) {
          const updated = { ...entry, [field]: value };
          // Si entrees est renseigné, réinitialiser sorties et vice versa
          if (field === 'entrees' && value !== '' && parseFloat(value) > 0) {
            updated.sorties = 0;
          } else if (field === 'sorties' && value !== '' && parseFloat(value) > 0) {
            updated.entrees = 0;
          }
          return updated;
        }
        return entry;
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEntityId) {
      toast.error('Veuillez sélectionner une entité');
      return;
    }

    // Valider toutes les écritures
    const invalidEntries = entries.filter(
      (entry) => !entry.description.trim() || (entry.entrees === 0 && entry.sorties === 0)
    );

    if (invalidEntries.length > 0) {
      toast.error('Toutes les écritures doivent avoir un libellé et des entrées ou sorties');
      return;
    }

    setLoading(true);
    try {
      // Calculer le solde actuel
      const { data: lastEntry } = await supabase
        .from('accounting_entries')
        .select('balance')
        .eq('entity_id', targetEntityId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let currentBalance = (lastEntry as { balance: number } | null)?.balance || 0;

      // Générer les numéros d'écriture
      const year = new Date(entries[0].entry_date).getFullYear();
      const { count } = await supabase
        .from('accounting_entries')
        .select('*', { count: 'exact', head: true })
        .eq('entity_id', targetEntityId)
        .gte('entry_date', `${year}-01-01`)
        .lte('entry_date', `${year}-12-31`);

      const baseEntryNumber = (count || 0) + 1;

      // Préparer toutes les écritures
      const entriesToInsert = entries.map((entry, index) => {
        const entreesUSD = currency === 'USD' ? entry.entrees : convertToUSD(entry.entrees);
        const sortiesUSD = currency === 'USD' ? entry.sorties : convertToUSD(entry.sorties);
        
        // Calculer le solde cumulatif
        currentBalance = currentBalance + entreesUSD - sortiesUSD;
        
        const entryNumber = `EC-${year}-${String(baseEntryNumber + index).padStart(4, '0')}`;

        return {
          entity_id: targetEntityId,
          entry_number: entryNumber,
          entry_date: entry.entry_date,
          code: entry.code || null,
          description: entry.description,
          numero_piece: entry.numero_piece || null,
          entrees: entreesUSD,
          sorties: sortiesUSD,
          balance: currentBalance,
          currency: currency,
          debit: entreesUSD,
          credit: sortiesUSD,
          reference_type: entry.reference_type || null,
          reference_id: entry.reference_id || null,
          created_by: profile?.id || '',
        };
      });

      // Insérer toutes les écritures en une seule transaction
      const { error } = await supabase
        .from('accounting_entries')
        .insert(entriesToInsert as any);

      if (error) throw error;

      toast.success(`${entries.length} écriture(s) créée(s) avec succès`);
      router.push('/accounting');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6 px-4 sm:px-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-text">Nouvelle écriture</h1>
            <p className="text-text-light mt-1 text-sm sm:text-base">Créer une ou plusieurs écritures dans le livre de caisse</p>
          </div>
          {canSelectEntity && profile && (
            <EntitySelector
              selectedEntityId={selectedEntityId}
              onSelectEntity={setSelectedEntityId}
              userRole={profile.role}
              userEntityIds={profile.entity_ids}
              className="w-auto"
            />
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {/* Sélecteur de devise (commun à toutes les écritures) */}
          <div className="bg-white rounded-lg shadow p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Devise * (appliquée à toutes les écritures)
            </label>
            <select
              required
              value={currency}
              onChange={(e) => setCurrency(e.target.value as 'USD' | 'CDF')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="USD">USD (Dollar américain)</option>
              <option value="CDF">CDF (Franc congolais)</option>
            </select>
          </div>

          {/* Tableau des écritures */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Code
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Libellé
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      N° Pièce
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Entrées
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sorties
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <input
                          type="date"
                          required
                          value={entry.entry_date}
                          onChange={(e) => updateEntry(entry.id, 'entry_date', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <input
                          type="text"
                          value={entry.code}
                          onChange={(e) => updateEntry(entry.id, 'code', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                          placeholder="Code"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          required
                          value={entry.description}
                          onChange={(e) => updateEntry(entry.id, 'description', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                          placeholder="Libellé *"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <input
                          type="text"
                          value={entry.numero_piece}
                          onChange={(e) => updateEntry(entry.id, 'numero_piece', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                          placeholder="N° Pièce"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={entry.entrees === 0 ? '' : entry.entrees}
                          onChange={(e) => {
                            const value = e.target.value;
                            updateEntry(entry.id, 'entrees', value === '' ? 0 : parseFloat(value) || 0);
                          }}
                          onFocus={(e) => {
                            if (e.target.value === '0') {
                              e.target.value = '';
                            }
                          }}
                          className="w-full px-2 py-1 border-2 border-green-300 rounded text-sm text-right bg-green-50/50 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={entry.sorties === 0 ? '' : entry.sorties}
                          onChange={(e) => {
                            const value = e.target.value;
                            updateEntry(entry.id, 'sorties', value === '' ? 0 : parseFloat(value) || 0);
                          }}
                          onFocus={(e) => {
                            if (e.target.value === '0') {
                              e.target.value = '';
                            }
                          }}
                          className="w-full px-2 py-1 border-2 border-red-300 rounded text-sm text-right bg-red-50/50 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <button
                          type="button"
                          onClick={() => removeEntry(entry.id)}
                          className="text-red-600 hover:text-red-700 p-1"
                          disabled={entries.length === 1}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bouton Ajouter une écriture */}
          <div className="flex justify-start">
            <Button
              type="button"
              variant="outline"
              icon={<Plus className="w-4 h-4" />}
              onClick={addEntry}
            >
              Ajouter une écriture
            </Button>
          </div>

          {/* Boutons de soumission */}
          <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.back()}
              className="w-full sm:w-auto"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              loading={loading}
              disabled={loading || !targetEntityId}
              className="w-full sm:w-auto"
            >
              {loading ? 'Création...' : `Enregistrer ${entries.length} écriture(s)`}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}

export default function NewAccountingEntryPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    }>
      <NewAccountingEntryPageContent />
    </Suspense>
  );
}
