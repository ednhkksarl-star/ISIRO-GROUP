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
import { getEntityUUID } from '@/utils/entityHelpers';
import { Upload, X, FileText, Image as ImageIcon, Send, Inbox, Mail, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/utils/cn';

interface Entity {
    id: string;
    name: string;
}

interface User {
    id: string;
    full_name: string | null;
    email: string;
}

interface MailFormProps {
    initialType?: 'incoming' | 'outgoing' | 'internal';
    initialEntityId?: string;
    onSuccess?: () => void;
    onCancel?: () => void;
}

export default function MailForm({
    initialType = 'incoming',
    initialEntityId,
    onSuccess,
    onCancel
}: MailFormProps) {
    const router = useRouter();
    const { profile } = useAuth();
  const toast = useToast();
    const supabase = createSupabaseClient();
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [entities, setEntities] = useState<Entity[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
    const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
    const [mailType, setMailType] = useState<'incoming' | 'outgoing' | 'internal'>(initialType);

    const [formData, setFormData] = useState({
        subject: '',
        sender: '',
        recipient: '',
        sender_reference_number: '',
        registration_number: '',
        received_date: initialType === 'incoming' ? new Date().toISOString().split('T')[0] : '',
        sent_date: initialType === 'outgoing' ? new Date().toISOString().split('T')[0] : '',
        oriented_to_entity_id: '',
        oriented_to_user_id: '',
        notes: '',
    });

    useEffect(() => {
        fetchEntities();
    }, []);

    useEffect(() => {
        if (formData.oriented_to_entity_id) {
            fetchUsers(formData.oriented_to_entity_id);
        } else {
            setUsers([]);
        }
    }, [formData.oriented_to_entity_id]);

    const fetchEntities = async () => {
        try {
            const { data, error } = await supabase.rpc('get_all_entities_for_orientation');
            if (error) {
                const { data: fallbackData, error: fallbackError } = await supabase
                    .from('entities')
                    .select('id, name')
                    .order('name', { ascending: true });
                if (fallbackError) throw fallbackError;
                setEntities(fallbackData || []);
                return;
            }
            setEntities(data || []);
        } catch (error) {
            console.error('Erreur chargement entités:', error);
        }
    };

    const fetchUsers = async (entityId: string) => {
        try {
            setLoadingUsers(true);
            const uuid = await getEntityUUID(entityId);
            if (!uuid) return;

            const { data, error } = await (supabase.rpc as any)('get_users_by_entity_for_orientation', {
                p_entity_id: uuid,
            });

            if (error) {
                const { data: fallbackData, error: fallbackError } = await supabase
                    .from('users')
                    .select('id, full_name, email, entity_id, entity_ids')
                    .eq('is_active', true)
                    .order('full_name', { ascending: true });
                if (fallbackError) throw fallbackError;

                const filtered = (fallbackData || []).filter((u: any) =>
                    u.entity_id === uuid || (u.entity_ids && u.entity_ids.includes(uuid))
                );
                setUsers(filtered);
                return;
            }
            setUsers(data || []);
        } catch (error) {
            console.error('Erreur chargement utilisateurs:', error);
        } finally {
            setLoadingUsers(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            toast.error('Fichier trop lourd (max 10MB)');
            return;
        }
        setAttachmentFile(file);
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => setAttachmentPreview(reader.result as string);
            reader.readAsDataURL(file);
        } else {
            setAttachmentPreview(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const entityId = initialEntityId || profile?.entity_id;
        if (!entityId) {
            toast.error('Entité manquante');
            return;
        }

        setLoading(true);
        try {
            const entityUUID = await getEntityUUID(entityId);
            if (!entityUUID) throw new Error('Entité non trouvée');

            let attachmentUrl = null;
            let attachmentName = null;

            if (attachmentFile) {
                setUploading(true);
                const fileExt = attachmentFile.name.split('.').pop();
                const filePath = `mail-attachments/${entityUUID}/${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, attachmentFile);
                if (uploadError) throw uploadError;
                const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(filePath);
                attachmentUrl = publicUrl;
                attachmentName = attachmentFile.name;
                setUploading(false);
            }

            const { data: lastMail } = await supabase
                .from('mail_items')
                .select('mail_number')
                .eq('entity_id', entityUUID)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            let mailNumber = 'MAIL-001';
            if ((lastMail as any)?.mail_number) {
                const match = (lastMail as any).mail_number.match(/(\d+)$/);
                if (match) {
                    mailNumber = `MAIL-${(parseInt(match[1]) + 1).toString().padStart(3, '0')}`;
                }
            }

            const { error } = await supabase.from('mail_items').insert({
                entity_id: entityUUID,
                mail_number: mailNumber,
                mail_type: mailType,
                subject: formData.subject,
                sender: formData.sender || null,
                recipient: formData.recipient || null,
                sender_reference_number: formData.sender_reference_number || null,
                registration_number: formData.registration_number || null,
                received_date: formData.received_date || null,
                sent_date: formData.sent_date || null,
                oriented_to_entity_id: formData.oriented_to_entity_id || null,
                oriented_to_user_id: formData.oriented_to_user_id || null,
                attachment_url: attachmentUrl,
                attachment_name: attachmentName,
                notes: formData.notes || null,
                status: 'registered',
                created_by: profile?.id || '',
            } as any);

            if (error) throw error;

            toast.success('Courrier enregistré !');
            if (onSuccess) onSuccess();
            else router.push('/courriers');
        } catch (error: any) {
            toast.error(error.message || 'Erreur lors de l\'enregistrement');
        } finally {
            setLoading(false);
            setUploading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Type Selection - Harmonized Style */}
            <div className="flex p-1 bg-emerald-50 rounded-2xl gap-1 border-2 border-emerald-100">
                {[
                    { id: 'incoming', label: 'Entrant', icon: Inbox, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { id: 'outgoing', label: 'Sortant', icon: Send, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { id: 'internal', label: 'Interne', icon: Mail, color: 'text-amber-600', bg: 'bg-amber-50' },
                ].map((type) => (
                    <button
                        key={type.id}
                        type="button"
                        onClick={() => setMailType(type.id as any)}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                            mailType === type.id
                                ? cn("bg-white shadow-sm ring-2 ring-emerald-500/20", type.color)
                                : "text-emerald-800/40 hover:bg-white/50"
                        )}
                    >
                        <type.icon className="w-4 h-4" />
                        {type.label}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                    <Input
                        label="Sujet du courrier *"
                        placeholder="Ex: Demande de partenariat..."
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        required
                        className="bg-white border-2 border-emerald-100 h-14 text-lg font-black uppercase tracking-tight text-emerald-950 rounded-xl focus:border-emerald-500"
                    />
                </div>

                {mailType === 'incoming' && (
                    <>
                        <Input
                            label="Expéditeur"
                            placeholder="Nom de l'envoyeur"
                            value={formData.sender}
                            onChange={(e) => setFormData({ ...formData, sender: e.target.value })}
                            className="bg-white border-2 border-emerald-100 rounded-xl font-bold text-emerald-950 focus:border-emerald-500"
                        />
                        <Input
                            label="Date de réception"
                            type="date"
                            value={formData.received_date}
                            onChange={(e) => setFormData({ ...formData, received_date: e.target.value })}
                            className="bg-white border-2 border-emerald-100 rounded-xl font-bold text-emerald-950 focus:border-emerald-500"
                        />
                    </>
                )}

                {mailType === 'outgoing' && (
                    <>
                        <Input
                            label="Destinataire"
                            placeholder="Nom du destinataire"
                            value={formData.recipient}
                            onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
                            className="bg-white border-2 border-emerald-100 rounded-xl font-bold text-emerald-950 focus:border-emerald-500"
                        />
                        <Input
                            label="Date d'envoi"
                            type="date"
                            value={formData.sent_date}
                            onChange={(e) => setFormData({ ...formData, sent_date: e.target.value })}
                            className="bg-white border-2 border-emerald-100 rounded-xl font-bold text-emerald-950 focus:border-emerald-500"
                        />
                    </>
                )}

                <Input
                    label="Référence externe"
                    placeholder="N° Réf Expéditeur"
                    value={formData.sender_reference_number}
                    onChange={(e) => setFormData({ ...formData, sender_reference_number: e.target.value })}
                    className="bg-white border-2 border-emerald-100 rounded-xl font-bold text-emerald-950 focus:border-emerald-500"
                />
                <Input
                    label="N° Enregistrement"
                    placeholder="Ex: AR-2024-001"
                    value={formData.registration_number}
                    onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                    className="bg-white border-2 border-emerald-100 rounded-xl font-bold text-emerald-950 focus:border-emerald-500"
                />
            </div>

            {/* Orientation */}
            <div className="space-y-4 p-6 bg-emerald-50/50 rounded-2xl border-2 border-emerald-100">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-800/40">Orientation & Dispatching</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Combobox
                        label="Entité destinataire"
                        options={entities.map(e => ({ value: e.id, label: e.name }))}
                        value={formData.oriented_to_entity_id}
                        onChange={(val) => setFormData({ ...formData, oriented_to_entity_id: val, oriented_to_user_id: '' })}
                        placeholder="Sélectionner entité..."
                    />
                    {formData.oriented_to_entity_id && (
                        <Combobox
                            label="Agent responsable"
                            options={users.map(u => ({ value: u.id, label: u.full_name || u.email }))}
                            value={formData.oriented_to_user_id}
                            onChange={(val) => setFormData({ ...formData, oriented_to_user_id: val })}
                            placeholder={loadingUsers ? "Chargement..." : "Sélectionner agent..."}
                            disabled={loadingUsers}
                        />
                    )}
                </div>
            </div>

            {/* Attachment */}
            <div className="space-y-4 p-6 bg-white border-2 border-dashed border-emerald-100 rounded-2xl group/upload">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-800/40">Document attaché</h3>
                {!attachmentFile ? (
                    <label className="flex flex-col items-center justify-center py-8 cursor-pointer group">
                        <div className="p-4 bg-emerald-50 rounded-xl group-hover:bg-emerald-100 transition-colors">
                            <Upload className="w-8 h-8 text-emerald-400 group-hover:text-emerald-600 transition-colors" />
                        </div>
                        <span className="mt-3 text-sm font-black text-emerald-950 uppercase tracking-tight">Cliquer pour uploader</span>
                        <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mt-1">PDF, JPG, PNG (Max 10MB)</span>
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} className="hidden" />
                    </label>
                ) : (
                    <div className="flex items-center justify-between p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white rounded-xl shadow-sm border border-emerald-100">
                                {attachmentFile.type.startsWith('image/') ? <ImageIcon className="w-6 h-6 text-blue-500" /> : <FileText className="w-6 h-6 text-emerald-500" />}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-black text-emerald-950 truncate max-w-[200px] uppercase tracking-tighter">{attachmentFile.name}</span>
                                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mt-0.5">{(attachmentFile.size / 1024 / 1024).toFixed(2)} MB</span>
                            </div>
                        </div>
                        <button type="button" onClick={() => { setAttachmentFile(null); setAttachmentPreview(null); }} className="p-2 hover:bg-white text-red-500 rounded-lg transition-colors border border-transparent hover:border-red-100">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                )}
            </div>

            <div className="md:col-span-2">
                <label className="block text-[10px] font-black uppercase tracking-widest text-emerald-800/40 mb-2 ml-1">Notes & Précisions</label>
                <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    placeholder="Ajoutez ici vos commentaires internes..."
                    className="w-full p-4 bg-white border-2 border-emerald-100 rounded-2xl focus:border-emerald-500 transition-all text-sm font-bold text-emerald-950 outline-none placeholder:text-emerald-200"
                />
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t-2 border-emerald-50">
                {onCancel && (
                    <Button type="button" variant="secondary" onClick={onCancel} className="h-14 px-8 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white border-2 border-emerald-100 text-emerald-600 hover:bg-emerald-50">
                        Annuler
                    </Button>
                )}
                <Button
                    type="submit"
                    loading={loading || uploading}
                    className="h-14 px-10 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 text-[10px] font-black uppercase tracking-widest shadow-xl shadow-success/20 border-b-4 border-emerald-700 active:scale-95 transition-all"
                    icon={<CheckCircle2 className="w-5 h-5 stroke-[4]" />}
                >
                    {uploading ? 'Envoi...' : loading ? 'Traitement...' : 'Enregistrer le courrier'}
                </Button>
            </div>
        </form>
    );
}
