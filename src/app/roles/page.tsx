'use client';

import { useEffect, useState, useMemo } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { Plus, Search, Edit, Trash2, Shield, Info, CheckCircle, Database, X } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import Input from '@/components/ui/Input';
import { useModal } from '@/hooks/useModal';
import { cn } from '@/utils/cn';

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
  const toast = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
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
      setError(false);
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .order('label', { ascending: true });

      if (error) throw error;
      setRoles(data || []);
    } catch (error: any) {
      setError(true);
      // Pas de toast ici : l'état `error` affiche déjà le message inline
      console.error('fetchRoles error:', error);
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
      toast.error('Impossible de supprimer le rôle');
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
      toast.error('Impossible d\'enregistrer le rôle. Veuillez vérifier les informations.');
      console.error(error);
    }
  };

  const filteredRoles = useMemo(() => {
    return roles.filter(
      (role) =>
        role.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        role.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (role.description && role.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [roles, searchTerm]);

  const stats = useMemo(() => ({
    total: roles.length,
    active: roles.filter(r => r.is_active).length,
    system: roles.filter(r => r.is_system).length,
  }), [roles]);

  if (
    profile?.role !== 'SUPER_ADMIN_GROUP' &&
    profile?.role !== 'ADMIN_ENTITY'
  ) {
    return (
      <AppLayout>
        <div className="text-center py-20 flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500">
            <Shield className="w-8 h-8" />
          </div>
          <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest">Accès non autorisé</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header Block: Vibrant Minimalist */}
        <div className="bg-white border-2 border-emerald-100 p-8 sm:p-10 rounded-[2rem] relative overflow-hidden group hover:border-emerald-300 transition-all duration-700 shadow-sm">
          {/* Decorative Circle */}
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-emerald-50 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-700" />
          <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-yellow-50 rounded-full opacity-30 group-hover:scale-125 transition-transform duration-700" />

          <div className="flex flex-col md:flex-row justify-between items-center sm:items-end gap-6 relative z-10">
            <div className="space-y-4 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-100">
                <Shield className="w-4 h-4 text-emerald-600" />
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800">Gestion Administrative</span>
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-emerald-950 uppercase leading-none">Rôles & Accès</h1>
                <div className="h-1.5 w-24 bg-yellow-400 mt-4 rounded-full" />
              </div>
            </div>

            <button
              onClick={handleCreate}
              className="h-12 px-6 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 text-[10px] font-black uppercase tracking-widest shadow-xl shadow-success/20 border-b-4 border-emerald-700 transition-all active:scale-95 flex items-center gap-3"
            >
              <Plus className="w-4 h-4 stroke-[4]" />
              Nouveau rôle
            </button>
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Total Rôles', value: stats.total, icon: Shield, color: 'emerald' },
            { label: 'Rôles Actifs', value: stats.active, icon: CheckCircle, color: 'emerald' },
            { label: 'Rôles Système', value: stats.system, icon: Database, color: 'emerald' },
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
              placeholder="Rechercher par code ou label..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-11 pl-14 pr-6 bg-transparent text-sm font-bold text-emerald-950 outline-none placeholder:text-emerald-200"
            />
          </div>
        </div>

        {/* Roles Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
          ) : error || filteredRoles.length === 0 ? (
            <div className="col-span-full text-center py-20 bg-white border-2 border-emerald-100 rounded-[2rem] shadow-sm">
              <div className="flex flex-col items-center gap-4">
                <div className={cn("p-6 rounded-full", error ? "bg-rose-50" : "bg-emerald-50")}>
                  {error ? <X className="w-12 h-12 text-rose-300" /> : <Search className="w-12 h-12 text-emerald-200" />}
                </div>
                <div>
                  <p className={cn("font-bold uppercase text-xs tracking-[0.2em]", error ? "text-rose-600" : "text-emerald-800/40")}>
                    {error ? 'Erreur de chargement' : 'Aucun rôle trouvé'}
                  </p>
                  {error && (
                    <button
                      onClick={fetchRoles}
                      className="mt-4 px-6 py-2 bg-rose-100 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-200 transition-all active:scale-95"
                    >
                      Réessayer
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            filteredRoles.map((role) => (
              <div
                key={role.id}
                className="bg-white border-2 border-emerald-100 p-6 rounded-2xl relative overflow-hidden group hover:border-emerald-300 transition-all duration-500 shadow-sm flex flex-col"
              >
                {/* Decorative Colorful Glow */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-emerald-500/10 transition-colors" />

                <div className="relative z-10 w-full flex flex-col h-full">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-100 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-500">
                      <Shield className="w-6 h-6" />
                    </div>
                    <Badge variant={role.is_active ? 'success' : 'error'}>
                      {role.is_active ? 'Actif' : 'Inactif'}
                    </Badge>
                  </div>

                  <div className="space-y-2 mb-6 flex-1">
                    <div className="flex items-center gap-2">
                      <code className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest">{role.code}</code>
                      {role.is_system && (
                        <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-800 text-[8px] font-black uppercase rounded tracking-widest">Système</span>
                      )}
                    </div>
                    <h3 className="text-lg font-black text-emerald-950 tracking-tight leading-none uppercase group-hover:text-emerald-600 transition-colors">
                      {role.label}
                    </h3>
                    <p className="text-xs font-bold text-emerald-800/60 line-clamp-2 min-h-[32px]">
                      {role.description || "Aucune description fournie pour ce rôle."}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-emerald-50 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0 duration-500">
                    <button
                      onClick={() => handleEdit(role)}
                      className="flex-1 h-10 rounded-xl bg-emerald-50 text-emerald-600 hover:text-white hover:bg-emerald-600 transition-all font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      Modifier
                    </button>
                    {!role.is_system && (
                      <button
                        onClick={() => {
                          setRoleToDelete(role.id);
                          deleteModal.open();
                        }}
                        className="h-10 w-10 rounded-xl bg-rose-50 text-rose-500 hover:text-white hover:bg-rose-500 transition-all flex items-center justify-center shadow-sm"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Edit/Create Modal */}
      <Modal
        isOpen={editModal.isOpen}
        onClose={editModal.close}
        title={editingRole ? 'Modifier le rôle' : 'Nouveau rôle'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-6 py-2">
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
              <p className="mt-2 text-[10px] font-black text-emerald-800/40 uppercase tracking-widest ml-1">
                Unique, majuscules, underscores (ex: MANAGER_ENTITY)
              </p>
            </div>
          )}
          {editingRole && (
            <div className="p-4 bg-emerald-50/30 border-2 border-emerald-50 rounded-2xl">
              <p className="text-[10px] font-black text-emerald-950/40 uppercase tracking-widest mb-1">Code du rôle (Défini)</p>
              <p className="text-sm font-black text-emerald-950 font-mono">{editingRole.code}</p>
            </div>
          )}

          <Input
            label="Label du rôle *"
            placeholder="Ex: Manager Entité"
            value={formData.label}
            onChange={(e) => setFormData({ ...formData, label: e.target.value })}
            required
          />

          <div>
            <label className="block text-[10px] font-black text-emerald-800/40 uppercase tracking-widest mb-1.5 ml-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
              className="w-full px-4 py-3 bg-white border-2 border-emerald-50 rounded-xl text-sm font-bold text-emerald-950 focus:border-emerald-200 outline-none transition-all placeholder:text-emerald-100"
              placeholder="Description détaillée du rôle et de ses responsabilités..."
            />
          </div>

          <label className="flex items-center gap-3 p-4 bg-emerald-50/30 border-2 border-emerald-50 rounded-2xl cursor-pointer hover:border-emerald-100 transition-all group">
            <div className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              />
              <div className="w-11 h-6 bg-emerald-100 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] font-black text-emerald-900/60 uppercase tracking-widest">Disponibilité</p>
              <p className="text-xs font-bold text-emerald-950">Rôle {formData.is_active ? 'Actif' : 'Inactif'}</p>
            </div>
          </label>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={editModal.close} className="flex-1">
              Annuler
            </Button>
            <Button type="submit" className="flex-1">
              {editingRole ? 'Enregistrer' : 'Créer le rôle'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={deleteModal.close}
        onConfirm={handleDeleteConfirm}
        title="Supprimer le rôle ?"
        message="Êtes-vous sûr de vouloir supprimer définitivement ce rôle ? Les utilisateurs précédemment assignés à ce rôle devront être réalloués."
        variant="danger"
        confirmText="Supprimer"
        cancelText="Annuler"
      />
    </AppLayout>
  );
}

