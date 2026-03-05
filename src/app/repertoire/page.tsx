'use client';

/* eslint-disable react/no-unescaped-entities */

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { normalizeEntityIds, getEntityUUID } from '@/utils/entityHelpers';
import BackButton from '@/components/ui/BackButton';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import Sheet from '@/components/ui/Sheet';
import DirectoryForm from '@/components/directory/DirectoryForm';
import { useEntity } from '@/hooks/useEntity';
import { useModal } from '@/hooks/useModal';
import {
  UserCircle,
  Truck,
  Link2,
  Users,
  Search,
  Eye,
  Plus,
  Filter,
  ArrowRight,
  Phone,
  Mail,
  MapPin,
  Contact2
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/utils/cn';

type TabId = 'clients' | 'suppliers' | 'partners' | 'collaborators';

const TABS_CONFIG: Record<TabId, { label: string; icon: any; color: string; bg: string; table: string }> = {
  clients: { label: 'Clients', icon: UserCircle, color: 'text-blue-600', bg: 'bg-blue-50', table: 'clients' },
  suppliers: { label: 'Fournisseurs', icon: Truck, color: 'text-emerald-600', bg: 'bg-emerald-50', table: 'suppliers' },
  partners: { label: 'Partenaires', icon: Link2, color: 'text-amber-600', bg: 'bg-amber-50', table: 'partners' },
  collaborators: { label: 'Collaborateurs', icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50', table: 'collaborators' },
};

const ITEMS_PER_PAGE = 8;

function RepertoirePageContent() {
  const { profile } = useAuth();
  const { selectedEntityId, isGroupView } = useEntity();
  const searchParams = useSearchParams();
  const entityParam = searchParams?.get('entity') || null;
  const supabase = createSupabaseClient();
  const sheet = useModal();

  const [activeTab, setActiveTab] = useState<TabId>('clients');
  const [lists, setLists] = useState<Record<TabId, any[]>>({
    clients: [],
    suppliers: [],
    partners: [],
    collaborators: [],
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const entityId = entityParam || (isGroupView ? null : selectedEntityId);

  const getEntityFilter = async () => {
    if (!profile) return '00000000-0000-0000-0000-000000000000';
    if (profile.role === 'SUPER_ADMIN_GROUP' || profile.role === 'ADMIN_ENTITY') {
      if (entityId) {
        const uuid = await getEntityUUID(entityId);
        return uuid || '00000000-0000-0000-0000-000000000000';
      }
      return null;
    }
    const filterIds = profile.entity_ids && profile.entity_ids.length > 0 ? profile.entity_ids : (profile.entity_id ? [profile.entity_id] : []);
    if (filterIds.length > 0) {
      return await normalizeEntityIds(filterIds);
    }
    return '00000000-0000-0000-0000-000000000000';
  };

  const fetchAllLists = async () => {
    setLoading(true);
    try {
      const filter = await getEntityFilter();
      const results: any = {};

      for (const [tabId, cfg] of Object.entries(TABS_CONFIG)) {
        let query = supabase.from(cfg.table).select('*').eq('is_active', true).order('name');
        if (Array.isArray(filter)) query = query.in('entity_id', filter);
        else if (filter) query = query.eq('entity_id', filter);

        const { data, error } = await query;
        if (error) throw error;
        results[tabId] = data || [];
      }

      setLists(results);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllLists();
  }, [entityId, profile?.id]);

  const filteredList = useMemo(() => {
    const rawList = lists[activeTab];
    if (!searchTerm.trim()) return rawList;
    const term = searchTerm.toLowerCase();
    return rawList.filter((row: any) =>
      (row.name || '').toLowerCase().includes(term) ||
      (row.email || '').toLowerCase().includes(term) ||
      (row.phone || '').toLowerCase().includes(term) ||
      (row.role_position || '').toLowerCase().includes(term)
    );
  }, [lists, activeTab, searchTerm]);

  const totalPages = Math.ceil(filteredList.length / ITEMS_PER_PAGE);
  const paginatedList = filteredList.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeTab]);

  if (loading && Object.values(lists).every(l => l.length === 0)) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        {/* Header Block */}
        <div className="bg-white border-2 border-emerald-100 p-6 sm:p-8 rounded-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-50 rounded-full -mr-24 -mt-24 transition-transform duration-500 group-hover:scale-110 opacity-50" />

          <div className="flex flex-col md:flex-row justify-between items-center sm:items-end gap-6 relative z-10">
            <div className="space-y-1">
              <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-emerald-950 uppercase">Répertoire</h1>
              <div className="flex items-center gap-2 justify-center md:justify-start">
                <span className="w-8 h-1 bg-yellow-500 rounded-full" />
                <p className="text-emerald-700/70 font-bold uppercase tracking-[0.2em] text-[10px]">Gestion centralisée des contacts et collaborateurs</p>
              </div>
            </div>
            <Button
              onClick={() => sheet.open()}
              className="h-14 px-8 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 text-xs font-black uppercase tracking-widest transition-all active:scale-95 border-b-4 border-emerald-700"
              icon={<Plus className="w-5 h-5" />}
            >
              Nouveau Contact
            </Button>
          </div>
        </div>

        {/* Category Blocks Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {(Object.entries(TABS_CONFIG) as [TabId, any][]).map(([id, cfg]) => {
            const count = lists[id].length;
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  "p-6 border-2 transition-all text-left group relative overflow-hidden rounded-xl",
                  isActive
                    ? "border-emerald-600 bg-emerald-500 shadow-xl shadow-emerald-500/20 scale-105"
                    : "border-emerald-100 bg-white hover:border-emerald-200 hover:scale-[1.02]"
                )}
              >
                {/* Decorative background circle */}
                <div className={cn(
                  "absolute top-0 right-0 w-24 h-24 rounded-full -mr-8 -mt-8 transition-transform duration-500 group-hover:scale-110 opacity-10",
                  isActive ? "bg-white" : cfg.bg
                )} />

                <div className="flex items-center justify-between mb-4 relative z-10">
                  <div className={cn(
                    "p-4 rounded-xl shadow-none transition-all duration-300 group-hover:rotate-12",
                    isActive ? "bg-white/20 text-white" : cn("bg-emerald-50 text-emerald-600")
                  )}>
                    <cfg.icon className="w-6 h-6" />
                  </div>
                  {isActive && (
                    <div className="flex flex-col items-end">
                      <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                      <span className="text-[9px] font-black uppercase tracking-tighter mt-1 text-white/60">Actif</span>
                    </div>
                  )}
                </div>
                <div className="relative z-10">
                  <p className={cn("text-[9px] font-black uppercase tracking-widest mb-1", isActive ? "text-white/60" : "text-emerald-600/40")}>
                    {cfg.label}
                  </p>
                  <p className={cn("text-3xl font-black tracking-tight leading-none", isActive ? "text-white" : "text-emerald-950")}>
                    {count.toString().padStart(2, '0')}
                  </p>
                </div>

                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-yellow-400 rounded-r-full shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Search & Toolbar */}
        <div className="bg-white border-2 border-emerald-100 p-2 rounded-xl flex flex-col lg:flex-row gap-2 transition-all hover:border-emerald-200 shadow-sm">
          <div className="flex-1 relative">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
            <input
              type="text"
              placeholder={`Rechercher un ${TABS_CONFIG[activeTab].label.toLowerCase()}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-12 pl-14 pr-6 bg-transparent text-sm font-bold text-emerald-950 outline-none placeholder:text-emerald-200"
            />
          </div>
          <div className="h-px lg:h-8 lg:w-px bg-emerald-100 self-center" />
          <div className="flex items-center gap-2 p-1">
            <div className="h-10 px-4 flex items-center bg-emerald-100/50 rounded-lg text-[9px] font-black uppercase tracking-widest text-emerald-800">
              <Contact2 className="w-3.5 h-3.5 mr-2" />
              {filteredList.length} résultats
            </div>
            <Button variant="secondary" className="h-10 px-4 rounded-lg bg-emerald-50 text-emerald-600 hover:text-emerald-950 border-none transition-colors">
              <Filter className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* List Section */}
        <div className="bg-white border-2 border-emerald-100 overflow-hidden rounded-xl shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-emerald-50/50">
                  <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-emerald-800/40 border-b border-emerald-100">Identité</th>
                  <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-emerald-800/40 border-b border-emerald-100">Coordonnées</th>
                  <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-emerald-800/40 border-b border-emerald-100">Localisation</th>
                  <th className="px-8 py-5 text-right text-[10px] font-black uppercase tracking-widest text-emerald-800/40 border-b border-emerald-100">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100">
                {paginatedList.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-8 py-32 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="p-8 bg-emerald-50 rounded-full border-2 border-emerald-100">
                          <Search className="w-12 h-12 text-emerald-100" />
                        </div>
                        <p className="text-emerald-800/40 font-black uppercase text-xs tracking-widest">Aucun résultat trouvé</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedList.map((row) => (
                    <tr key={row.id} className="group hover:bg-emerald-50/50 transition-all">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center font-black text-xs border-2 border-emerald-100 bg-emerald-50 text-emerald-700 group-hover:bg-white group-hover:border-emerald-300 transition-all shadow-sm")}>
                            {(row.name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-black text-emerald-950 leading-tight uppercase tracking-tight">{row.name}</span>
                            {activeTab === 'collaborators' && row.role_position && (
                              <span className="text-[9px] font-black uppercase tracking-widest text-yellow-600 mt-1">
                                {row.role_position}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex flex-col gap-1.5">
                          {row.phone && (
                            <span className="flex items-center gap-2 text-xs font-black text-emerald-900 uppercase tracking-tighter">
                              <Phone className="w-3.5 h-3.5 text-emerald-400" /> {row.phone}
                            </span>
                          )}
                          {row.email && (
                            <span className="flex items-center gap-2 text-[10px] font-bold text-emerald-600 tracking-tight">
                              <Mail className="w-3.5 h-3.5 text-emerald-300" /> {row.email}
                            </span>
                          )}
                          {!row.phone && !row.email && <span className="text-[10px] text-emerald-400 font-black uppercase tracking-widest">INDÉTERMINÉ</span>}
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-800/60 italic max-w-xs truncate">
                          {row.address ? (
                            <>
                              <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span className="truncate">{row.address}</span>
                            </>
                          ) : (
                            "—"
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <Link
                          href={`/${activeTab === "partners" ? "partenaires" : activeTab === "collaborators" ? "collaborateurs" : activeTab}/${row.id}`}
                          className="inline-flex items-center justify-center w-10 h-10 bg-white text-emerald-600 rounded-lg border-2 border-emerald-100 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all duration-300 opacity-0 group-hover:opacity-100 shadow-sm"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination Section */}
        {totalPages > 1 && (
          <div className="flex justify-center pt-4">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={ITEMS_PER_PAGE}
              totalItems={filteredList.length}
            />
          </div>
        )}

        {/* Sheet for Creation */}
        <Sheet
          isOpen={sheet.isOpen}
          onClose={sheet.close}
          title="Nouveau Contact"
          description={`Ajoutez un nouveau ${activeTab.slice(0, -1)} au répertoire de votre entité.`}
          size="lg"
        >
          <DirectoryForm
            initialType={activeTab}
            onSuccess={() => { sheet.close(); fetchAllLists(); }}
            onCancel={sheet.close}
          />
        </Sheet>
      </div>
    </AppLayout>
  );
}

export default function RepertoirePage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
        </div>
      </AppLayout>
    }>
      <RepertoirePageContent />
    </Suspense>
  );
}
