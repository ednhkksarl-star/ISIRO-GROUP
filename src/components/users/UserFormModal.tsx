'use client';

import { useState, useEffect } from 'react';
import { UserPlus, Upload, X, User as UserIcon, Save, Info } from 'lucide-react';
import Image from 'next/image';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { cn } from '@/utils/cn';
import { useToast } from '@/components/ui/Toast';
import { createSupabaseClient } from '@/services/supabaseClient';
import { resizeImageToBase64 } from '@/utils/imageUtils';
import { ROLE_TRANSLATIONS } from '@/utils/roleTranslations';
import type { Database } from '@/types/database.types';

type User = Database['public']['Tables']['users']['Row'];

interface Role {
    id: string;
    code: string;
    label: string;
    is_active: boolean;
}

interface Entity {
    id: string;
    code: string;
    name: string;
}

interface UserFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User | null; // If null, it's a "Create" form. If provided, it's an "Edit" form.
    onSuccess: () => void;
}

export default function UserFormModal({ isOpen, onClose, user, onSuccess }: UserFormModalProps) {
    const supabase = createSupabaseClient();
    const [loading, setLoading] = useState(false);
    const toast = useToast();
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [showEntityModal, setShowEntityModal] = useState(false);
    const [roles, setRoles] = useState<Role[]>([]);
    const [entities, setEntities] = useState<Entity[]>([]);
    const [loadingRoles, setLoadingRoles] = useState(true);
    const [loadingEntities, setLoadingEntities] = useState(true);
    const [roleError, setRoleError] = useState(false);

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        full_name: '',
        role: '',
        entity_id: '',
        entity_ids: [] as string[],
        is_active: true,
    });
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchRoles();
            fetchEntities();

            if (user) {
                // Edit mode
                setFormData({
                    email: user.email,
                    password: '', // Don't show password for edit
                    full_name: user.full_name || '',
                    role: user.role,
                    entity_id: user.entity_id || '',
                    entity_ids: user.entity_ids || [],
                    is_active: user.is_active,
                });
                setAvatarUrl(user.avatar_url);
            } else {
                // Create mode
                setFormData({
                    email: '',
                    password: '',
                    full_name: '',
                    role: '',
                    entity_id: '',
                    entity_ids: [],
                    is_active: true,
                });
                setAvatarUrl(null);
            }
        }
    }, [isOpen, user]);

    const fetchRoles = async () => {
        try {
            setLoadingRoles(true);
            const { data, error } = await (supabase
                .from('roles') as any)
                .select('*')
                .eq('is_active', true)
                .order('label', { ascending: true });

            if (error) throw error;
            const rolesData = (data || []) as Role[];

            if (rolesData.length > 0) {
                setRoles(rolesData);
                if (!formData.role && !user) {
                    setFormData(prev => ({ ...prev, role: rolesData[0].code }));
                }
            } else {
                const staticRoles = Object.entries(ROLE_TRANSLATIONS).map(([code, label]) => ({
                    id: code, code, label, is_active: true
                }));
                setRoles(staticRoles);
                if (!formData.role && !user) {
                    setFormData(prev => ({ ...prev, role: staticRoles[0].code }));
                }
            }
        } catch (error) {
            console.error('Error fetching roles:', error);
            setRoleError(true);
            const staticRoles = Object.entries(ROLE_TRANSLATIONS).map(([code, label]) => ({
                id: code, code, label, is_active: true
            }));
            setRoles(staticRoles);
            toast.error('Impossible de charger les rôles. Utilisation des rôles par défaut.');
        } finally {
            setLoadingRoles(false);
        }
    };

    const fetchEntities = async () => {
        try {
            setLoadingEntities(true);
            const { data, error } = await supabase
                .from('entities')
                .select('id, code, name')
                .order('name', { ascending: true });

            if (error) throw error;
            setEntities((data || []) as Entity[]);
        } catch (error) {
            console.error('Error fetching entities:', error);
            toast.error('Impossible de charger les entités');
        } finally {
            setLoadingEntities(false);
        }
    };

    const handleAvatarUpload = async (file: File) => {
        setUploadingAvatar(true);
        try {
            const base64Image = await resizeImageToBase64(file, 400, 400, 0.8);
            setAvatarUrl(base64Image);
            toast.success('Photo chargée avec succès');
        } catch (error) {
            toast.error('Impossible de charger la photo');
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Session expirée');

            if (user) {
                // UPDATE Existing User
                const { error } = await (supabase.from('users') as any)
                    .update({
                        full_name: formData.full_name || null,
                        role: formData.role,
                        entity_ids: formData.entity_ids.length > 0 ? formData.entity_ids : null,
                        avatar_url: avatarUrl,
                        is_active: formData.is_active,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', user.id);

                if (error) throw error;
                toast.success('Utilisateur mis à jour');
            } else {
                // CREATE New User via API Route (secure way)
                const response = await fetch('/api/users/create', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({
                        email: formData.email,
                        password: formData.password,
                        full_name: formData.full_name || null,
                        role: formData.role,
                        entity_ids: formData.entity_ids.length > 0 ? formData.entity_ids : null,
                        avatar_url: avatarUrl,
                        is_active: formData.is_active,
                    }),
                });

                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Erreur lors de la création');
                }
                toast.success('Utilisateur créé avec succès');
            }

            onSuccess();
            onClose();
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    };

    const toggleEntity = (entityId: string) => {
        setFormData(prev => {
            const ids = prev.entity_ids || [];
            const isSelected = ids.includes(entityId);
            return {
                ...prev,
                entity_ids: isSelected ? ids.filter(id => id !== entityId) : [...ids, entityId]
            };
        });
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={user ? 'Editer l\'utilisateur' : 'Nouvel utilisateur'}
            size="md"
        >
            <form onSubmit={handleSubmit} className="space-y-6 py-2">
                {roleError && (
                    <div className="flex items-center gap-3 p-4 bg-rose-50 border-2 border-rose-100 rounded-2xl">
                        <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                            <Info className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-rose-900/60 uppercase tracking-widest leading-none">Avertissement Système</p>
                            <p className="text-xs font-bold text-rose-950 mt-1">Échec de connexion aux rôles. Utilisation du mode de secours.</p>
                        </div>
                    </div>
                )}

                {/* Photo Section */}
                <div className="flex items-center gap-6 p-4 bg-emerald-50/30 border-2 border-emerald-50 rounded-2xl group">
                    <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-white border-2 border-emerald-100 shadow-sm transition-transform duration-500 group-hover:scale-105">
                        {avatarUrl ? (
                            <Image src={avatarUrl} alt="Avatar" fill className="object-cover" unoptimized />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-emerald-200">
                                <UserIcon className="w-10 h-10" />
                            </div>
                        )}
                        {uploadingAvatar && (
                            <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                                <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        )}
                    </div>
                    <div className="space-y-2">
                        <p className="text-[10px] font-black text-emerald-900/40 uppercase tracking-widest">Photo de profil</p>
                        <div className="flex gap-2">
                            <input
                                type="file"
                                id="modal-avatar-upload"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                icon={<Upload className="w-4 h-4" />}
                                onClick={() => document.getElementById('modal-avatar-upload')?.click()}
                                disabled={uploadingAvatar}
                            >
                                Changer
                            </Button>
                            {avatarUrl && (
                                <button
                                    type="button"
                                    onClick={() => setAvatarUrl(null)}
                                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Form Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {!user && (
                        <>
                            <Input
                                label="Email *"
                                type="email"
                                required
                                value={formData.email}
                                autoComplete="new-email"
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                            <Input
                                label="Mot de passe *"
                                type="password"
                                required
                                value={formData.password}
                                autoComplete="new-password"
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            />
                        </>
                    )}

                    <div className={user ? "sm:col-span-2" : "sm:col-span-2"}>
                        <Input
                            label="Nom complet"
                            value={formData.full_name}
                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-emerald-800/40 uppercase tracking-widest mb-1.5 ml-1">
                            Rôle Système *
                        </label>
                        <select
                            required
                            value={formData.role}
                            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                            className="w-full px-4 py-2.5 bg-white border-2 border-emerald-50 rounded-xl text-sm font-bold text-emerald-950 focus:border-emerald-200 outline-none transition-all"
                        >
                            {loadingRoles ? (
                                <option>Chargement...</option>
                            ) : (
                                roles.map(r => <option key={r.code} value={r.code}>{r.label}</option>)
                            )}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-emerald-800/40 uppercase tracking-widest mb-1.5 ml-1">
                            Accès Entités
                        </label>
                        <button
                            type="button"
                            onClick={() => setShowEntityModal(true)}
                            className="w-full px-4 py-2.5 bg-white border-2 border-emerald-50 rounded-xl text-sm font-bold text-emerald-950 text-left hover:border-emerald-200 transition-all flex justify-between items-center"
                        >
                            <span className="truncate">
                                {formData.entity_ids.length > 0 ? `${formData.entity_ids.length} sélectionnée(s)` : "Tout le groupe"}
                            </span>
                            <Building className="w-4 h-4 text-emerald-300" />
                        </button>
                    </div>
                </div>

                {/* Active Toggle */}
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
                        <p className="text-[10px] font-black text-emerald-900/60 uppercase tracking-widest">Statut du compte</p>
                        <p className="text-xs font-bold text-emerald-950">Compte {formData.is_active ? "Actif" : "Inactif"}</p>
                    </div>
                </label>

                {/* Form Actions */}
                <div className="flex gap-3 pt-2">
                    <Button type="button" variant="secondary" onClick={onClose}>
                        Annuler
                    </Button>
                    <Button type="submit" loading={loading} icon={user ? <Save className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}>
                        {user ? 'Enregistrer' : 'Créer'}
                    </Button>
                </div>
            </form>

            {/* Nested Entity Selection Modal */}
            <Modal
                isOpen={showEntityModal}
                onClose={() => setShowEntityModal(false)}
                title="Accès aux Entités"
                size="sm"
            >
                <div className="space-y-2 py-2 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                    {entities.map((entity) => {
                        const isSelected = formData.entity_ids.includes(entity.id);
                        return (
                            <label
                                key={entity.id}
                                className={cn(
                                    "flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all",
                                    isSelected ? "bg-emerald-50 border-emerald-200" : "bg-white border-emerald-50 hover:border-emerald-100"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all",
                                        isSelected ? "bg-emerald-600 border-emerald-600" : "border-emerald-200"
                                    )}>
                                        {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-emerald-950">{entity.name}</p>
                                        <p className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest">{entity.code}</p>
                                    </div>
                                </div>
                                <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={isSelected}
                                    onChange={() => toggleEntity(entity.id)}
                                />
                            </label>
                        );
                    })}
                </div>
                <div className="pt-4">
                    <Button onClick={() => setShowEntityModal(false)}>Terminer</Button>
                </div>
            </Modal>
        </Modal>
    );
}

// Internal icons needed
function Building({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            xmlns="http://www.w3.org/2000/svg"
            width="24" height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
            <path d="M9 22v-4h6v4" />
            <path d="M8 6h.01" />
            <path d="M16 6h.01" />
            <path d="M12 6h.01" />
            <path d="M12 10h.01" />
            <path d="M12 14h.01" />
            <path d="M16 10h.01" />
            <path d="M16 14h.01" />
            <path d="M8 10h.01" />
            <path d="M8 14h.01" />
        </svg>
    );
}
