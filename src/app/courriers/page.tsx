'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import {
  Plus, Search, Mail, Inbox, Send, Edit, Trash2,
  Eye, Filter, ArrowRight, Clock, CheckCircle2,
  Archive, FileText, LayoutGrid, List as ListIcon, User
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Pagination from '@/components/ui/Pagination';
import ConfirmModal from '@/components/ui/ConfirmModal';
import Sheet from '@/components/ui/Sheet';
import MailForm from '@/components/mail/MailForm';
import { useModal } from '@/hooks/useModal';
import { useEntity } from '@/hooks/useEntity';
import { normalizeEntityIds, getEntityUUID } from '@/utils/entityHelpers';
import UserAssignmentModal from '@/components/mail/UserAssignmentModal';
import { cn } from '@/utils/cn';
import type { Database } from '@/types/database.types';

type MailItem = Database['public']['Tables']['mail_items']['Row'];

const TYPE_CONFIG: Record<string, { label: string, icon: any, color: string, bg: string }> = {
  incoming: { label: 'Entrant', icon: Inbox, color: 'text-blue-600', bg: 'bg-blue-50' },
  outgoing: { label: 'Sortant', icon: Send, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  internal: { label: 'Interne', icon: Mail, color: 'text-amber-600', bg: 'bg-amber-50' },
};

const STATUS_CONFIG: Record<string, { label: string, color: string, bg: string }> = {
  registered: { label: 'Enregistré', color: 'text-slate-600', bg: 'bg-slate-100' },
  assigned: { label: 'Affecté', color: 'text-indigo-600', bg: 'bg-indigo-50' },
  processing: { label: 'En traitement', color: 'text-blue-600', bg: 'bg-blue-50' },
  validated: { label: 'Validé', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  archived: { label: 'Archivé', color: 'text-slate-400', bg: 'bg-slate-50 border-slate-100' },
};

const STATUS_WORKFLOW: Record<string, string[]> = {
  registered: ['assigned', 'processing', 'archived'],
  assigned: ['processing', 'registered', 'archived'],
  processing: ['validated', 'assigned', 'archived'],
  validated: ['archived', 'processing'],
  archived: [],
};

interface User {
  id: string;
  full_name: string | null;
  email: string;
}

function CourriersPageContent() {
  const { profile } = useAuth();
  const toast = useToast();
  const { selectedEntityId, setSelectedEntityId, isGroupView } = useEntity();
  const searchParams = useSearchParams();
  const [mailItems, setMailItems] = useState<MailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [users, setUsers] = useState<User[]>([]);
  const itemsPerPage = 8;
  const supabase = createSupabaseClient();

  const deleteModal = useModal();
  const assignmentModal = useModal();
  const sheet = useModal();

  const [mailToDelete, setMailToDelete] = useState<string | null>(null);
  const [mailToAssign, setMailToAssign] = useState<string | null>(null);

  const entityId = searchParams?.get('entity') || (isGroupView ? null : selectedEntityId);

  useEffect(() => {
    fetchMailItems();
  }, [profile, entityId]);

  useEffect(() => {
    if (!loading) fetchUsers();
  }, [loading, entityId]);

  const fetchUsers = async () => {
    try {
      let query = supabase.from('users').select('id, full_name, email').eq('is_active', true);
      const { data, error } = await query;
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Erreur chargement utilisateurs:', error);
    }
  };

  const fetchMailItems = async () => {
    try {
      setLoading(true);
      let query = supabase.from('mail_items').select('*').order('created_at', { ascending: false });

      if (profile?.role !== 'SUPER_ADMIN_GROUP' && profile?.role !== 'ADMIN_ENTITY') {
        const entityUUIDs = profile?.entity_ids ? await normalizeEntityIds(profile.entity_ids) : [];
        if (profile?.entity_id) {
          const mainUuid = await getEntityUUID(profile.entity_id);
          if (mainUuid && !entityUUIDs.includes(mainUuid)) entityUUIDs.push(mainUuid);
        }

        const conditions = entityUUIDs.map(uuid => `entity_id.eq.${uuid}`);
        if (profile?.id) {
          conditions.push(`assigned_to.eq.${profile.id}`);
          conditions.push(`oriented_to_user_id.eq.${profile.id}`);
          conditions.push(`created_by.eq.${profile.id}`);
        }
        if (conditions.length > 0) query = query.or(conditions.join(','));
      } else if (entityId) {
        const uuid = await getEntityUUID(entityId);
        if (uuid) query = query.eq('entity_id', uuid);
      }

      const { data, error } = await query;
      if (error) throw error;
      setMailItems(data || []);
    } catch (error) {
      toast.error('Erreur lors du chargement des courriers');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await (supabase.from('mail_items') as any).update({ status: newStatus as any }).eq('id', id);
      if (error) throw error;
      toast.success('Statut mis à jour');
      fetchMailItems();
    } catch (error: any) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const assignToUser = async (userId: string | null) => {
    if (!mailToAssign) return;
    try {
      const mailItem = mailItems.find(m => m.id === mailToAssign);
      const updateData: any = { assigned_to: userId };
      if (userId && mailItem?.status === 'registered') updateData.status = 'assigned';

      const { error } = await (supabase.from('mail_items') as any).update(updateData).eq('id', mailToAssign);
      if (error) throw error;
      toast.success(userId ? 'Utilisateur assigné' : 'Assignation supprimée');
      fetchMailItems();
      assignmentModal.close();
      setMailToAssign(null);
    } catch (error) {
      toast.error('Erreur lors de l\'assignation');
    }
  };

  const handleDelete = async () => {
    if (!mailToDelete) return;
    try {
      const { error } = await supabase.from('mail_items').delete().eq('id', mailToDelete);
      if (error) throw error;
      toast.success('Courrier supprimé');
      fetchMailItems();
      deleteModal.close();
      setMailToDelete(null);
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const filteredMailItems = useMemo(() => {
    return mailItems.filter(item => {
      const matchesSearch = item.mail_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.subject.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'all' || item.mail_type === typeFilter;
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [mailItems, searchTerm, typeFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = mailItems.length;
    const incoming = mailItems.filter(m => m.mail_type === 'incoming').length;
    const outgoing = mailItems.filter(m => m.mail_type === 'outgoing').length;
    const pending = mailItems.filter(m => m.status !== 'archived' && m.status !== 'validated').length;
    return { total, incoming, outgoing, pending };
  }, [mailItems]);

  const totalPages = Math.ceil(filteredMailItems.length / itemsPerPage);
  const paginatedMailItems = filteredMailItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
      <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        {/* Header Block - Repertoire Style */}
        <div className="bg-white border-2 border-emerald-100 p-6 sm:p-8 rounded-xl relative overflow-hidden group shadow-sm transition-all hover:border-emerald-200">
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-50 rounded-full -mr-24 -mt-24 transition-transform duration-500 group-hover:scale-110 opacity-50" />

          <div className="flex flex-col md:flex-row justify-between items-center sm:items-end gap-8 relative z-10">
            <div className="space-y-4 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 rounded-full border border-emerald-100 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Services Courriers</span>
              </div>

              <div className="relative">
                <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-emerald-950 uppercase leading-none">
                  Gestion <span className="text-emerald-500">Courriers</span>
                </h1>
              </div>

              <div className="flex items-center gap-2 justify-center md:justify-start">
                <span className="w-8 h-1 bg-yellow-500 rounded-full shrink-0" />
                <p className="text-emerald-700/70 font-bold uppercase tracking-[0.2em] text-[10px]">
                  Flux documentaire et gestion administrative centralisée
                </p>
              </div>
            </div>

            <Button
              onClick={() => sheet.open()}
              className="h-14 px-8 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 border-b-4 border-emerald-700 shadow-xl shadow-success/20 w-full md:w-auto"
              icon={<Plus className="w-5 h-5 stroke-[4]" />}
            >
              Nouveau Courrier
            </Button>
          </div>
        </div>

        {/* Stats Section - Repertoire Style */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Total documents', value: stats.total, icon: FileText, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Courriers entrants', value: stats.incoming, icon: Inbox, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Courriers sortants', value: stats.outgoing, icon: Send, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'En attente', value: stats.pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', isWarning: true },
          ].map((stat, i) => (
            <div key={i} className="p-6 border-2 border-emerald-100 bg-white transition-all text-left group relative overflow-hidden rounded-xl hover:border-emerald-200 hover:scale-[1.02] shadow-sm">
              <div className={cn("absolute top-0 right-0 w-24 h-24 rounded-full -mr-8 -mt-8 transition-transform duration-500 group-hover:scale-110 opacity-10", stat.bg)} />

              <div className="flex items-center justify-between mb-4 relative z-10">
                <div className={cn("p-4 rounded-xl shadow-none transition-all duration-300 group-hover:rotate-12", stat.bg, stat.color)}>
                  <stat.icon className="w-6 h-6" />
                </div>
                {stat.isWarning && stat.value > 0 && (
                  <div className="flex flex-col items-end">
                    <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                    <span className="text-[9px] font-black uppercase tracking-tighter mt-1 text-emerald-800/40">Action Requise</span>
                  </div>
                )}
              </div>
              <div className="relative z-10">
                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-800/40 mb-1">{stat.label}</p>
                <p className="text-3xl font-black text-emerald-950 tracking-tight leading-none">{stat.value.toString().padStart(2, '0')}</p>
              </div>

              {stat.isWarning && stat.value > 0 && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-yellow-400 rounded-r-full shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
              )}
            </div>
          ))}
        </div>

        {/* Filters Section - Repertoire Style */}
        <div className="bg-white border-2 border-emerald-100 p-2 rounded-xl flex flex-col lg:flex-row gap-2 transition-all hover:border-emerald-200 shadow-sm">
          <div className="flex-1 relative">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
            <input
              type="text"
              placeholder="Rechercher par n° ou objet..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-12 pl-14 pr-6 bg-transparent text-sm font-bold text-emerald-950 outline-none placeholder:text-emerald-200"
            />
          </div>
          <div className="h-px lg:h-8 lg:w-px bg-emerald-100 self-center" />
          <div className="flex items-center gap-2 p-1">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-10 px-4 bg-emerald-50 rounded-lg text-[9px] font-black uppercase tracking-widest text-emerald-800 outline-none border-none cursor-pointer hover:bg-emerald-100 transition-colors"
            >
              <option value="all">Tous les types</option>
              {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 px-4 bg-emerald-50 rounded-lg text-[9px] font-black uppercase tracking-widest text-emerald-800 outline-none border-none cursor-pointer hover:bg-emerald-100 transition-colors"
            >
              <option value="all">Tous les statuts</option>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
            <Button variant="secondary" className="h-10 px-4 rounded-lg bg-emerald-100/50 text-emerald-600 hover:text-emerald-950 border-none transition-colors">
              <Filter className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Table/List Section - Repertoire Style */}
        <div className="bg-white border-2 border-emerald-100 overflow-hidden rounded-xl shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-emerald-50/50">
                  <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-emerald-800/40 border-b border-emerald-100">Numéro & Type</th>
                  <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-emerald-800/40 border-b border-emerald-100">Objet & Date</th>
                  <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-emerald-800/40 border-b border-emerald-100">Statut</th>
                  <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-emerald-800/40 border-b border-emerald-100">Responsable</th>
                  <th className="px-8 py-5 text-right text-[10px] font-black uppercase tracking-widest text-emerald-800/40 border-b border-emerald-100">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100">
                {paginatedMailItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-32 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="p-6 bg-slate-50 rounded-full">
                          <Inbox className="w-12 h-12 text-slate-200" />
                        </div>
                        <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Aucun courrier trouvé</p>
                        <Button variant="secondary" onClick={() => { setSearchTerm(''); setTypeFilter('all'); setStatusFilter('all'); }} className="h-10 px-6 rounded-xl">Réinitialiser les filtres</Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedMailItems.map((item) => {
                    const typeCfg = TYPE_CONFIG[item.mail_type] || TYPE_CONFIG.internal;
                    const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.registered;
                    const assignedUser = users.find(u => u.id === item.assigned_to);

                    return (
                      <tr key={item.id} className="group hover:bg-emerald-50/50 transition-all">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-4">
                            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center border-2 border-emerald-100 bg-emerald-50 transition-all group-hover:bg-white group-hover:border-emerald-300 shadow-sm")}>
                              <typeCfg.icon className={cn("w-5 h-5", typeCfg.color)} />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-black text-emerald-950 leading-tight uppercase tracking-tight">{item.mail_number}</span>
                              <span className={cn("text-[9px] font-black uppercase tracking-widest mt-0.5", typeCfg.color)}>{typeCfg.label}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-emerald-900 leading-tight mb-1 truncate max-w-[250px] uppercase tracking-tighter">{item.subject}</span>
                            <span className="flex items-center gap-1.5 text-[9px] font-black text-emerald-800/40 uppercase tracking-widest">
                              <Clock className="w-3 h-3 text-emerald-400" />
                              {item.received_date || item.sent_date ? new Date(item.received_date || item.sent_date || '').toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'}
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="relative inline-block">
                            <select
                              value={item.status}
                              onChange={(e) => updateStatus(item.id, e.target.value)}
                              className={cn(
                                "h-9 px-4 pr-8 rounded-xl text-[9px] font-black uppercase tracking-widest border-2 appearance-none cursor-pointer outline-none transition-all shadow-sm",
                                statusCfg.bg, statusCfg.color, "border-white group-hover:border-emerald-100"
                              )}
                            >
                              <option value={item.status}>{statusCfg.label}</option>
                              {(STATUS_WORKFLOW[item.status] || []).map((s) => (
                                <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                              ))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                              <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", statusCfg.color.replace('text-', 'bg-'))} />
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <button
                            onClick={() => { setMailToAssign(item.id); assignmentModal.open(); }}
                            className="flex items-center gap-3 bg-emerald-50/50 hover:bg-emerald-100/50 px-3 py-2 rounded-xl border border-dashed border-emerald-200 transition-colors"
                          >
                            <div className="w-8 h-8 rounded-lg bg-white border border-emerald-100 flex items-center justify-center shadow-sm">
                              <User className="w-4 h-4 text-emerald-400" />
                            </div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-800/60">
                              {assignedUser ? (assignedUser.full_name || assignedUser.email) : 'Assigner...'}
                            </span>
                          </button>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                            <Link href={`/courriers/${item.id}`} className="w-10 h-10 flex items-center justify-center bg-white border-2 border-emerald-100 text-emerald-600 rounded-xl hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all shadow-sm">
                              <Eye className="w-4 h-4" />
                            </Link>
                            <Link href={`/courriers/${item.id}/edit`} className="w-10 h-10 flex items-center justify-center bg-white border-2 border-emerald-100 text-blue-400 rounded-xl hover:bg-blue-500 hover:text-white hover:border-blue-500 transition-all shadow-sm">
                              <Edit className="w-4 h-4" />
                            </Link>
                            <button
                              onClick={() => { setMailToDelete(item.id); deleteModal.open(); }}
                              className="w-10 h-10 flex items-center justify-center bg-white border-2 border-emerald-100 text-red-400 rounded-xl hover:bg-red-500 hover:text-white hover:border-red-500 transition-all shadow-sm"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
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
              itemsPerPage={itemsPerPage}
              totalItems={filteredMailItems.length}
            />
          </div>
        )}

        {/* Modals & Sheet */}
        <Sheet
          isOpen={sheet.isOpen}
          onClose={sheet.close}
          title="Enregistrer un courrier"
          description="Remplissez les informations pour documenter un nouveau courrier entrant ou sortant."
          size="lg"
        >
          <MailForm onSuccess={() => { sheet.close(); fetchMailItems(); }} onCancel={sheet.close} />
        </Sheet>

        <ConfirmModal
          isOpen={deleteModal.isOpen}
          onClose={deleteModal.close}
          onConfirm={handleDelete}
          title="Supprimer définitivement ?"
          message="Cette action est irréversible. Les pièces jointes associées resteront accessibles via l'archive."
          variant="danger"
        />

        {mailToAssign && (
          <UserAssignmentModal
            isOpen={assignmentModal.isOpen}
            onClose={() => { assignmentModal.close(); setMailToAssign(null); }}
            onSelect={assignToUser}
            currentUserId={mailItems.find(m => m.id === mailToAssign)?.assigned_to || null}
            profile={profile}
          />
        )}
      </div>
    </AppLayout>
  );
}

export default function CourriersPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
        </div>
      </AppLayout>
    }>
      <CourriersPageContent />
    </Suspense>
  );
}
