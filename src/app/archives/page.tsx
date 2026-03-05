'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { Plus, Search, Download, Trash2, Upload, FileText, Calendar, Filter, FileBarChart } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/utils/cn';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import BackButton from '@/components/ui/BackButton';
import Pagination from '@/components/ui/Pagination';
import ConfirmModal from '@/components/ui/ConfirmModal';
import PromptModal from '@/components/ui/PromptModal';
import { useModal } from '@/hooks/useModal';
import { useEntity } from '@/hooks/useEntity';
import EntitySelector from '@/components/entity/EntitySelector';
import { normalizeEntityIds, getEntityUUID } from '@/utils/entityHelpers';
import type { Database } from '@/types/database.types';

type Document = Database['public']['Tables']['documents']['Row'];

const MODULE_LABELS: Record<string, string> = {
  billing: 'Facturation',
  accounting: 'Comptabilité',
  expenses: 'Dépenses',
  administration: 'Administration',
  mail: 'Courriers',
  archive: 'Archive',
};

function ArchivesPageContent() {
  const { profile } = useAuth();
  const toast = useToast();
  const { selectedEntityId, setSelectedEntityId, isGroupView } = useEntity();
  const searchParams = useSearchParams();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterModule, setFilterModule] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const supabase = createSupabaseClient();

  // Utiliser l'entité depuis les paramètres de requête ou selectedEntityId (qui peut être null pour vue consolidée)
  const targetEntityId = searchParams?.get('entity') || (isGroupView ? null : selectedEntityId);

  // Synchroniser le paramètre URL avec le contexte selectedEntityId
  useEffect(() => {
    const entityParam = searchParams?.get('entity');
    if (entityParam && (profile?.role === 'SUPER_ADMIN_GROUP' || profile?.role === 'ADMIN_ENTITY')) {
      // Convertir le paramètre (code ou UUID) en UUID avant de le stocker dans le contexte
      getEntityUUID(entityParam).then((uuid) => {
        if (uuid) {
          console.log('[Archives] Synchronisation URL -> contexte:', entityParam, '->', uuid);
          setSelectedEntityId(uuid);
        } else {
          console.warn('[Archives] Impossible de convertir le paramètre entity en UUID:', entityParam);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams?.get('entity'), profile?.role]);

  // Vérifier si l'utilisateur peut sélectionner une entité
  const canSelectEntity = profile?.role === 'SUPER_ADMIN_GROUP' ||
    profile?.role === 'ADMIN_ENTITY' ||
    (profile?.entity_ids && profile.entity_ids.length > 1);

  // Modales
  const deleteModal = useModal();
  const modulePrompt = useModal();
  const categoryPrompt = useModal();
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingModule, setPendingModule] = useState<string>('');
  const [documentToDelete, setDocumentToDelete] = useState<{
    id: string;
    fileUrl: string;
  } | null>(null);

  useEffect(() => {
    fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, targetEntityId, filterModule, filterYear]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      // Système intelligent : filtrer automatiquement selon le rôle et l'entité
      // Utiliser targetEntityId si spécifié (pour les admins qui sélectionnent une entité)
      if (targetEntityId && profile && (profile.role === 'SUPER_ADMIN_GROUP' || profile.role === 'ADMIN_ENTITY')) {
        const uuid = await getEntityUUID(targetEntityId);
        if (uuid) {
          query = query.eq('entity_id', uuid);
        } else {
          query = query.eq('id', '00000000-0000-0000-0000-000000000000');
        }
      } else if (profile && (profile.role === 'SUPER_ADMIN_GROUP' || profile.role === 'ADMIN_ENTITY')) {
        // Vue consolidée pour Super Admin/Admin Entity (pas de filtre)
        // Pas besoin de filtrer, ils voient tout
      } else if (profile) {
        // Pour tous les autres utilisateurs (y compris AGENT_ACCUEIL, MANAGER_ENTITY, etc.),
        // filtrer automatiquement par leur(s) entité(s)
        if (profile.role !== 'SUPER_ADMIN_GROUP' && profile.role !== 'ADMIN_ENTITY') {
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
            query = query.eq('id', '00000000-0000-0000-0000-000000000000');
          }
        }
      }

      if (filterModule !== 'all') {
        query.eq('module', filterModule);
      }

      if (filterYear !== 'all') {
        query.eq('year', parseInt(filterYear));
      }

      const { data, error } = await query;

      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      toast.error('Erreur lors du chargement des documents');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };


  const handleFileUpload = async (file: File, docModule: string, category: string) => {
    if (!targetEntityId) {
      toast.error('Veuillez sélectionner une entité');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${targetEntityId}/${Date.now()}.${fileExt}`;
      const filePath = `documents/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('documents').getPublicUrl(filePath);

      const year = new Date().getFullYear();

      const { error: insertError } = await supabase.from('documents').insert({
        entity_id: targetEntityId,
        file_name: file.name,
        file_url: publicUrl,
        file_type: file.type,
        file_size: file.size,
        module: docModule as any,
        year,
        description: category || null,
        uploaded_by: profile?.id || '',
      } as any);

      if (insertError) throw insertError;

      toast.success('Document uploadé avec succès');
      fetchDocuments();
    } catch (error: any) {
      toast.error('Erreur lors de l\'upload');
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteClick = (id: string, fileUrl: string) => {
    setDocumentToDelete({ id, fileUrl });
    deleteModal.open();
  };

  const handleDeleteConfirm = async () => {
    if (!documentToDelete) return;

    try {
      // Supprimer le fichier du storage
      const filePath = documentToDelete.fileUrl.split('/').slice(-2).join('/');
      await supabase.storage.from('documents').remove([filePath]);

      // Supprimer l'enregistrement
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentToDelete.id);

      if (error) throw error;
      toast.success('Document supprimé');
      fetchDocuments();
      setDocumentToDelete(null);
    } catch (error: any) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const filteredDocuments = useMemo(
    () =>
      documents.filter(
        (doc) =>
          doc.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          doc.module.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (doc.description || '').toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [documents, searchTerm]
  );

  // Pagination
  const totalPages = Math.ceil(filteredDocuments.length / itemsPerPage);
  const paginatedDocuments = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredDocuments.slice(startIndex, endIndex);
  }, [filteredDocuments, currentPage, itemsPerPage]);

  // Réinitialiser la page si elle est hors limites
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const years = Array.from(
    new Set(documents.map((doc) => doc.year))
  ).sort((a, b) => b - a);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-10">
        {/* Header Block - Repertoire Style */}
        <div className="bg-white border-2 border-emerald-100 p-6 sm:p-8 rounded-xl relative overflow-hidden group shadow-sm transition-all hover:border-emerald-200">
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-50 rounded-full -mr-24 -mt-24 transition-transform duration-500 group-hover:scale-110 opacity-50" />

          <div className="flex flex-col md:flex-row justify-between items-center sm:items-end gap-6 relative z-10">
            <div className="space-y-4 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-100">
                <FileBarChart className="w-4 h-4 text-emerald-600" />
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800">Gestion Documentaire</span>
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-emerald-950 uppercase leading-none">Archives & GED</h1>
                <div className="h-1.5 w-24 bg-yellow-400 mt-4 rounded-full" />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              {canSelectEntity && profile && (
                <div className="bg-emerald-50/50 p-1 rounded-xl border border-emerald-100 shadow-sm">
                  <EntitySelector
                    selectedEntityId={targetEntityId}
                    onSelectEntity={(entityId) => {
                      setSelectedEntityId(entityId);
                      const url = new URL(window.location.href);
                      if (entityId) url.searchParams.set('entity', entityId);
                      else url.searchParams.delete('entity');
                      window.history.pushState({}, '', url.toString());
                      fetchDocuments();
                    }}
                    userRole={profile.role}
                    userEntityIds={profile.entity_ids}
                    className="w-auto border-none bg-transparent"
                  />
                </div>
              )}

              <input
                type="file"
                id="file-upload"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (!targetEntityId) {
                      toast.error('Veuillez sélectionner une entité avant d\'uploader un document');
                      return;
                    }
                    setPendingFile(file);
                    modulePrompt.open();
                  }
                }}
                disabled={!targetEntityId}
              />

              <button
                onClick={() => {
                  if (!targetEntityId) {
                    toast.error('Veuillez sélectionner une entité avant d\'uploader un document');
                    return;
                  }
                  document.getElementById('file-upload')?.click();
                }}
                disabled={!targetEntityId || uploading}
                className="h-14 px-8 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 text-[10px] font-black uppercase tracking-widest shadow-xl shadow-success/20 border-b-4 border-emerald-700 transition-all active:scale-95 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-5 h-5" />
                {uploading ? 'Upload en cours...' : 'Uploader un document'}
              </button>
            </div>
          </div>
        </div>

        {/* Filters Block - Repertoire Style */}
        <div className="bg-white border-2 border-emerald-100 p-2 rounded-xl flex flex-col lg:flex-row gap-2 transition-all hover:border-emerald-200 shadow-sm">
          <div className="flex-1 relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400 group-focus-within:text-emerald-600 transition-colors" />
            <input
              type="text"
              placeholder="Rechercher un document par nom ou module..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-12 pl-14 pr-6 bg-transparent text-sm font-bold text-emerald-950 outline-none placeholder:text-emerald-200"
            />
          </div>

          <div className="h-px lg:h-8 lg:w-px bg-emerald-100 self-center hidden lg:block" />

          <div className="flex flex-col sm:flex-row gap-2 p-1">
            <div className="relative">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-400 pointer-events-none" />
              <select
                value={filterModule}
                onChange={(e) => setFilterModule(e.target.value)}
                className="h-10 pl-10 pr-10 bg-emerald-50 border-none rounded-lg text-[10px] font-black uppercase tracking-widest text-emerald-800 appearance-none focus:ring-2 focus:ring-emerald-500/10 transition-all w-full sm:w-48 cursor-pointer hover:bg-emerald-100"
              >
                <option value="all">Tous modules</option>
                {Object.entries(MODULE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-400 pointer-events-none" />
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="h-10 pl-10 pr-10 bg-emerald-50 border-none rounded-lg text-[10px] font-black uppercase tracking-widest text-emerald-800 appearance-none focus:ring-2 focus:ring-emerald-500/10 transition-all w-full sm:w-40 cursor-pointer hover:bg-emerald-100"
              >
                <option value="all">Toutes années</option>
                {years.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Documents Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {paginatedDocuments.length === 0 ? (
            <div className="col-span-full text-center py-20 glass-card rounded-3xl border-none ring-1 ring-slate-100">
              <div className="flex flex-col items-center gap-4">
                <div className="p-6 bg-slate-50 rounded-full">
                  <Search className="w-12 h-12 text-slate-200" />
                </div>
                <p className="text-slate-400 font-bold uppercase text-xs tracking-[0.2em]">
                  {filteredDocuments.length === 0 ? 'Aucun document trouvé' : 'Aucun document sur cette page'}
                </p>
              </div>
            </div>
          ) : (
            paginatedDocuments.map((doc) => (
              <div
                key={doc.id}
                className="bg-white border-2 border-emerald-100 p-6 rounded-xl relative overflow-hidden group transition-all hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-500/5 active:scale-[0.98]"
              >
                {/* Decorative Icon Background */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full -mr-8 -mt-8 transition-transform duration-500 group-hover:scale-110 opacity-30" />

                <div className="flex flex-col h-full relative z-10">
                  <div className="flex items-start justify-between mb-6">
                    <div className="w-12 h-12 flex items-center justify-center bg-emerald-950 rounded-xl text-white shadow-lg shadow-emerald-950/20 transition-all group-hover:rotate-6 group-hover:bg-emerald-800">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest">{doc.year}</span>
                      <div className="mt-1 px-2 py-0.5 bg-emerald-50 border border-emerald-100 rounded-md text-[8px] font-black text-emerald-800 uppercase tracking-tighter">
                        {doc.file_type.split('/')[1]?.toUpperCase() || 'FILE'}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 mb-6">
                    <h3 className="font-black text-emerald-950 text-sm tracking-tight leading-tight line-clamp-2 mb-1 group-hover:text-emerald-700 transition-colors uppercase">
                      {doc.file_name}
                    </h3>
                    <p className="text-[9px] font-black text-emerald-800/40 uppercase tracking-widest">
                      {MODULE_LABELS[doc.module] || doc.module}
                    </p>
                    {doc.description && (
                      <div className="mt-3 flex items-start gap-2">
                        <div className="w-1 h-4 bg-yellow-400 rounded-full shrink-0" />
                        <p className="text-[10px] font-bold text-emerald-900/60 line-clamp-2">
                          {doc.description}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="pt-6 border-t border-emerald-50 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-emerald-950 uppercase">
                        {(doc.file_size / 1024).toFixed(1)} KB
                      </span>
                      <span className="text-[8px] font-bold text-emerald-800/30 uppercase tracking-tighter">Poids du document</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {(profile?.role === 'SUPER_ADMIN_GROUP' || profile?.role === 'ADMIN_ENTITY') && (
                        <button
                          onClick={() => handleDeleteClick(doc.id, doc.file_url)}
                          className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border-2 border-emerald-50 text-red-400 hover:text-white hover:bg-red-500 hover:border-red-500 transition-all active:scale-90 shadow-sm"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border-2 border-emerald-100 text-emerald-600 hover:text-white hover:bg-emerald-500 hover:border-emerald-500 transition-all active:scale-90 shadow-sm"
                        title="Télécharger"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination Section - Refined */}
        {totalPages > 1 && (
          <div className="flex justify-center pt-12 pb-6">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              totalItems={filteredDocuments.length}
            />
          </div>
        )}
      </div>

      {/* Modale de confirmation de suppression */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={deleteModal.close}
        onConfirm={handleDeleteConfirm}
        title="Supprimer le document"
        message="Êtes-vous sûr de vouloir supprimer ce document ? Cette action est irréversible."
        confirmText="Supprimer"
        cancelText="Annuler"
        variant="danger"
      />

      {/* Modale de saisie du module */}
      <PromptModal
        isOpen={modulePrompt.isOpen}
        onClose={modulePrompt.close}
        onConfirm={(module) => {
          setPendingModule(module || 'archive');
          modulePrompt.close();
          categoryPrompt.open();
        }}
        title="Module du document"
        message="Sélectionnez le module pour ce document"
        placeholder="billing, accounting, expenses, etc."
        defaultValue="archive"
        confirmText="Suivant"
        cancelText="Annuler"
      />

      {/* Modale de saisie de la catégorie */}
      <PromptModal
        isOpen={categoryPrompt.isOpen}
        onClose={() => {
          categoryPrompt.close();
          setPendingFile(null);
          setPendingModule('');
        }}
        onConfirm={async (category) => {
          if (pendingFile) {
            await handleFileUpload(pendingFile, pendingModule || 'archive', category);
            setPendingFile(null);
            setPendingModule('');
          }
        }}
        title="Catégorie du document"
        message="Entrez la catégorie (optionnel)"
        placeholder="Catégorie..."
        defaultValue=""
        confirmText="Uploader"
        cancelText="Annuler"
        required={false}
      />
    </AppLayout>
  );
}

export default function ArchivesPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
        </div>
      </AppLayout>
    }>
      <ArchivesPageContent />
    </Suspense>
  );
}

