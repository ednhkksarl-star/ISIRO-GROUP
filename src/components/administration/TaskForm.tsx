'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { useToast } from '@/components/ui/Toast';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Combobox from '@/components/ui/Combobox';
import { useEntity } from '@/hooks/useEntity';
import EntitySelector from '@/components/entity/EntitySelector';
import { normalizeEntityIds, getEntityUUID } from '@/utils/entityHelpers';
import { Upload, X, Image as ImageIcon, FileText, Calendar, Hash, Tag, Type, User as UserIcon } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/utils/cn';

interface User {
    id: string;
    full_name: string | null;
    email: string;
    role: string;
    entity_id?: string | null;
    entity_ids?: string[] | null;
}

interface TaskFormProps {
    initialStatus?: string;
    initialEntityId?: string;
    onSuccess?: () => void;
    onCancel?: () => void;
}

export default function TaskForm({
    initialStatus = 'todo',
    initialEntityId,
    onSuccess,
    onCancel,
}: TaskFormProps) {
    const router = useRouter();
    const { profile } = useAuth();
  const toast = useToast();
    const { selectedEntityId, setSelectedEntityId, isGroupView } = useEntity();
    const supabase = createSupabaseClient();
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [users, setUsers] = useState<User[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
    const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [selectedColor, setSelectedColor] = useState<string>('#64748b');
    const [localEntityId, setLocalEntityId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        priority: 'medium',
        due_date: '',
        assigned_to: '',
    });

    const canSelectEntity = profile?.role === 'SUPER_ADMIN_GROUP' ||
        profile?.role === 'ADMIN_ENTITY' ||
        (profile?.entity_ids && profile.entity_ids.length > 1);

    const colorOptions = [
        { value: '#64748b', label: 'Slate' },
        { value: '#00A896', label: 'Emerald' },
        { value: '#3b82f6', label: 'Blue' },
        { value: '#8b5cf6', label: 'Violet' },
        { value: '#ec4899', label: 'Pink' },
        { value: '#f59e0b', label: 'Amber' },
        { value: '#ef4444', label: 'Rose' },
        { value: '#0ea5e9', label: 'Sky' },
    ];

    const entityId = localEntityId || (isGroupView ? null : selectedEntityId) || profile?.entity_id;

    useEffect(() => {
        if (initialEntityId) {
            setLocalEntityId(initialEntityId);
        } else if (selectedEntityId && !isGroupView) {
            setLocalEntityId(selectedEntityId);
        } else if (profile?.entity_id) {
            setLocalEntityId(profile.entity_id);
        }
    }, [initialEntityId, selectedEntityId, isGroupView, profile?.entity_id]);

    useEffect(() => {
        fetchUsers();
    }, [entityId, profile?.role]);

    const fetchUsers = async () => {
        try {
            setLoadingUsers(true);
            const canViewAll = profile?.role === 'SUPER_ADMIN_GROUP' || profile?.role === 'ADMIN_ENTITY';
            let query = supabase.from('users').select('id, full_name, email, role, entity_id, entity_ids').eq('is_active', true);

            if (!canViewAll) {
                if (entityId) {
                    const uuid = await getEntityUUID(entityId);
                    if (uuid) query = query.eq('entity_id', uuid);
                    else query = query.eq('id', '00000000-0000-0000-0000-000000000000');
                } else if (profile?.entity_id) {
                    const uuid = await getEntityUUID(profile.entity_id);
                    if (uuid) query = query.eq('entity_id', uuid);
                    else query = query.eq('id', '00000000-0000-0000-0000-000000000000');
                }
            }

            const { data, error } = await query.order('full_name', { ascending: true });
            if (error) throw error;
            setUsers((data || []) as User[]);
        } catch (error: any) {
            console.error(error);
            setUsers([]);
        } finally {
            setLoadingUsers(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setAttachmentFile(file);
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => setAttachmentPreview(reader.result as string);
            reader.readAsDataURL(file);
        } else setAttachmentPreview(null);
    };

    const addTag = () => {
        if (tagInput.trim() && !tags.includes(tagInput.trim())) {
            setTags([...tags, tagInput.trim()]);
            setTagInput('');
        }
    };

    const removeTag = (tagToRemove: string) => setTags(tags.filter((tag) => tag !== tagToRemove));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!entityId) {
            toast.error('Veuillez sélectionner une entité');
            return;
        }

        setLoading(true);
        try {
            let attachmentUrl: string | null = null;
            let attachmentName: string | null = null;

            if (attachmentFile) {
                setUploading(true);
                const fileExt = attachmentFile.name.split('.').pop();
                const entityUUID = await getEntityUUID(entityId);
                if (!entityUUID) throw new Error('Entité non trouvée');
                const fileName = `${entityUUID}/${Date.now()}.${fileExt}`;
                const filePath = `task-attachments/${fileName}`;

                const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, attachmentFile);
                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(filePath);
                attachmentUrl = publicUrl;
                attachmentName = attachmentFile.name;
                setUploading(false);
            }

            const entityUUID = await getEntityUUID(entityId);
            if (!entityUUID) throw new Error('Entité non trouvée');

            const { error } = await supabase.from('tasks').insert({
                entity_id: entityUUID,
                title: formData.title,
                description: formData.description || null,
                priority: formData.priority as any,
                due_date: formData.due_date || null,
                assigned_to: formData.assigned_to || null,
                attachment_url: attachmentUrl,
                attachment_name: attachmentName,
                tags: tags.length > 0 ? tags : null,
                color: selectedColor,
                status: initialStatus as any,
                created_by: profile?.id || '',
            } as any);

            if (error) throw error;
            toast.success('Tâche créée avec succès');
            if (onSuccess) onSuccess();
            else router.push('/administration');
        } catch (error: any) {
            toast.error(error.message || 'Erreur lors de la création');
        } finally {
            setLoading(false);
            setUploading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Entity Section */}
            {canSelectEntity && profile && (
                <div className="space-y-3">
                    <label className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest ml-1 flex items-center gap-2">
                        <Hash className="w-3 h-3 text-emerald-400" /> Entité Responsable
                    </label>
                    <EntitySelector
                        selectedEntityId={localEntityId}
                        onSelectEntity={setLocalEntityId}
                        userRole={profile.role}
                        userEntityIds={profile.entity_ids}
                        navigateOnSelect={false}
                    />
                </div>
            )}

            {/* Main Info */}
            <div className="space-y-4">
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest ml-1 flex items-center gap-2">
                            <Type className="w-3 h-3 text-emerald-400" /> Titre de la tâche
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="Ex: Révision du rapport trimestriel"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="w-full h-12 px-5 bg-emerald-50/50 border-2 border-emerald-100 rounded-xl text-sm font-black text-emerald-950 outline-none focus:border-emerald-500 transition-all placeholder:text-emerald-200"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest ml-1 flex items-center gap-2">
                            <FileText className="w-3 h-3 text-emerald-400" /> Description détaillée
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={4}
                            placeholder="Ajoutez des précisions, des instructions..."
                            className="w-full bg-emerald-50/50 border-2 border-emerald-100 rounded-xl px-5 py-4 text-sm font-bold text-emerald-950 outline-none focus:border-emerald-500 transition-all resize-none placeholder:text-emerald-200"
                        />
                    </div>
                </div>
            </div>

            {/* Grid Settings */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest ml-1">Priorité</label>
                    <select
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                        className="w-full h-12 px-5 bg-emerald-50/50 border-2 border-emerald-100 rounded-xl text-sm font-black text-emerald-950 outline-none focus:border-emerald-500 transition-all cursor-pointer appearance-none"
                    >
                        <option value="low">Basse</option>
                        <option value="medium">Moyenne</option>
                        <option value="high">Haute</option>
                    </select>
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest ml-1 flex items-center gap-2">
                        <Calendar className="w-3 h-3 text-emerald-400" /> Échéance
                    </label>
                    <input
                        type="date"
                        value={formData.due_date}
                        onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                        className="w-full h-12 px-5 bg-emerald-50/50 border-2 border-emerald-100 rounded-xl text-sm font-black text-emerald-950 outline-none focus:border-emerald-500 transition-all cursor-pointer"
                    />
                </div>
            </div>

            {/* Assignment */}
            <div className="space-y-1.5">
                <label className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <UserIcon className="w-3 h-3 text-emerald-400" /> Assigner à
                </label>
                <Combobox
                    options={users.map((user) => ({
                        value: user.id,
                        label: `${user.full_name || user.email}`,
                    }))}
                    value={formData.assigned_to}
                    onChange={(value) => setFormData({ ...formData, assigned_to: value })}
                    placeholder={loadingUsers ? 'Chargement...' : 'Sélectionner un membre...'}
                    className="w-full"
                />
            </div>

            {/* Tags */}
            <div className="space-y-3">
                <label className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Tag className="w-3 h-3 text-emerald-400" /> Tags
                </label>
                <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-black uppercase tracking-tighter border border-emerald-200">
                            {tag}
                            <button type="button" onClick={() => removeTag(tag)} className="hover:text-rose-500"><X className="w-3.5 h-3.5" /></button>
                        </span>
                    ))}
                </div>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                        placeholder="Nouveau tag..."
                        className="flex-1 h-12 px-5 bg-emerald-50/50 border-2 border-emerald-100 rounded-xl text-sm font-black text-emerald-950 outline-none focus:border-emerald-500 transition-all placeholder:text-emerald-200"
                    />
                    <button type="button" onClick={addTag} className="px-6 h-12 bg-white border-2 border-emerald-100 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-50 transition-all active:scale-95 shadow-sm">
                        Ajouter
                    </button>
                </div>
            </div>

            {/* Color Picker */}
            <div className="space-y-3">
                <label className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest ml-1">Couleur</label>
                <div className="flex flex-wrap gap-2.5">
                    {colorOptions.map((color) => (
                        <button
                            key={color.value}
                            type="button"
                            onClick={() => setSelectedColor(color.value)}
                            className={cn(
                                "w-9 h-9 rounded-xl border-4 transition-all hover:scale-110 active:scale-95 shadow-sm",
                                selectedColor === color.value ? "border-emerald-500 scale-110 shadow-lg shadow-emerald-200" : "border-white"
                            )}
                            style={{ backgroundColor: color.value }}
                            title={color.label}
                        />
                    ))}
                </div>
            </div>

            {/* Attachment */}
            <div className="space-y-3">
                <label className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Upload className="w-3 h-3 text-emerald-400" /> Pièce jointe (Optionnel)
                </label>
                {!attachmentFile ? (
                    <div>
                        <input type="file" id="task-attachment-manual" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={handleFileChange} className="hidden" />
                        <label htmlFor="task-attachment-manual" className="flex flex-col items-center justify-center gap-3 py-10 border-2 border-dashed border-emerald-100 rounded-[32px] hover:border-emerald-400 hover:bg-emerald-50/50 transition-all cursor-pointer group relative overflow-hidden">
                            <div className="absolute inset-0 bg-emerald-50/10 animate-pulse" />
                            <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform relative z-10">
                                <Upload className="w-6 h-6 text-emerald-600" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800/40 relative z-10">Glisser ou cliquer pour uploader</span>
                        </label>
                    </div>
                ) : (
                    <div className="bg-emerald-50/50 border-2 border-emerald-100 rounded-[32px] p-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12 blur-2xl" />
                        <div className="flex items-center justify-between relative">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-emerald-100 flex items-center justify-center">
                                    {attachmentFile.type.startsWith('image/') ? <ImageIcon className="w-6 h-6 text-emerald-500" /> : <FileText className="w-6 h-6 text-emerald-400" />}
                                </div>
                                <div>
                                    <p className="text-[11px] font-black text-emerald-950 uppercase truncate max-w-[200px]">{attachmentFile.name}</p>
                                    <p className="text-[10px] font-bold text-emerald-800/40">{(attachmentFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                </div>
                            </div>
                            <button type="button" onClick={() => (setAttachmentFile(null), setAttachmentPreview(null))} className="p-3 hover:bg-rose-50 text-rose-500 rounded-2xl transition-all">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="flex gap-4 pt-6">
                <button type="button" onClick={onCancel} className="flex-1 py-4 bg-white border-2 border-emerald-100 text-emerald-800 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-50 transition-all active:scale-95">
                    Annuler
                </button>
                <button
                    type="submit"
                    disabled={loading || uploading}
                    className="flex-[2] py-4 bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 shadow-xl shadow-success/20 border-b-4 border-emerald-700 transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                    {uploading ? 'Upload...' : loading ? 'Création...' : 'Créer la tâche'}
                </button>
            </div>
        </form>
    );
}
