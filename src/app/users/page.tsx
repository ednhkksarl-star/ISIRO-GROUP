'use client';

import { useEffect, useState, useMemo } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { Plus, Search, Edit, Trash2, Eye, User as UserIcon } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'react-toastify';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import BackButton from '@/components/ui/BackButton';
import Pagination from '@/components/ui/Pagination';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useModal } from '@/hooks/useModal';
import type { Database } from '@/types/database.types';
import { getRoleLabel } from '@/utils/roleTranslations';

type User = Database['public']['Tables']['users']['Row'];

export default function UsersPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const supabase = createSupabaseClient();
  const deleteModal = useModal();
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (
      profile?.role !== 'SUPER_ADMIN_GROUP' &&
      profile?.role !== 'ADMIN_ENTITY'
    ) {
      return;
    }
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      // Admin Entity can now view all users (not just their entity)
      const query = supabase.from('users').select('*').order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error('Erreur Supabase lors du chargement des utilisateurs:', error);
        console.error('Code erreur:', error.code);
        console.error('Message:', error.message);
        console.error('Details:', error.details);
        console.error('Hint:', error.hint);
        throw error;
      }

      console.log('Utilisateurs chargés:', data?.length || 0, data);
      setUsers(data || []);
    } catch (error: any) {
      const errorMessage = error.message || error.details || 'Erreur lors du chargement des utilisateurs';
      toast.error(`Erreur lors du chargement des utilisateurs: ${errorMessage}`);
      console.error('Erreur complète:', error);
      setUsers([]); // S'assurer que la liste est vide en cas d'erreur
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;

    try {
      // Récupérer le token d'authentification
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Session expirée. Veuillez vous reconnecter.');
        return;
      }

      // Appeler l'API pour supprimer l'utilisateur (supprime dans auth.users et users)
      const response = await fetch(`/api/users/delete?id=${userToDelete}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la suppression');
      }

      toast.success('Utilisateur supprimé avec succès');
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la suppression');
      console.error(error);
    } finally {
      deleteModal.close();
      setUserToDelete(null);
    }
  };

  const filteredUsers = useMemo(
    () =>
      users.filter(
        (user) =>
          user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (user.full_name || '').toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [users, searchTerm]
  );

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredUsers.slice(startIndex, endIndex);
  }, [filteredUsers, currentPage, itemsPerPage]);

  // Réinitialiser la page si elle est hors limites
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  if (
    profile?.role !== 'SUPER_ADMIN_GROUP' &&
    profile?.role !== 'ADMIN_ENTITY'
  ) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Accès non autorisé</p>
        </div>
      </AppLayout>
    );
  }

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
            <h1 className="text-3xl font-bold text-gray-900">Utilisateurs</h1>
            <p className="text-gray-600 mt-1">Gestion des utilisateurs</p>
          </div>
          {(profile?.role === 'SUPER_ADMIN_GROUP' || profile?.role === 'ADMIN_ENTITY') && (
            <Link href="/users/new">
              <Button icon={<Plus className="w-5 h-5" />}>
                Nouvel utilisateur
              </Button>
            </Link>
          )}
        </div>

        {/* Search */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher un utilisateur..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Users Grid/Table */}
        <div className="bg-cardBg rounded-xl shadow-lg overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Utilisateur
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Rôle
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Entités
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      {filteredUsers.length === 0 ? 'Aucun utilisateur trouvé' : 'Aucun utilisateur sur cette page'}
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-primary/5 transition-colors">
                      <td className="px-4 sm:px-6 py-4">
                        <div className="flex items-center gap-3">
                          {user.avatar_url ? (
                            <div className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-primary/20">
                              <Image
                                src={user.avatar_url}
                                alt={user.full_name || user.email}
                                fill
                                className="object-cover"
                                unoptimized
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <UserIcon className="w-5 h-5 text-primary" />
                            </div>
                          )}
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {user.full_name || user.email}
                            </div>
                            {user.full_name && (
                              <div className="text-xs text-gray-500">{user.email}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <Badge variant="info">
                          {getRoleLabel(user.role)}
                        </Badge>
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <div className="text-sm text-gray-600">
                          {user.entity_ids && user.entity_ids.length > 0
                            ? `${user.entity_ids.length} entité(s)`
                            : user.entity_id
                            ? '1 entité'
                            : 'Toutes'}
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <Badge variant={user.is_active ? 'success' : 'error'}>
                          {user.is_active ? 'Actif' : 'Inactif'}
                        </Badge>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/users/${user.id}`}
                            className="text-primary hover:text-primary-dark transition-colors"
                            title="Voir"
                          >
                            <Eye className="w-5 h-5" />
                          </Link>
                          <Link
                            href={`/users/${user.id}/edit`}
                            prefetch={false}
                            className="text-blue-600 hover:text-blue-700 transition-colors"
                            title="Modifier"
                          >
                            <Edit className="w-5 h-5" />
                          </Link>
                          <button
                            onClick={() => {
                              setUserToDelete(user.id);
                              deleteModal.open();
                            }}
                            className="text-error hover:text-red-700 transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-gray-200">
            {paginatedUsers.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">
                {filteredUsers.length === 0 ? 'Aucun utilisateur trouvé' : 'Aucun utilisateur sur cette page'}
              </div>
            ) : (
              paginatedUsers.map((user) => (
                <div key={user.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-3">
                    {user.avatar_url ? (
                      <div className="relative w-12 h-12 rounded-full overflow-hidden ring-2 ring-primary/20 flex-shrink-0">
                        <Image
                          src={user.avatar_url}
                          alt={user.full_name || user.email}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <UserIcon className="w-6 h-6 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        {user.full_name || user.email}
                      </div>
                      {user.full_name && (
                        <div className="text-xs text-gray-500 truncate">{user.email}</div>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="info" size="sm">
                          {getRoleLabel(user.role)}
                        </Badge>
                        <Badge
                          variant={user.is_active ? 'success' : 'error'}
                          size="sm"
                        >
                          {user.is_active ? 'Actif' : 'Inactif'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <Link
                          href={`/users/${user.id}`}
                          className="text-primary hover:text-primary-dark text-sm font-medium"
                        >
                          Voir
                        </Link>
                        <span className="text-gray-300">•</span>
                        <Link
                          href={`/users/${user.id}/edit`}
                          prefetch={false}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                          Modifier
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
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
              totalItems={filteredUsers.length}
            />
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={deleteModal.close}
        onConfirm={handleDeleteConfirm}
        title="Confirmer la suppression"
        message="Êtes-vous sûr de vouloir supprimer cet utilisateur ? Cette action est irréversible."
        variant="danger"
      />
    </AppLayout>
  );
}

