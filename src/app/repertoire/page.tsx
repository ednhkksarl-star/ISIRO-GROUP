'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { normalizeEntityIds, getEntityUUID } from '@/utils/entityHelpers';
import BackButton from '@/components/ui/BackButton';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Pagination from '@/components/ui/Pagination';
import { useEntity } from '@/hooks/useEntity';
import {
  UserCircle,
  Truck,
  Link2,
  Users,
  Search,
  Eye,
  Plus,
} from 'lucide-react';
import Link from 'next/link';

type TabId = 'clients' | 'suppliers' | 'partners' | 'collaborators';

const TABS: { id: TabId; label: string; icon: typeof UserCircle; table: string }[] = [
  { id: 'clients', label: 'Clients', icon: UserCircle, table: 'clients' },
  { id: 'suppliers', label: 'Fournisseurs', icon: Truck, table: 'suppliers' },
  { id: 'partners', label: 'Partenaires', icon: Link2, table: 'partners' },
  { id: 'collaborators', label: 'Collaborateurs', icon: Users, table: 'collaborators' },
];

const PLACEHOLDERS: Record<TabId, string> = {
  clients: 'Nom, email, téléphone client...',
  suppliers: 'Nom, email, téléphone fournisseur...',
  partners: 'Nom, email, téléphone partenaire...',
  collaborators: 'Nom, email, téléphone, fonction...',
};

const NEW_LINKS: Record<TabId, string> = {
  clients: '/clients/new',
  suppliers: '/suppliers/new',
  partners: '/partenaires/new',
  collaborators: '/collaborateurs/new',
};

const DETAIL_LINKS: Record<TabId, (id: string) => string> = {
  clients: (id) => `/clients/${id}`,
  suppliers: (id) => `/suppliers/${id}`,
  partners: (id) => `/partenaires/${id}`,
  collaborators: (id) => `/collaborateurs/${id}`,
};

const ITEMS_PER_PAGE = 10;

function RepertoirePageContent() {
  const { profile } = useAuth();
  const { selectedEntityId, isGroupView } = useEntity();
  const searchParams = useSearchParams();
  const entityParam = searchParams?.get('entity') || null;
  const supabase = createSupabaseClient();

  const [activeTab, setActiveTab] = useState<TabId>('clients');
  const [lists, setLists] = useState<Record<TabId, any[]>>({
    clients: [],
    suppliers: [],
    partners: [],
    collaborators: [],
  });
  const [loading, setLoading] = useState<Record<TabId, boolean>>({
    clients: true,
    suppliers: false,
    partners: false,
    collaborators: false,
  });
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
    if (profile.entity_ids && profile.entity_ids.length > 0) {
      const uuids = await normalizeEntityIds(profile.entity_ids);
      return uuids.length > 0 ? uuids : ['00000000-0000-0000-0000-000000000000'];
    }
    if (profile.entity_id) {
      const uuid = await getEntityUUID(profile.entity_id);
      return uuid ? [uuid] : ['00000000-0000-0000-0000-000000000000'];
    }
    return '00000000-0000-0000-0000-000000000000';
  };

  const fetchList = async (tab: TabId) => {
    setLoading((prev) => ({ ...prev, [tab]: true }));
    try {
      const filter = await getEntityFilter();
      const table = TABS.find((t) => t.id === tab)!.table;
      let query = supabase
        .from(table as any)
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (Array.isArray(filter)) {
        query = query.in('entity_id', filter);
      } else if (filter) {
        query = query.eq('entity_id', filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLists((prev) => ({ ...prev, [tab]: data || [] }));
    } catch (err) {
      console.error(err);
      setLists((prev) => ({ ...prev, [tab]: [] }));
    } finally {
      setLoading((prev) => ({ ...prev, [tab]: false }));
    }
  };

  useEffect(() => {
    fetchList(activeTab);
  }, [activeTab, entityId, profile?.id]);

  const rawList = lists[activeTab];
  const isCollaborators = activeTab === 'collaborators';

  const filteredList = useMemo(() => {
    if (!searchTerm.trim()) return rawList;
    const term = searchTerm.toLowerCase();
    return rawList.filter((row: any) => {
      const name = (row.name || '').toLowerCase();
      const email = (row.email || '').toLowerCase();
      const phone = (row.phone || '').toLowerCase();
      const rolePosition = (row.role_position || '').toLowerCase();
      if (isCollaborators) {
        return name.includes(term) || email.includes(term) || phone.includes(term) || rolePosition.includes(term);
      }
      return name.includes(term) || email.includes(term) || phone.includes(term);
    });
  }, [rawList, searchTerm, isCollaborators]);

  const totalPages = Math.max(1, Math.ceil(filteredList.length / ITEMS_PER_PAGE));
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredList.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredList, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeTab]);

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <BackButton href="/dashboard" />
            <h1 className="text-2xl font-bold text-text mt-2">Répertoire</h1>
            <p className="text-text-light text-sm">Clients, fournisseurs, partenaires et collaborateurs</p>
          </div>
          <div className="flex flex-wrap gap-2 min-w-[120px]">
            <Link href="/clients/new">
              <Button variant="primary" className="!bg-blue-600 hover:!bg-blue-700">
                <Plus className="w-4 h-4 mr-1" /> Nouveau client
              </Button>
            </Link>
            <Link href="/suppliers/new">
              <Button variant="primary">
                <Plus className="w-4 h-4 mr-1" /> Nouveau fournisseur
              </Button>
            </Link>
            <Link href="/partenaires/new">
              <Button variant="outline">
                <Plus className="w-4 h-4 mr-1" /> Nouveau partenaire
              </Button>
            </Link>
            <Link href="/collaborateurs/new">
              <Button variant="outline">
                <Plus className="w-4 h-4 mr-1" /> Nouveau collaborateur
              </Button>
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const count = lists[tab.id].length;
            const filteredCount = tab.id === activeTab ? filteredList.length : count;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label} ({tab.id === activeTab ? filteredCount : count})
              </button>
            );
          })}
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder={PLACEHOLDERS[activeTab]}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>

        <Card>
          {loading[activeTab] ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="py-3 px-2 font-semibold text-text">Nom</th>
                      <th className="py-3 px-2 font-semibold text-text">Téléphone</th>
                      <th className="py-3 px-2 font-semibold text-text">Email</th>
                      {isCollaborators && (
                        <th className="py-3 px-2 font-semibold text-text">Fonction</th>
                      )}
                      <th className="py-3 px-2 font-semibold text-text">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedList.length === 0 ? (
                      <tr>
                        <td colSpan={isCollaborators ? 5 : 4} className="py-8 text-center text-gray-500">
                          Aucun enregistrement
                        </td>
                      </tr>
                    ) : (
                      paginatedList.map((row: any) => (
                        <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-2">{row.name || '—'}</td>
                          <td className="py-3 px-2">{row.phone || '—'}</td>
                          <td className="py-3 px-2">{row.email || '—'}</td>
                          {isCollaborators && (
                            <td className="py-3 px-2">{row.role_position || '—'}</td>
                          )}
                          <td className="py-3 px-2">
                            <Link href={DETAIL_LINKS[activeTab](row.id)}>
                              <span className="inline-flex items-center gap-1 text-primary hover:underline">
                                <Eye className="w-4 h-4" /> Voir
                              </span>
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="mt-4">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                  />
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}

export default function RepertoirePage() {
  return (
    <Suspense fallback={<AppLayout><div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" /></div></AppLayout>}>
      <RepertoirePageContent />
    </Suspense>
  );
}
