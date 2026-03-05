'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { Plus, Search, Download, Eye, Edit, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/utils/cn';
import Button from '@/components/ui/Button';
import ConfirmModal from '@/components/ui/ConfirmModal';
import Modal from '@/components/ui/Modal';
import InvoiceForm from '@/components/billing/InvoiceForm';
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
  const toast = useToast();
  const { selectedEntityId, setSelectedEntityId, isGroupView } = useEntity();
  const searchParams = useSearchParams();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const supabase = createSupabaseClient();
  const deleteModal = useModal();
  const newInvoiceModal = useModal();
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

  const stats = useMemo(() => {
    const total = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const paid = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + (inv.total || 0), 0);
    const pending = total - paid;
    return { total, paid, pending };
  }, [invoices]);

  if (loading) {
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
              <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-emerald-950 uppercase">Facturation</h1>
              <div className="flex items-center gap-2 justify-center md:justify-start">
                <span className="w-8 h-1 bg-yellow-500 rounded-full" />
                <p className="text-emerald-700/70 font-bold uppercase tracking-[0.2em] text-[10px]">Gestion & Suivis des paiements</p>
              </div>
            </div>
            <button
              onClick={newInvoiceModal.open}
              className="h-14 px-8 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 text-xs font-black uppercase tracking-widest transition-all active:scale-95 border-b-4 border-emerald-700 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Nouvelle facture
            </button>
          </div>
        </div>

        {/* Global Stats Mini-Dashboard */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="animate-in stagger-2">
            <div className="bg-white border-2 border-emerald-100 p-6 rounded-xl relative overflow-hidden group transition-all hover:border-emerald-200 hover:scale-[1.02] shadow-sm">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full -mr-8 -mt-8 transition-transform duration-500 group-hover:scale-110 opacity-50" />
              <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="p-4 bg-emerald-50 rounded-xl text-emerald-600 transition-transform duration-300 group-hover:rotate-12">
                  <Download className="w-6 h-6" />
                </div>
              </div>
              <div className="relative z-10">
                <p className="text-[10px] font-black text-emerald-600/40 uppercase tracking-widest mb-1">Total Facturé</p>
                <p className="text-3xl font-black text-emerald-950 tracking-tight">{formatNumber(stats.total)} $</p>
              </div>
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-emerald-400 rounded-r-full" />
            </div>
          </div>
          <div className="animate-in stagger-3">
            <div className="bg-white border-2 border-emerald-100 p-6 rounded-xl relative overflow-hidden group transition-all hover:border-emerald-200 hover:scale-[1.02] shadow-sm">
              <div className="absolute top-0 right-0 w-24 h-24 bg-success/5 rounded-full -mr-8 -mt-8 transition-transform duration-500 group-hover:scale-110 opacity-50" />
              <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="p-4 bg-success/10 rounded-xl text-success transition-transform duration-300 group-hover:rotate-12">
                  <TrendingUp className="w-6 h-6" />
                </div>
              </div>
              <div className="relative z-10">
                <p className="text-[10px] font-black text-emerald-600/40 uppercase tracking-widest mb-1">Total Encaissé</p>
                <p className="text-3xl font-black text-success tracking-tight">{formatNumber(stats.paid)} $</p>
              </div>
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-success rounded-r-full" />
            </div>
          </div>
          <div className="animate-in stagger-4">
            <div className="bg-white border-2 border-emerald-100 p-6 rounded-xl relative overflow-hidden group transition-all hover:border-emerald-200 hover:scale-[1.02] shadow-sm">
              <div className="absolute top-0 right-0 w-24 h-24 bg-error/5 rounded-full -mr-8 -mt-8 transition-transform duration-500 group-hover:scale-110 opacity-50" />
              <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="p-4 bg-error/10 rounded-xl text-error transition-transform duration-300 group-hover:rotate-12">
                  <TrendingDown className="w-6 h-6" />
                </div>
              </div>
              <div className="relative z-10">
                <p className="text-[10px] font-black text-emerald-600/40 uppercase tracking-widest mb-1">Reste à Recouvrer</p>
                <p className="text-3xl font-black text-error tracking-tight">{formatNumber(stats.pending)} $</p>
              </div>
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-error rounded-r-full" />
            </div>
          </div>
        </div>

        {/* Filters & Table */}
        <div className="space-y-4">
          <div className="bg-white border-2 border-emerald-100 p-2 rounded-xl flex flex-col lg:flex-row gap-2 transition-all hover:border-emerald-200 shadow-sm">
            <div className="flex-1 relative">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
              <input
                type="text"
                placeholder="Rechercher par numéro ou par client..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-12 pl-14 pr-6 bg-transparent text-sm font-bold text-emerald-950 outline-none placeholder:text-emerald-200"
              />
            </div>
          </div>

          <div className="bg-white border-2 border-emerald-100 overflow-hidden rounded-xl shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-emerald-50/50">
                    <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-emerald-800/40 border-b border-emerald-100">Référence</th>
                    <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-emerald-800/40 border-b border-emerald-100">Client</th>
                    <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-emerald-800/40 border-b border-emerald-100">Émission</th>
                    <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-emerald-800/40 border-b border-emerald-100">Montant</th>
                    <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-emerald-800/40 border-b border-emerald-100">Statut</th>
                    <th className="px-8 py-5 text-right text-[10px] font-black uppercase tracking-widest text-emerald-800/40 border-b border-emerald-100">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100">
                  {paginatedInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-8 py-32 text-center">
                        <div className="flex flex-col items-center gap-4">
                          <div className="p-8 bg-emerald-50 rounded-full border-2 border-emerald-100">
                            <Search className="w-12 h-12 text-emerald-100" />
                          </div>
                          <p className="text-emerald-800/40 font-black uppercase text-xs tracking-widest">Aucune facture trouvée</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedInvoices.map((invoice) => (
                      <tr key={invoice.id} className="group hover:bg-emerald-50/50 transition-all">
                        <td className="px-8 py-5">
                          <span className="text-sm font-black text-emerald-950 tracking-tight uppercase leading-none">#{invoice.invoice_number}</span>
                        </td>
                        <td className="px-8 py-5">
                          <div className="text-sm font-black text-emerald-950 uppercase tracking-tight truncate max-w-[200px]">{invoice.client_name}</div>
                        </td>
                        <td className="px-8 py-5">
                          <span className="text-[10px] font-black text-emerald-800/60 uppercase tracking-widest italic">
                            {new Date(invoice.issue_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </td>
                        <td className="px-8 py-5">
                          <span className="text-sm font-black text-emerald-950 leading-none">
                            {formatNumber(invoice.total)} $
                          </span>
                        </td>
                        <td className="px-8 py-5">
                          <span className={cn(
                            "px-4 py-1.5 text-[10px] font-black rounded-lg uppercase tracking-widest border-2",
                            invoice.status === 'paid' ? 'bg-success/10 text-success border-success/20' :
                              invoice.status === 'overdue' ? 'bg-error/10 text-error border-error/20' :
                                invoice.status === 'sent' ? 'bg-info/10 text-info border-info/20' :
                                  'bg-emerald-50 text-emerald-600 border-emerald-100'
                          )}>
                            {getStatusLabel(invoice.status)}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            <Link href={`/billing/${invoice.id}`} className="inline-flex items-center justify-center w-10 h-10 bg-white text-emerald-600 rounded-lg border-2 border-emerald-100 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all shadow-sm">
                              <Eye className="w-4 h-4" />
                            </Link>
                            <Link href={`/billing/${invoice.id}/edit`} className="inline-flex items-center justify-center w-10 h-10 bg-white text-blue-600 rounded-lg border-2 border-blue-100 hover:bg-blue-500 hover:text-white hover:border-blue-500 transition-all shadow-sm">
                              <Edit className="w-4 h-4" />
                            </Link>
                            {hasPermission(profile?.role || 'READ_ONLY', 'billing', 'delete') && (
                              <button
                                onClick={() => {
                                  setInvoiceToDelete(invoice.id);
                                  deleteModal.open();
                                }}
                                className="inline-flex items-center justify-center w-10 h-10 bg-white text-red-600 rounded-lg border-2 border-red-100 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all shadow-sm"
                              >
                                <Trash2 className="w-4 h-4" />
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

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-6 py-4 bg-slate-50/30 border-t border-slate-100">
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
        </div>
      </div>

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

      <Modal
        isOpen={newInvoiceModal.isOpen}
        onClose={newInvoiceModal.close}
        title="Créer une nouvelle facture"
        size="md"
      >
        <InvoiceForm
          onSuccess={() => {
            newInvoiceModal.close();
            fetchInvoices();
          }}
          onCancel={newInvoiceModal.close}
        />
      </Modal>
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

