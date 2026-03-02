'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { Plus, Search, Download, Filter, X, ChevronDown, Trash2, Eye, Pencil, FileDown } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'react-toastify';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import BackButton from '@/components/ui/BackButton';
import Pagination from '@/components/ui/Pagination';
import { useEntity } from '@/hooks/useEntity';
import EntitySelector from '@/components/entity/EntitySelector';
import { normalizeEntityIds, getEntityUUID } from '@/utils/entityHelpers';
import { generateAccountingPDF } from '@/utils/generateAccountingPDF';
import { formatNumber } from '@/utils/formatNumber';
import type { Database } from '@/types/database.types';

type AccountingEntry = Database['public']['Tables']['accounting_entries']['Row'];

interface AdvancedFilters {
  dateFrom: string;
  dateTo: string;
  code: string;
  minAmount: string;
  maxAmount: string;
  type: 'all' | 'entrees' | 'sorties';
}

function AccountingPageContent() {
  const { profile } = useAuth();
  const { selectedEntityId: globalSelectedEntityId, isGroupView, setSelectedEntityId } = useEntity();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [balance, setBalance] = useState(0);
  const [localSelectedEntityId, setLocalSelectedEntityId] = useState<string | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    dateFrom: '',
    dateTo: '',
    code: '',
    minAmount: '',
    maxAmount: '',
    type: 'all',
  });
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<AccountingEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const supabase = createSupabaseClient();

  // Utiliser l'entité depuis les paramètres de requête, la sélection locale, ou la sélection globale
  // Pour Super Admin/Admin Entity, selectedEntityId peut être null (vue consolidée)
  const entityId = searchParams?.get('entity') || localSelectedEntityId || (isGroupView ? null : globalSelectedEntityId);

  // Vérifier si l'utilisateur peut sélectionner une entité
  const canSelectEntity = profile?.role === 'SUPER_ADMIN_GROUP' || 
                          profile?.role === 'ADMIN_ENTITY' ||
                          (profile?.entity_ids && profile.entity_ids.length > 1);

  // Initialiser localSelectedEntityId depuis les paramètres ou la sélection globale
  useEffect(() => {
    const entityParam = searchParams?.get('entity');
    if (entityParam) {
      // Convertir le paramètre (code ou UUID) en UUID avant de le stocker
      getEntityUUID(entityParam).then((uuid) => {
        if (uuid) {
          setLocalSelectedEntityId(uuid);
          // Synchroniser aussi le contexte global pour Super Admin et Admin Entity
          if (profile?.role === 'SUPER_ADMIN_GROUP' || profile?.role === 'ADMIN_ENTITY') {
            setSelectedEntityId(uuid);
          }
        }
      });
    } else {
      // Synchroniser avec la sélection globale
      setLocalSelectedEntityId(globalSelectedEntityId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, globalSelectedEntityId]);

  useEffect(() => {
    fetchEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, entityId, advancedFilters]);

  const handleEntityChange = (newEntityId: string | null) => {
    // Mettre à jour la sélection globale ET locale
    setSelectedEntityId(newEntityId);
    setLocalSelectedEntityId(newEntityId);
    // Mettre à jour l'URL avec le paramètre entity
    const params = new URLSearchParams(searchParams?.toString());
    if (newEntityId) {
      params.set('entity', newEntityId);
    } else {
      params.delete('entity');
    }
    router.push(`/accounting?${params.toString()}`);
  };

  const fetchEntries = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('accounting_entries')
        .select('*');

      // Système intelligent : appliquer automatiquement les filtres selon le rôle et l'entité
      // Super Admin et Admin Entity en vue consolidée (entityId = null) : voir toutes les données
      if (profile && (profile.role === 'SUPER_ADMIN_GROUP' || profile.role === 'ADMIN_ENTITY')) {
        // Si une entité spécifique est sélectionnée, filtrer par cette entité
        if (entityId) {
          const uuid = await getEntityUUID(entityId);
          if (uuid) {
            query = query.eq('entity_id', uuid);
          } else {
            query = query.eq('id', '00000000-0000-0000-0000-000000000000');
          }
        }
        // Sinon (vue consolidée, entityId = null), pas de filtre = voir toutes les données
      } else if (profile) {
        // Pour tous les autres utilisateurs (y compris AGENT_ACCUEIL, MANAGER_ENTITY, etc.),
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

      // Filtres avancés
      if (advancedFilters.dateFrom) {
        query = query.gte('entry_date', advancedFilters.dateFrom);
      }
      if (advancedFilters.dateTo) {
        query = query.lte('entry_date', advancedFilters.dateTo);
      }
      if (advancedFilters.code) {
        query = query.ilike('code', `%${advancedFilters.code}%`);
      }
      if (advancedFilters.type === 'entrees') {
        query = query.gt('entrees', 0);
      } else if (advancedFilters.type === 'sorties') {
        query = query.gt('sorties', 0);
      }

      // Trier
      query = query.order('entry_date', { ascending: false }).order('entry_number', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      let filteredData: AccountingEntry[] = (data || []) as AccountingEntry[];

      // Filtres côté client (montants, car ils nécessitent des calculs)
      if (advancedFilters.minAmount) {
        const minAmount = parseFloat(advancedFilters.minAmount);
        if (!isNaN(minAmount)) {
          filteredData = filteredData.filter((entry) => {
            const total = (entry.entrees || 0) + (entry.sorties || 0);
            return total >= minAmount;
          });
        }
      }
      if (advancedFilters.maxAmount) {
        const maxAmount = parseFloat(advancedFilters.maxAmount);
        if (!isNaN(maxAmount)) {
          filteredData = filteredData.filter((entry) => {
            const total = (entry.entrees || 0) + (entry.sorties || 0);
            return total <= maxAmount;
          });
        }
      }

      setEntries(filteredData);

      // Calculer le solde (entrees - sorties) avec les données filtrées
      const totalBalance =
        filteredData.reduce((sum, entry) => sum + ((entry.entrees || 0) - (entry.sorties || 0)), 0) || 0;
      setBalance(totalBalance);
    } catch (error: any) {
      toast.error('Erreur lors du chargement des écritures');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const clearAdvancedFilters = () => {
    setAdvancedFilters({
      dateFrom: '',
      dateTo: '',
      code: '',
      minAmount: '',
      maxAmount: '',
      type: 'all',
    });
  };

  const hasActiveFilters = () => {
    return !!(
      advancedFilters.dateFrom ||
      advancedFilters.dateTo ||
      advancedFilters.code ||
      advancedFilters.minAmount ||
      advancedFilters.maxAmount ||
      advancedFilters.type !== 'all'
    );
  };

  // Filtrer par terme de recherche (recherche texte uniquement)
  const filteredEntries = useMemo(
    () =>
      entries.filter(
    (entry) =>
      entry.entry_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
          entry.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (entry.code && entry.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (entry.numero_piece && entry.numero_piece.toLowerCase().includes(searchTerm.toLowerCase()))
      ),
    [entries, searchTerm]
  );

  // Pagination
  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage);
  const paginatedEntries = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredEntries.slice(startIndex, endIndex);
  }, [filteredEntries, currentPage, itemsPerPage]);

  // Réinitialiser la page si elle est hors limites
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const handleDeleteClick = (entry: AccountingEntry) => {
    setEntryToDelete(entry);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!entryToDelete) return;

    try {
      setDeleting(true);
      const { error } = await supabase
        .from('accounting_entries')
        .delete()
        .eq('id', entryToDelete.id);

      if (error) throw error;

      toast.success('Écriture supprimée avec succès');
      setDeleteModalOpen(false);
      setEntryToDelete(null);
      fetchEntries(); // Rafraîchir la liste
    } catch (error: any) {
      toast.error('Erreur lors de la suppression: ' + (error.message || 'Une erreur est survenue'));
      console.error(error);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false);
    setEntryToDelete(null);
  };

  const exportToCSV = () => {
    const headers = ['N°', 'DATE', 'CODE', 'LIBELLE', 'N° PIECE', 'ENTREES', 'SORTIES', 'SOLDE'];
    const rows = filteredEntries.map((entry) => [
      entry.entry_number,
      new Date(entry.entry_date).toLocaleDateString('fr-FR'),
      entry.code || '',
      entry.description,
      entry.numero_piece || '',
      formatNumber(entry.entrees ?? 0),
      formatNumber(entry.sorties ?? 0),
      formatNumber(entry.balance),
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell)}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `comptabilite-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleExportPDF = async () => {
    setGeneratingPDF(true);
    try {
      let entityInfo: { name: string; code: string } | null = null;
      if (entityId) {
        const uuid = await getEntityUUID(entityId);
        if (uuid) {
          const { data } = await supabase
            .from('entities')
            .select('name, code')
            .eq('id', uuid)
            .maybeSingle();
          const entityData = data as { name: string; code: string } | null;
          if (entityData) {
            entityInfo = { name: entityData.name, code: entityData.code };
          }
        }
      }
      await generateAccountingPDF({
        entries: filteredEntries.map((e) => ({
          entry_number: e.entry_number,
          entry_date: e.entry_date,
          code: e.code,
          description: e.description,
          numero_piece: e.numero_piece,
          entrees: e.entrees ?? 0,
          sorties: e.sorties ?? 0,
          balance: e.balance ?? 0,
        })),
        balance,
        entity: entityInfo,
        dateFrom: advancedFilters.dateFrom || undefined,
        dateTo: advancedFilters.dateTo || undefined,
      });
      toast.success('PDF généré avec succès');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Erreur lors de la génération du PDF');
    } finally {
      setGeneratingPDF(false);
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

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Bouton retour */}
        <BackButton href="/dashboard" />

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-text">Livre de Caisse</h1>
            <p className="text-text-light mt-1 text-sm sm:text-base">Journal des entrées et sorties de caisse</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="secondary"
              onClick={exportToCSV}
              icon={<Download className="w-5 h-5" />}
            >
              Exporter CSV
            </Button>
            <Button
              variant="secondary"
              onClick={handleExportPDF}
              loading={generatingPDF}
              disabled={generatingPDF || filteredEntries.length === 0}
              icon={<FileDown className="w-5 h-5" />}
            >
              {generatingPDF ? 'Génération...' : 'Exporter PDF'}
            </Button>
            <Link href={entityId ? `/accounting/new?entity=${entityId}` : '/accounting/new'}>
              <Button icon={<Plus className="w-5 h-5" />}>
                Nouvelle écriture
              </Button>
            </Link>
          </div>
        </div>

        {/* Balance Summary */}
        <Card>
          <div className="flex justify-between items-center">
            <span className="text-lg font-medium text-text">Solde total:</span>
            <span
              className={`text-2xl font-bold ${
                balance >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {formatNumber(balance)} $US
            </span>
          </div>
        </Card>

        {/* Entity Selector and Filters */}
        <div className="bg-white rounded-lg shadow p-4 space-y-4">
          {/* Entity Selector */}
          {canSelectEntity && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                Filtrer par entité:
              </label>
              <EntitySelector
                selectedEntityId={localSelectedEntityId || globalSelectedEntityId}
                onSelectEntity={handleEntityChange}
                userRole={profile?.role || ''}
                userEntityIds={profile?.entity_ids || null}
              />
            </div>
          )}

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher une écriture..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Advanced Filters Toggle */}
          <div className="flex items-center justify-between pt-2 border-t">
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-dark transition-colors"
            >
              <Filter className="w-4 h-4" />
              <span>Filtres avancés</span>
              {hasActiveFilters() && (
                <span className="bg-primary text-white text-xs px-2 py-0.5 rounded-full">
                  Actifs
                </span>
              )}
              <ChevronDown
                className={`w-4 h-4 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`}
              />
            </button>
            {hasActiveFilters() && (
              <button
                onClick={clearAdvancedFilters}
                className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Réinitialiser
              </button>
            )}
          </div>

          {/* Advanced Filters Panel */}
          {showAdvancedFilters && (
            <div className="pt-4 border-t space-y-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Date From */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date de début
                </label>
                <input
                  type="date"
                  value={advancedFilters.dateFrom}
                  onChange={(e) =>
                    setAdvancedFilters({ ...advancedFilters, dateFrom: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date de fin
                </label>
                <input
                  type="date"
                  value={advancedFilters.dateTo}
                  onChange={(e) =>
                    setAdvancedFilters({ ...advancedFilters, dateTo: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                />
              </div>

              {/* Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code
                </label>
                <input
                  type="text"
                  placeholder="Rechercher par code..."
                  value={advancedFilters.code}
                  onChange={(e) =>
                    setAdvancedFilters({ ...advancedFilters, code: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <select
                  value={advancedFilters.type}
                  onChange={(e) =>
                    setAdvancedFilters({
                      ...advancedFilters,
                      type: e.target.value as 'all' | 'entrees' | 'sorties',
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                >
                  <option value="all">Tous</option>
                  <option value="entrees">Entrées uniquement</option>
                  <option value="sorties">Sorties uniquement</option>
                </select>
              </div>

              {/* Min Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Montant minimum (USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={advancedFilters.minAmount}
                  onChange={(e) =>
                    setAdvancedFilters({ ...advancedFilters, minAmount: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                />
              </div>

              {/* Max Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Montant maximum (USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={advancedFilters.maxAmount}
                  onChange={(e) =>
                    setAdvancedFilters({ ...advancedFilters, maxAmount: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* Entries Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-primary/10 to-primary/5">
                <tr>
                  <th className="px-3 sm:px-6 py-3 text-left text-[10px] sm:text-xs font-bold text-primary uppercase tracking-wider">
                    N°
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-[10px] sm:text-xs font-bold text-primary uppercase tracking-wider">
                    DATE
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-[10px] sm:text-xs font-bold text-primary uppercase tracking-wider">
                    CODE
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-[10px] sm:text-xs font-bold text-primary uppercase tracking-wider">
                    LIBELLE
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-[10px] sm:text-xs font-bold text-primary uppercase tracking-wider">
                    N° PIECE
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-right text-[10px] sm:text-xs font-bold text-primary uppercase tracking-wider">
                    ENTREES
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-right text-[10px] sm:text-xs font-bold text-primary uppercase tracking-wider">
                    SORTIES
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-right text-[10px] sm:text-xs font-bold text-primary uppercase tracking-wider">
                    SOLDE
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-center text-[10px] sm:text-xs font-bold text-primary uppercase tracking-wider">
                    ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedEntries.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                      {filteredEntries.length === 0 ? 'Aucune écriture trouvée' : 'Aucune écriture sur cette page'}
                    </td>
                  </tr>
                ) : (
                  paginatedEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent transition-all duration-200">
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">
                        {entry.entry_number}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                        {new Date(entry.entry_date).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                        {entry.code || '-'}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-500">
                        <div className="truncate max-w-[200px] sm:max-w-none">{entry.description}</div>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                        {entry.numero_piece || '-'}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-right text-green-600 font-medium">
                        {(entry.entrees || 0) > 0
                          ? formatNumber(entry.entrees || 0)
                          : '-'}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-right text-red-600 font-medium">
                        {(entry.sorties || 0) > 0
                          ? formatNumber(entry.sorties || 0)
                          : '-'}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-right font-bold">
                        {formatNumber(entry.balance)} $US
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Bouton Voir détail */}
                          <Link href={`/accounting/${entry.id}`}>
                            <button
                              className="inline-flex items-center justify-center p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg transition-colors duration-200"
                              title="Voir le détail"
                            >
                              <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                          </Link>
                          {/* Bouton Modifier */}
                          <Link href={`/accounting/${entry.id}/edit`}>
                            <button
                              className="inline-flex items-center justify-center p-2 text-amber-600 hover:text-amber-800 hover:bg-amber-100 rounded-lg transition-colors duration-200"
                              title="Modifier cette écriture"
                            >
                              <Pencil className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                          </Link>
                          {/* Bouton Supprimer (Super Admin uniquement) */}
                          {profile?.role === 'SUPER_ADMIN_GROUP' && (
                            <button
                              onClick={() => handleDeleteClick(entry)}
                              className="inline-flex items-center justify-center p-2 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-lg transition-colors duration-200"
                              title="Supprimer cette écriture"
                            >
                              <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white rounded-lg shadow p-4">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              totalItems={filteredEntries.length}
            />
          </div>
        )}

        {/* Modal de confirmation de suppression */}
        {deleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Overlay */}
            <div 
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={handleDeleteCancel}
            />
            
            {/* Modal */}
            <div className="relative bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 transform transition-all">
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
                Confirmer la suppression
              </h3>
              
              <p className="text-sm text-gray-600 text-center mb-4">
                Êtes-vous sûr de vouloir supprimer cette écriture ?
              </p>
              
              {entryToDelete && (
                <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-500">N°:</span>
                    <span className="font-medium">{entryToDelete.entry_number}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-500">Date:</span>
                    <span className="font-medium">{new Date(entryToDelete.entry_date).toLocaleDateString('fr-FR')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Libellé:</span>
                    <span className="font-medium truncate max-w-[200px]">{entryToDelete.description}</span>
                  </div>
                </div>
              )}
              
              <p className="text-xs text-red-600 text-center mb-6">
                Cette action est irréversible.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={handleDeleteCancel}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Suppression...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Supprimer
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function AccountingPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    }>
      <AccountingPageContent />
    </Suspense>
  );
}
