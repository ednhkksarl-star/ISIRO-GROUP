'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { Plus, Search, Download, Trash2, Upload } from 'lucide-react';
import { toast } from 'react-toastify';
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
        <BackButton />
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-text">Archives & GED</h1>
            <p className="text-text-light mt-1 text-sm sm:text-base">Gestion électronique des documents</p>
          </div>
          <div className="flex items-center gap-3">
            {canSelectEntity && profile && (
              <EntitySelector
                selectedEntityId={targetEntityId}
                onSelectEntity={(entityId) => {
                  setSelectedEntityId(entityId);
                  // Mettre à jour l'URL avec le paramètre entity pour recharger les documents
                  // SANS rediriger vers le dashboard de l'entité
                  const url = new URL(window.location.href);
                  if (entityId) {
                    url.searchParams.set('entity', entityId);
                  } else {
                    url.searchParams.delete('entity');
                  }
                  window.history.pushState({}, '', url.toString());
                  // Recharger les documents
                  fetchDocuments();
                }}
                userRole={profile.role}
                userEntityIds={profile.entity_ids}
                className="w-auto"
              />
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <select
              value={filterModule}
              onChange={(e) => setFilterModule(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">Tous les modules</option>
              {Object.entries(MODULE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">Toutes les années</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <div className="flex gap-2 items-center">
              {!targetEntityId && canSelectEntity && (
                <div className="flex-1 flex items-center justify-center px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm">
                  Sélectionnez une entité pour archiver
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
                      toast.error('Veuillez sélectionner une entité avant d&apos;uploader un document');
                      return;
                    }
                    setPendingFile(file);
                    modulePrompt.open();
                  }
                }}
                disabled={!targetEntityId}
              />
              <Button
                type="button"
                onClick={() => {
                  if (!targetEntityId) {
                    toast.error('Veuillez sélectionner une entité avant d&apos;uploader un document');
                    return;
                  }
                  document.getElementById('file-upload')?.click();
                }}
                icon={<Upload className="w-5 h-5" />}
                className="w-full sm:w-auto"
                disabled={!targetEntityId || uploading}
              >
                {uploading ? 'Upload...' : 'Uploader'}
              </Button>
            </div>
          </div>
        </div>

        {/* Documents Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {paginatedDocuments.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-500">
              {filteredDocuments.length === 0 ? 'Aucun document trouvé' : 'Aucun document sur cette page'}
            </div>
          ) : (
            paginatedDocuments.map((doc) => (
              <div
                key={doc.id}
                className="bg-white rounded-lg shadow p-4 sm:p-6 space-y-3 sm:space-y-4"
              >
                <div>
                  <h3 className="font-semibold text-gray-900 truncate">
                    {doc.file_name}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {MODULE_LABELS[doc.module] || doc.module} - {doc.year}
                  </p>
                </div>


                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>
                    {(doc.file_size / 1024).toFixed(2)} KB
                  </span>
                  <span>{doc.file_type}</span>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t">
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 bg-primary-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-primary-700 text-sm sm:text-base"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Télécharger</span>
                    <span className="sm:hidden">Téléch.</span>
                  </a>
                  {(profile?.role === 'SUPER_ADMIN_GROUP' ||
                    profile?.role === 'ADMIN_ENTITY') && (
                    <button
                      onClick={() => handleDeleteClick(doc.id, doc.file_url)}
                      className="p-2 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white rounded-lg shadow p-4">
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    }>
      <ArchivesPageContent />
    </Suspense>
  );
}

