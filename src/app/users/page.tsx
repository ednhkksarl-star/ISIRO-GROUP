'use client';

import { useEffect, useState, useMemo } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { Plus, Search, Edit, Trash2, Eye, User as UserIcon, Users, Shield, CheckCircle, X } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/utils/cn';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import BackButton from '@/components/ui/BackButton';
import Pagination from '@/components/ui/Pagination';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import UserProfileModal from '@/components/users/UserProfileModal';
import UserFormModal from '@/components/users/UserFormModal';
import { useModal } from '@/hooks/useModal';
import type { Database } from '@/types/database.types';
import { getRoleLabel } from '@/utils/roleTranslations';

type User = Database['public']['Tables']['users']['Row'];

export default function UsersPage() {
  const { profile } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8; // Reduced for card layout
  const supabase = createSupabaseClient();
  const deleteModal = useModal();
  const viewModal = useModal();
  const formModal = useModal();
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);

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
      setError(false);
      const query = supabase.from('users').select('*').order('created_at', { ascending: false });
      const { data, error } = await query;

      if (error) throw error;
      setUsers(data || []);
      setError(false);
    } catch (error: any) {
      setError(true);
      toast.error('Erreur lors du chargement des utilisateurs');
      console.error(error);
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
      toast.error('Impossible de supprimer l\'utilisateur. Une erreur est survenue.');
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

  // Analytics
  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter(u => u.is_active).length,
    admins: users.filter(u => u.role === 'SUPER_ADMIN_GROUP').length
  }), [users]);

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
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-10">
        {/* Header Block - Repertoire Style */}
        <div className="bg-white border-2 border-emerald-100 p-6 rounded-xl relative overflow-hidden group shadow-sm transition-all hover:border-emerald-200">
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-50 rounded-full -mr-24 -mt-24 transition-transform duration-500 group-hover:scale-110 opacity-50" />

          <div className="flex flex-col md:flex-row justify-between items-center sm:items-end gap-6 relative z-10">
            <div className="space-y-4 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-100">
                <Users className="w-4 h-4 text-emerald-600" />
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800">Gestion des Accès</span>
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-emerald-950 uppercase leading-none">Utilisateurs</h1>
                <div className="h-1.5 w-24 bg-yellow-400 mt-4 rounded-full" />
              </div>
            </div>

            {(profile?.role === 'SUPER_ADMIN_GROUP' || profile?.role === 'ADMIN_ENTITY') && (
              <button
                onClick={() => {
                  setUserToEdit(null);
                  formModal.open();
                }}
                className="h-12 px-6 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 text-[10px] font-black uppercase tracking-widest shadow-xl shadow-success/20 border-b-4 border-emerald-700 transition-all active:scale-95 flex items-center gap-3"
              >
                <Plus className="w-4 h-4 stroke-[4]" />
                Nouvel utilisateur
              </button>
            )}
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Total Utilisateurs', value: stats.total, icon: Users, color: 'emerald' },
            { label: 'Comptes Actifs', value: stats.active, icon: CheckCircle, color: 'emerald' },
            { label: 'Administrateurs', value: stats.admins, icon: Shield, color: 'emerald' },
          ].map((stat, i) => (
            <div key={i} className="bg-white border-2 border-emerald-100 p-4 rounded-xl flex items-center justify-between group hover:border-emerald-300 transition-all shadow-sm">
              <div className="space-y-1">
                <p className="text-[9px] font-black text-emerald-800/40 uppercase tracking-widest">{stat.label}</p>
                <p className="text-2xl font-black text-emerald-950">{stat.value}</p>
              </div>
              <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <stat.icon className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          ))}
        </div>

        {/* Search Block */}
        <div className="bg-white border-2 border-emerald-100 p-2 rounded-xl flex flex-col lg:flex-row gap-2 transition-all hover:border-emerald-200 shadow-sm">
          <div className="flex-1 relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400 group-focus-within:text-emerald-600 transition-colors" />
            <input
              type="text"
              placeholder="Rechercher par nom ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-11 pl-14 pr-6 bg-transparent text-sm font-bold text-emerald-950 outline-none placeholder:text-emerald-200"
            />
          </div>
        </div>

        {/* Users Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {loading ? (
            <div className="col-span-full flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
          ) : error || filteredUsers.length === 0 ? (
            <div className="col-span-full text-center py-20 bg-white border-2 border-emerald-100 rounded-[2rem] shadow-sm">
              <div className="flex flex-col items-center gap-4">
                <div className={cn("p-6 rounded-full", error ? "bg-rose-50" : "bg-emerald-50")}>
                  {error ? <X className="w-12 h-12 text-rose-300" /> : <Search className="w-12 h-12 text-emerald-200" />}
                </div>
                <div>
                  <p className={cn("font-bold uppercase text-xs tracking-[0.2em]", error ? "text-rose-600" : "text-emerald-800/40")}>
                    {error ? 'Erreur de chargement' : 'Aucun utilisateur trouvé'}
                  </p>
                  {error && (
                    <button
                      onClick={fetchUsers}
                      className="mt-4 px-6 py-2 bg-rose-100 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-200 transition-all active:scale-95"
                    >
                      Réessayer
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            paginatedUsers.map((user) => (
              <div
                key={user.id}
                className="bg-white border-2 border-emerald-100 p-6 rounded-2xl relative overflow-hidden group hover:border-emerald-300 transition-all duration-500 shadow-sm active:scale-95 flex flex-col"
              >
                {/* Decorative Colorful Glow */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
                <div className="absolute bottom-0 left-0 w-20 h-20 bg-emerald-500/5 rounded-full -ml-10 -mb-10 blur-2xl group-hover:bg-emerald-500/10 transition-colors" />

                <div className="relative z-10 w-full flex flex-col items-center text-center">
                  {/* User Avatar */}
                  <div className="relative w-16 h-16 mb-4 group-hover:scale-105 transition-all duration-500">
                    <div className="absolute inset-0 bg-emerald-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    {user.avatar_url ? (
                      <div className="w-full h-full rounded-2xl overflow-hidden bg-white shadow-xl shadow-emerald-500/5 border-2 border-emerald-100 group-hover:border-emerald-300 flex items-center justify-center relative z-10 transition-colors">
                        <Image
                          src={user.avatar_url}
                          alt={user.full_name || user.email}
                          width={60}
                          height={60}
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="w-full h-full rounded-2xl bg-emerald-50 border-2 border-emerald-100 flex items-center justify-center text-emerald-300 relative z-10 group-hover:border-emerald-300 transition-colors">
                        <UserIcon className="w-8 h-8" />
                      </div>
                    )}
                  </div>

                  <div className="mb-6 space-y-2 flex-1 min-w-0">
                    <h3 className="text-sm font-black text-emerald-950 tracking-tight leading-tight uppercase group-hover:text-emerald-600 transition-colors line-clamp-1 px-1">
                      {user.full_name || user.email}
                    </h3>
                    <div className="flex flex-col gap-2 items-center justify-center">
                      <span className="px-3 py-1 bg-emerald-950 text-white rounded-lg text-[8px] font-black uppercase tracking-[0.2em] leading-none shadow-lg shadow-emerald-900/20">
                        {getRoleLabel(user.role)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <div className={cn("w-1.5 h-1.5 rounded-full px-0", user.is_active ? "bg-emerald-500" : "bg-rose-500")} />
                        <span className={cn("text-[9px] font-black uppercase tracking-widest", user.is_active ? "text-emerald-600" : "text-rose-500")}>
                          {user.is_active ? 'Compte Actif' : 'Compte Inactif'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="w-full pt-4 border-t border-emerald-50 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0 duration-500">
                    <button
                      onClick={() => {
                        setViewingUser(user);
                        viewModal.open();
                      }}
                      className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 hover:text-white hover:bg-emerald-600 transition-all flex items-center justify-center shadow-sm"
                      title="Voir Profile"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setUserToEdit(user);
                        formModal.open();
                      }}
                      className="flex-1 h-10 rounded-xl bg-emerald-50 text-emerald-600 hover:text-white hover:bg-emerald-600 transition-all font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm"
                      title="Editer Profile"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      Modifier
                    </button>
                    <button
                      onClick={() => {
                        setUserToDelete(user.id);
                        deleteModal.open();
                      }}
                      className="h-10 w-10 rounded-xl bg-rose-50 text-rose-500 hover:text-white hover:bg-rose-500 transition-all flex items-center justify-center shadow-sm"
                      title="Supprimer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination Block */}
        {totalPages > 1 && (
          <div className="bg-white border-2 border-emerald-100 rounded-xl p-4 shadow-sm">
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
        title="Supprimer ?"
        message="Confirmez-vous la suppression définitive de cet utilisateur ? Cette action est irréversible."
        variant="danger"
        confirmText="Supprimer"
        cancelText="Annuler"
      />

      <UserProfileModal
        isOpen={viewModal.isOpen}
        onClose={viewModal.close}
        user={viewingUser}
      />

      <UserFormModal
        isOpen={formModal.isOpen}
        onClose={formModal.close}
        user={userToEdit}
        onSuccess={fetchUsers}
      />
    </AppLayout>
  );
}

