'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { Plus, Search, Download, Eye, Edit, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'react-toastify';
import Button from '@/components/ui/Button';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useModal } from '@/hooks/useModal';
import { hasPermission } from '@/constants/permissions';
import { useEntity } from '@/hooks/useEntity';
import BackButton from '@/components/ui/BackButton';
import Pagination from '@/components/ui/Pagination';
import { normalizeEntityIds, getEntityUUID } from '@/utils/entityHelpers';
import { formatNumber } from '@/utils/formatNumber';
import type { Database } from '@/types/database.types';

type Invoice = Database['public']['Tables']['invoices']['Row'];

function BillingPageContent() {
  const { profile } = useAuth();
  const { selectedEntityId, setSelectedEntityId, isGroupView } = useEntity();
  const searchParams = useSearchParams();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const supabase = createSupabaseClient();
  const deleteModal = useModal();
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);

  // Utiliser l'entité depuis les paramètres de requête ou selectedEntityId (qui peut être null pour vue consolidée)
  const entityId = searchParams?.get('entity') || (isGroupView ? null : selectedEntityId);

  // Synchroniser le paramètre URL avec le contexte selectedEntityId
  useEffect(() => {
    const entityParam = searchParams?.get('entity');
    if (entityParam && (profile?.role === 'SUPER_ADMIN_GROUP' || profile?.role === 'ADMIN_ENTITY')) {
      // Convertir le paramètre (code ou UUID) en UUID avant de le stocker dans le contexte
      getEntityUUID(entityParam).then((uuid) => {
        if (uuid) {
          setSelectedEntityId(uuid);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams?.get('entity')]);

  useEffect(() => {
    fetchInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, entityId]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false });

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

      const { data, error } = await query;

      if (error) throw error;
      setInvoices(data || []);
    } catch (error: any) {
      toast.error('Erreur lors du chargement des factures');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredInvoices = useMemo(
    () =>
      invoices.filter(
    (invoice) =>
      invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.client_name.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [invoices, searchTerm]
  );

  // Pagination
  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  const paginatedInvoices = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredInvoices.slice(startIndex, endIndex);
  }, [filteredInvoices, currentPage, itemsPerPage]);

  // Réinitialiser la page si elle est hors limites
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      paid: 'bg-green-100 text-green-800',
      overdue: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || colors.draft;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: 'Brouillon',
      sent: 'Envoyée',
      paid: 'Payée',
      overdue: 'Impayée',
      cancelled: 'Annulée',
    };
    return labels[status] || status;
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
            <h1 className="text-3xl font-bold text-gray-900">Facturation</h1>
            <p className="text-gray-600 mt-1">Gestion des devis et factures</p>
          </div>
          <Link href="/billing/new">
            <Button icon={<Plus className="w-5 h-5" />}>
              Nouvelle facture
            </Button>
          </Link>
        </div>

        {/* Search */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher une facture..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Invoices Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-primary/10 to-primary/5">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-primary uppercase tracking-wider">
                    Numéro
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-primary uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-primary uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-primary uppercase tracking-wider">
                    Montant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-primary uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-primary uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      {filteredInvoices.length === 0 ? 'Aucune facture trouvée' : 'Aucune facture sur cette page'}
                    </td>
                  </tr>
                ) : (
                  paginatedInvoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent transition-all duration-200 border-b border-gray-100">
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium text-gray-900">
                        <div className="truncate max-w-[100px] sm:max-w-none">{invoice.invoice_number}</div>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-500">
                        <div className="truncate max-w-[120px] sm:max-w-none">{invoice.client_name}</div>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-500 whitespace-nowrap">
                        {new Date(invoice.issue_date).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium text-gray-900 whitespace-nowrap">
                        {formatNumber(invoice.total)} $US
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4">
                        <span
                          className={`inline-flex px-2 py-1 text-[10px] sm:text-xs font-semibold rounded-full ${getStatusColor(
                            invoice.status
                          )}`}
                        >
                          {getStatusLabel(invoice.status)}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs sm:text-sm font-medium">
                        <div className="flex items-center justify-end gap-1 sm:gap-2">
                          <Link
                            href={`/billing/${invoice.id}`}
                            className="text-primary-600 hover:text-primary-900 p-1 sm:p-2 rounded-lg hover:bg-primary/10 transition-colors"
                            title="Voir"
                          >
                            <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
                          </Link>
                          <Link
                            href={`/billing/${invoice.id}/edit`}
                            prefetch={false}
                            className="text-blue-600 hover:text-blue-900 p-1 sm:p-2 rounded-lg hover:bg-blue-50 transition-colors"
                            title="Modifier"
                          >
                            <Edit className="w-4 h-4 sm:w-5 sm:h-5" />
                          </Link>
                          {hasPermission(profile?.role || 'READ_ONLY', 'billing', 'delete') && (
                            <button
                              onClick={() => {
                                setInvoiceToDelete(invoice.id);
                                deleteModal.open();
                              }}
                              className="text-red-600 hover:text-red-900 transition-colors p-1 sm:p-2 hover:bg-error/10 rounded-lg"
                              title="Supprimer"
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
              totalItems={filteredInvoices.length}
            />
          </div>
        )}
      </div>

      {/* Modale de confirmation de suppression */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => {
          deleteModal.close();
          setInvoiceToDelete(null);
        }}
        onConfirm={async () => {
          if (invoiceToDelete) {
            const { error } = await supabase
              .from('invoices')
              .delete()
              .eq('id', invoiceToDelete);
            if (error) {
              toast.error('Erreur lors de la suppression');
            } else {
              toast.success('Facture supprimée');
              fetchInvoices();
            }
            setInvoiceToDelete(null);
          }
        }}
        title="Supprimer la facture"
        message="Êtes-vous sûr de vouloir supprimer cette facture ? Cette action est irréversible."
        confirmText="Supprimer"
        cancelText="Annuler"
        variant="danger"
      />
    </AppLayout>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    }>
      <BillingPageContent />
    </Suspense>
  );
}

