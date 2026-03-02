'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { Plus, Search, Edit, Trash2, Shield } from 'lucide-react';
import { toast } from 'react-toastify';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import Input from '@/components/ui/Input';
import { useModal } from '@/hooks/useModal';

interface Role {
  id: string;
  code: string;
  label: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  permissions: any;
  created_at: string;
  updated_at: string;
}

export default function RolesPage() {
  const { profile } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const supabase = createSupabaseClient();
  const deleteModal = useModal();
  const editModal = useModal();
  const [roleToDelete, setRoleToDelete] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    label: '',
    description: '',
    is_active: true,
  });

  useEffect(() => {
    if (
      profile?.role !== 'SUPER_ADMIN_GROUP' &&
      profile?.role !== 'ADMIN_ENTITY'
    ) {
      return;
    }
    fetchRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .order('label', { ascending: true });

      if (error) throw error;
      setRoles(data || []);
    } catch (error: any) {
      toast.error('Erreur lors du chargement des rôles');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!roleToDelete) return;

    try {
      const { error } = await (supabase
        .from('roles') as any)
        .delete()
        .eq('id', roleToDelete);

      if (error) throw error;
      toast.success('Rôle supprimé');
      fetchRoles();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la suppression');
      console.error(error);
    } finally {
      deleteModal.close();
      setRoleToDelete(null);
    }
  };

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setFormData({
      code: role.code,
      label: role.label,
      description: role.description || '',
      is_active: role.is_active,
    });
    editModal.open();
  };

  const handleCreate = () => {
    setEditingRole(null);
    setFormData({
      code: '',
      label: '',
      description: '',
      is_active: true,
    });
    editModal.open();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRole) {
        // Mise à jour - Permettre même pour les rôles système
        const { error } = await (supabase
          .from('roles') as any)
          .update({
            label: formData.label,
            description: formData.description || null,
            is_active: formData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingRole.id);

        if (error) throw error;
        toast.success('Rôle mis à jour');
      } else {
        // Création
        const { error } = await (supabase.from('roles') as any).insert({
          code: formData.code.toUpperCase().replace(/\s+/g, '_'),
          label: formData.label,
          description: formData.description || null,
          is_active: formData.is_active,
          is_system: false,
        });

        if (error) throw error;
        toast.success('Rôle créé');
      }

      editModal.close();
      fetchRoles();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la sauvegarde');
      console.error(error);
    }
  };

  const filteredRoles = roles.filter(
    (role) =>
      role.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      role.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (role.description && role.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestion des rôles</h1>
            <p className="text-gray-600 mt-1">Créer et gérer les rôles utilisateurs</p>
          </div>
          <Button icon={<Plus className="w-5 h-5" />} onClick={handleCreate}>
            Nouveau rôle
          </Button>
        </div>

        {/* Search */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher un rôle..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Roles Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-primary/10 to-primary/5">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-primary uppercase tracking-wider">
                    Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-primary uppercase tracking-wider">
                    Label
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-primary uppercase tracking-wider">
                    Description
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
                {filteredRoles.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      Aucun rôle trouvé
                    </td>
                  </tr>
                ) : (
                  filteredRoles.map((role) => (
                    <tr key={role.id} className="hover:bg-primary/5 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-primary" />
                          <code className="text-sm font-mono text-gray-900">{role.code}</code>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{role.label}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-500 truncate max-w-md">
                          {role.description || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={role.is_active ? 'success' : 'error'}>
                          {role.is_active ? 'Actif' : 'Inactif'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(role)}
                            className="text-blue-600 hover:text-blue-700 transition-colors"
                            title="Modifier"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => {
                              setRoleToDelete(role.id);
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
        </div>
      </div>

      {/* Edit/Create Modal */}
      <Modal
        isOpen={editModal.isOpen}
        onClose={editModal.close}
        title={editingRole ? 'Modifier le rôle' : 'Nouveau rôle'}
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={editModal.close}>
              Annuler
            </Button>
            <Button onClick={handleSubmit}>
              {editingRole ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editingRole && (
            <div>
              <Input
                label="Code du rôle *"
                placeholder="Ex: MANAGER_ENTITY"
                value={formData.code}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    code: e.target.value.toUpperCase().replace(/\s+/g, '_'),
                  })
                }
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                Code unique en majuscules avec underscores (ex: MANAGER_ENTITY)
              </p>
            </div>
          )}
          {editingRole && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Code (non modifiable)
              </label>
              <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm font-mono text-gray-700">
                {editingRole.code}
              </div>
            </div>
          )}
          <Input
            label="Label *"
            placeholder="Ex: Manager Entité"
            value={formData.label}
            onChange={(e) => setFormData({ ...formData, label: e.target.value })}
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Description du rôle..."
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) =>
                setFormData({ ...formData, is_active: e.target.checked })
              }
              className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
              Rôle actif (disponible dans les formulaires)
            </label>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={deleteModal.close}
        onConfirm={handleDeleteConfirm}
        title="Confirmer la suppression"
        message="Êtes-vous sûr de vouloir supprimer ce rôle ? Cette action est irréversible. Les utilisateurs ayant ce rôle devront être réassignés."
        variant="danger"
      />
    </AppLayout>
  );
}

