'use client';

import { useEffect, useState, useMemo, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import {
  Plus,
  Search,
  Download,
  Filter,
  X,
  ChevronDown,
  Trash2,
  Eye,
  Pencil,
  FileDown,
  ChevronLeft,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import AccountingEntryForm from '@/components/accounting/AccountingEntryForm';
import { useEntity } from '@/hooks/useEntity';
import { useEntityContext } from '@/hooks/useEntityContext';
import { useModal } from '@/hooks/useModal';
import EntitySelector from '@/components/entity/EntitySelector';
import { normalizeEntityIds, getEntityUUID } from '@/utils/entityHelpers';
import { generateAccountingPDF } from '@/utils/generateAccountingPDF';
import { formatNumber } from '@/utils/formatNumber';
import { cn } from '@/utils/cn';
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
  const toast = useToast();
  const { selectedEntityId: globalSelectedEntityId, isGroupView, setSelectedEntityId } = useEntity();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const entryModal = useModal();
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
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

  // Determine entity
  const entityId = searchParams?.get('entity') || localSelectedEntityId || (isGroupView ? null : globalSelectedEntityId);

  // Check role permissions
  const canSelectEntity = profile?.role === 'SUPER_ADMIN_GROUP' ||
    profile?.role === 'ADMIN_ENTITY' ||
    (profile?.entity_ids && profile.entity_ids.length > 1);

  // Sync entity from params
  useEffect(() => {
    const entityParam = searchParams?.get('entity');
    if (entityParam) {
      getEntityUUID(entityParam).then((uuid) => {
        if (uuid) {
          setLocalSelectedEntityId(uuid);
          if (profile?.role === 'SUPER_ADMIN_GROUP' || profile?.role === 'ADMIN_ENTITY') {
            setSelectedEntityId(uuid);
          }
        }
      });
    } else {
      setLocalSelectedEntityId(globalSelectedEntityId);
    }
  }, [searchParams, globalSelectedEntityId, profile?.role, setSelectedEntityId]);

  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase.from('accounting_entries').select('*');

      if (profile && (profile.role === 'SUPER_ADMIN_GROUP' || profile.role === 'ADMIN_ENTITY')) {
        if (entityId) {
          const uuid = await getEntityUUID(entityId);
          if (uuid) query = query.eq('entity_id', uuid);
        }
      } else if (profile) {
        if (profile.entity_ids && profile.entity_ids.length > 0) {
          const uuids = await normalizeEntityIds(profile.entity_ids);
          if (uuids.length > 0) query = query.in('entity_id', uuids);
        } else if (profile.entity_id) {
          const uuid = await getEntityUUID(profile.entity_id);
          if (uuid) query = query.eq('entity_id', uuid);
        }
      }

      if (advancedFilters.dateFrom) query = query.gte('entry_date', advancedFilters.dateFrom);
      if (advancedFilters.dateTo) query = query.lte('entry_date', advancedFilters.dateTo);
      if (advancedFilters.code) query = query.ilike('code', `%${advancedFilters.code}%`);

      if (advancedFilters.type === 'entrees') query = query.gt('entrees', 0);
      else if (advancedFilters.type === 'sorties') query = query.gt('sorties', 0);

      query = query.order('entry_date', { ascending: false }).order('entry_number', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      let filteredData = (data || []) as AccountingEntry[];
      setEntries(filteredData);

      const totalBalance = filteredData.reduce((sum, entry) => sum + ((entry.entrees || 0) - (entry.sorties || 0)), 0);
      setBalance(totalBalance);
    } catch (error) {
      toast.error('Erreur lors du chargement des écritures');
    } finally {
      setLoading(false);
    }
  }, [supabase, profile, entityId, advancedFilters]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleEntityChange = (newEntityId: string | null) => {
    setSelectedEntityId(newEntityId);
    setLocalSelectedEntityId(newEntityId);
    const params = new URLSearchParams(searchParams?.toString());
    if (newEntityId) params.set('entity', newEntityId);
    else params.delete('entity');
    router.push(`/accounting?${params.toString()}`);
  };

  const clearAdvancedFilters = () => {
    setAdvancedFilters({
      dateFrom: '', dateTo: '', code: '', minAmount: '', maxAmount: '', type: 'all'
    });
  };

  const hasActiveFilters = () => {
    return !!(advancedFilters.dateFrom || advancedFilters.dateTo || advancedFilters.code || advancedFilters.type !== 'all');
  };

  const filteredEntries = useMemo(() =>
    entries.filter(entry =>
      entry.entry_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (entry.code && entry.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (entry.numero_piece && entry.numero_piece.toLowerCase().includes(searchTerm.toLowerCase()))
    ), [entries, searchTerm]
  );

  // Pagination
  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage);
  const paginatedEntries = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredEntries.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredEntries, currentPage, itemsPerPage]);

  const handleDeleteConfirm = async () => {
    if (!entryToDelete) return;
    try {
      setDeleting(true);
      const { error } = await supabase.from('accounting_entries').delete().eq('id', entryToDelete.id);
      if (error) throw error;
      toast.success('Écriture supprimée');
      setDeleteModalOpen(false);
      setEntryToDelete(null);
      fetchEntries();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    } finally {
      setDeleting(false);
    }
  };

  const handleExportPDF = async () => {
    setGeneratingPDF(true);
    try {
      let entityInfo = null;
      if (entityId) {
        const uuid = await getEntityUUID(entityId);
        if (uuid) {
          const { data } = await supabase.from('entities').select('name, code').eq('id', uuid).maybeSingle();
          if (data) entityInfo = data as { name: string; code: string };
        }
      }
      await generateAccountingPDF({
        entries: filteredEntries.map(e => ({
          entry_number: e.entry_number,
          entry_date: e.entry_date,
          code: e.code,
          description: e.description,
          numero_piece: e.numero_piece,
          entrees: e.entrees || 0,
          sorties: e.sorties || 0,
          balance: e.balance || 0,
        })),
        balance,
        entity: entityInfo,
        dateFrom: advancedFilters.dateFrom || undefined,
        dateTo: advancedFilters.dateTo || undefined,
      });
      toast.success('PDF généré');
    } catch (err) {
      toast.error('Erreur PDF');
    } finally {
      setGeneratingPDF(false);
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

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
        {/* Header Block - Repertoire Style */}
        <div className="bg-white border-2 border-emerald-100 p-6 sm:p-8 rounded-xl relative overflow-hidden group shadow-sm transition-all hover:border-emerald-200">
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-50 rounded-full -mr-24 -mt-24 transition-transform duration-500 group-hover:scale-110 opacity-50" />

          <div className="flex flex-col md:flex-row justify-between items-center sm:items-end gap-8 relative z-10">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 rounded-full border border-emerald-100 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Finance & Trésorerie</span>
              </div>

              <div className="relative">
                <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-emerald-950 uppercase leading-none">
                  Livre de <span className="text-emerald-500">Caisse</span>
                </h1>
              </div>

              <div className="flex items-center gap-2 justify-center md:justify-start">
                <span className="w-8 h-1 bg-yellow-500 rounded-full shrink-0" />
                <p className="text-emerald-700/70 font-bold uppercase tracking-[0.2em] text-[10px]">
                  Journal des flux financiers et écritures comptables certifiées
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <button
                onClick={handleExportPDF}
                disabled={generatingPDF || filteredEntries.length === 0}
                className="h-14 px-6 bg-white border-2 border-emerald-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:bg-emerald-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 shadow-sm min-w-[160px]"
              >
                {generatingPDF ? <div className="w-5 h-5 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" /> : <FileDown className="w-5 h-5" />}
                Exporter PDF
              </button>
              <button
                onClick={() => { setEditingEntryId(null); entryModal.open(); }}
                className="h-14 px-8 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-success/20 flex items-center justify-center gap-3 border-b-4 border-emerald-700 min-w-[200px]"
              >
                <Plus className="w-5 h-5 stroke-[4]" />
                Nouvelle écriture
              </button>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border-2 border-emerald-100 rounded-xl p-6 relative overflow-hidden group shadow-sm transition-all hover:border-emerald-200">
            <div className="absolute top-0 left-0 w-1 h-full bg-success" />
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-black text-emerald-600/40 uppercase tracking-widest">Total Entrées</p>
              <div className="w-8 h-8 bg-success/10 rounded-lg flex items-center justify-center">
                <Plus className="w-4 h-4 text-success" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-black text-emerald-950 tracking-tighter tabular-nums">
                {formatNumber(entries.reduce((sum, e) => sum + (e.entrees || 0), 0))}
              </h3>
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">USD</span>
            </div>
          </div>

          <div className="bg-white border-2 border-emerald-100 rounded-xl p-6 relative overflow-hidden group shadow-sm transition-all hover:border-emerald-200">
            <div className="absolute top-0 left-0 w-1 h-full bg-error" />
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-black text-emerald-600/40 uppercase tracking-widest">Total Sorties</p>
              <div className="w-8 h-8 bg-error/10 rounded-lg flex items-center justify-center">
                <Trash2 className="w-4 h-4 text-error" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-black text-emerald-950 tracking-tighter tabular-nums">
                {formatNumber(entries.reduce((sum, e) => sum + (e.sorties || 0), 0))}
              </h3>
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">USD</span>
            </div>
          </div>

          <div className="bg-emerald-950 rounded-xl p-6 relative overflow-hidden group shadow-xl shadow-emerald-950/20">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-400" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-white/10 transition-all duration-700" />
            <div className="flex items-center justify-between mb-4 relative z-10">
              <p className="text-[10px] font-black text-emerald-400/60 uppercase tracking-widest">Solde Net Actuel</p>
              <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                <Download className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 text-white relative z-10">
              <h3 className="text-4xl font-black tracking-tighter tabular-nums text-success">
                {formatNumber(balance)}
              </h3>
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">USD</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-emerald-50/30 border-2 border-emerald-100 rounded-xl p-8 shadow-sm">
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row gap-8">
              {canSelectEntity && (
                <div className="md:w-1/3">
                  <label className="block text-[10px] font-black text-emerald-800/40 uppercase tracking-widest mb-2.5 ml-1">Filtrer par Entité</label>
                  <div className="p-1 bg-white border-2 border-emerald-100 rounded-xl shadow-sm">
                    <EntitySelector
                      selectedEntityId={localSelectedEntityId || globalSelectedEntityId}
                      onSelectEntity={handleEntityChange}
                      userRole={profile?.role || ''}
                      userEntityIds={profile?.entity_ids || null}
                      className="w-full border-none shadow-none"
                    />
                  </div>
                </div>
              )}
              <div className="flex-1">
                <label className="block text-[10px] font-black text-emerald-800/40 uppercase tracking-widest mb-2.5 ml-1">Recherche Rapide</label>
                <div className="relative group">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-emerald-400 w-5 h-5 transition-colors group-focus-within:text-emerald-500" />
                  <input
                    type="text"
                    placeholder="Numéro, libellé, client ou pièce..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full h-14 bg-white border-2 border-emerald-100 rounded-xl pl-14 pr-6 text-sm font-black uppercase tracking-tighter text-emerald-950 outline-none focus:border-emerald-400 transition-all shadow-sm placeholder:text-emerald-100"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-emerald-100">
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="flex items-center gap-3 group transition-all"
              >
                <div className={cn(
                  "w-10 h-10 rounded-xl transition-all flex items-center justify-center border-2",
                  showAdvancedFilters
                    ? "bg-yellow-500 border-yellow-600 text-emerald-950 shadow-lg shadow-yellow-500/20"
                    : "bg-white border-emerald-100 text-emerald-400 group-hover:border-emerald-200"
                )}>
                  <Filter className="w-5 h-5 stroke-[2.5]" />
                </div>
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-950">Filtres Avancés</span>
                <ChevronDown className={cn("w-5 h-5 text-emerald-200 transition-transform duration-300", showAdvancedFilters ? "rotate-180" : "")} />
              </button>
              {hasActiveFilters() && (
                <button
                  onClick={clearAdvancedFilters}
                  className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 px-5 py-2.5 rounded-xl border-2 border-transparent hover:border-red-100 transition-all"
                >
                  Réinitialiser
                </button>
              )}
            </div>

            {showAdvancedFilters && (
              <div className="pt-8 border-t border-emerald-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="space-y-2">
                  <label className="block text-[9px] font-black text-emerald-800/40 uppercase tracking-widest ml-1">Période Début</label>
                  <input
                    type="date"
                    value={advancedFilters.dateFrom}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, dateFrom: e.target.value })}
                    className="w-full bg-white border-2 border-emerald-100 rounded-xl px-4 py-3.5 text-xs font-black uppercase tracking-tight text-emerald-950 focus:border-emerald-400 outline-none shadow-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[9px] font-black text-emerald-800/40 uppercase tracking-widest ml-1">Période Fin</label>
                  <input
                    type="date"
                    value={advancedFilters.dateTo}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, dateTo: e.target.value })}
                    className="w-full bg-white border-2 border-emerald-100 rounded-xl px-4 py-3.5 text-xs font-black uppercase tracking-tight text-emerald-950 focus:border-emerald-400 outline-none shadow-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[9px] font-black text-emerald-800/40 uppercase tracking-widest ml-1">Code Comptable</label>
                  <input
                    type="text"
                    placeholder="Ex: 701..."
                    value={advancedFilters.code}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, code: e.target.value })}
                    className="w-full bg-white border-2 border-emerald-100 rounded-xl px-4 py-3.5 text-xs font-black uppercase tracking-tight text-emerald-950 focus:border-emerald-400 outline-none shadow-sm placeholder:text-emerald-100"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[9px] font-black text-emerald-800/40 uppercase tracking-widest ml-1">Nature du Flux</label>
                  <div className="relative">
                    <select
                      value={advancedFilters.type}
                      onChange={(e) => setAdvancedFilters({ ...advancedFilters, type: e.target.value as any })}
                      className="w-full bg-white border-2 border-emerald-100 rounded-xl px-4 py-3.5 text-xs font-black uppercase tracking-tight text-emerald-950 focus:border-emerald-400 outline-none shadow-sm appearance-none"
                    >
                      <option value="all">Tous les Flux</option>
                      <option value="entrees">Entrées (Recettes)</option>
                      <option value="sorties">Sorties (Dépenses)</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-200 w-4 h-4 pointer-events-none" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border-2 border-emerald-100 rounded-xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-emerald-50/50 border-b-2 border-emerald-100">
                  <th className="px-6 py-5 text-left text-[10px] font-black text-emerald-800/40 uppercase tracking-[0.2em]">N° Pièce</th>
                  <th className="px-6 py-5 text-left text-[10px] font-black text-emerald-800/40 uppercase tracking-[0.2em]">Date</th>
                  <th className="px-6 py-5 text-left text-[10px] font-black text-emerald-800/40 uppercase tracking-[0.2em]">Description & Détails</th>
                  <th className="px-6 py-5 text-right text-[10px] font-black text-emerald-800/40 uppercase tracking-[0.2em]">Flux Entrant</th>
                  <th className="px-6 py-5 text-right text-[10px] font-black text-emerald-800/40 uppercase tracking-[0.2em]">Flux Sortant</th>
                  <th className="px-6 py-5 text-right text-[10px] font-black text-emerald-800/40 uppercase tracking-[0.2em]">Solde Rapporté</th>
                  <th className="px-6 py-5 text-center text-[10px] font-black text-emerald-800/40 uppercase tracking-[0.2em]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-50">
                {paginatedEntries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center">
                          <Search className="w-8 h-8 text-emerald-100" />
                        </div>
                        <p className="text-[10px] font-black text-emerald-200 uppercase tracking-widest">Aucune écriture enregistrée</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-emerald-50/50 transition-all duration-200 group">
                      <td className="px-6 py-5 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-1 bg-emerald-50 text-emerald-950 text-[10px] font-black uppercase tracking-widest rounded-lg border border-emerald-100">
                          {entry.entry_number}
                        </span>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-[11px] font-black text-emerald-800/60 uppercase">
                        {new Date(entry.entry_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-emerald-950 uppercase tracking-tighter line-clamp-1">{entry.description}</span>
                          <div className="flex items-center gap-2 mt-1.5">
                            {entry.code && (
                              <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                {entry.code}
                              </span>
                            )}
                            {entry.numero_piece && (
                              <span className="text-[9px] font-black text-emerald-400 uppercase tracking-tight italic opacity-60">
                                Réf: {entry.numero_piece}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right font-black tabular-nums">
                        {entry.entrees ? <span className="text-sm text-success">+{formatNumber(entry.entrees)}</span> : <span className="text-emerald-100">-</span>}
                      </td>
                      <td className="px-6 py-5 text-right font-black tabular-nums">
                        {entry.sorties ? <span className="text-sm text-error">-{formatNumber(entry.sorties)}</span> : <span className="text-emerald-100">-</span>}
                      </td>
                      <td className="px-6 py-5 text-right whitespace-nowrap">
                        <div className="flex flex-col items-end">
                          <span className="text-sm font-black text-emerald-950 tabular-nums tracking-tighter">{formatNumber(entry.balance)}</span>
                          <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mt-0.5">USD</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2 lg:opacity-0 group-hover:opacity-100 transition-all duration-300">
                          <Link href={`/accounting/${entry.id}`}>
                            <button className="flex items-center justify-center w-10 h-10 bg-white border-2 border-emerald-100 text-emerald-400 hover:text-emerald-950 hover:border-emerald-200 hover:bg-emerald-50 rounded-xl transition-all shadow-sm" title="Détails">
                              <Eye className="w-5 h-5" />
                            </button>
                          </Link>
                          <button
                            onClick={() => { setEditingEntryId(entry.id); entryModal.open(); }}
                            className="flex items-center justify-center w-10 h-10 bg-white border-2 border-blue-100 text-blue-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 rounded-xl transition-all shadow-sm" title="Modifier"
                          >
                            <Pencil className="w-5 h-5" />
                          </button>
                          {profile?.role === 'SUPER_ADMIN_GROUP' && (
                            <button
                              onClick={() => { setEntryToDelete(entry); setDeleteModalOpen(true); }}
                              className="flex items-center justify-center w-10 h-10 bg-white border-2 border-red-100 text-red-200 hover:text-red-500 hover:border-red-200 hover:bg-red-50 rounded-xl transition-all shadow-sm"
                              title="Supprimer"
                            >
                              <Trash2 className="w-5 h-5" />
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
          <div className="flex justify-center p-4">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              totalItems={filteredEntries.length}
            />
          </div>
        )}
      </div>

      {/* Entry Form Modal (New & Edit) */}
      <Modal
        isOpen={entryModal.isOpen}
        onClose={() => { entryModal.close(); setEditingEntryId(null); }}
        title={editingEntryId ? "Modifier l'écriture" : "Nouvelle Écriture"}
        size="lg"
      >
        <AccountingEntryForm
          initialEntityId={entityId}
          entryId={editingEntryId}
          onSuccess={() => {
            entryModal.close();
            setEditingEntryId(null);
            fetchEntries();
          }}
          onCancel={() => { entryModal.close(); setEditingEntryId(null); }}
        />
      </Modal>

      {/* Delete Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-emerald-950/40 backdrop-blur-md" onClick={() => setDeleteModalOpen(false)} />
          <div className="relative bg-white rounded-xl border-2 border-emerald-100 p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-red-50 border-2 border-red-100 rounded-xl flex items-center justify-center mx-auto mb-6">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-lg font-black text-emerald-950 text-center uppercase tracking-widest mb-2">Supprimer l'écriture ?</h3>
            <p className="text-[10px] text-emerald-800/60 text-center uppercase tracking-widest mb-8 font-black leading-relaxed">
              Cette action est irréversible et modifiera le solde de caisse certifié.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="flex-1 h-12 text-[10px] font-black uppercase tracking-widest text-emerald-400 hover:text-emerald-600 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="flex-1 h-12 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 shadow-xl shadow-red-200 disabled:opacity-50 border-b-4 border-red-700 active:scale-95 transition-all"
              >
                {deleting ? 'Suppression...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
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
