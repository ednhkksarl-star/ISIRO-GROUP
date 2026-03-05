'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { useToast } from '@/components/ui/Toast';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { getEntityUUID } from '@/utils/entityHelpers';
import { UserCircle, Truck, Link2, Users, CheckCircle2 } from 'lucide-react';
import { cn } from '@/utils/cn';

type DirectoryType = 'clients' | 'suppliers' | 'partners' | 'collaborators';

interface DirectoryFormProps {
    initialType?: DirectoryType;
    initialEntityId?: string;
    onSuccess?: () => void;
    onCancel?: () => void;
}

const TYPE_CONFIG: Record<DirectoryType, { label: string, icon: any, color: string, bg: string, table: string }> = {
    clients: { label: 'Client', icon: UserCircle, color: 'text-blue-600', bg: 'bg-blue-50', table: 'clients' },
    suppliers: { label: 'Fournisseur', icon: Truck, color: 'text-emerald-600', bg: 'bg-emerald-50', table: 'suppliers' },
    partners: { label: 'Partenaire', icon: Link2, color: 'text-amber-600', bg: 'bg-amber-50', table: 'partners' },
    collaborators: { label: 'Collaborateur', icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50', table: 'collaborators' },
};

export default function DirectoryForm({
    initialType = 'clients',
    initialEntityId,
    onSuccess,
    onCancel
}: DirectoryFormProps) {
    const router = useRouter();
    const { profile } = useAuth();
  const toast = useToast();
    const supabase = createSupabaseClient();
    const [loading, setLoading] = useState(false);
    const [activeType, setActiveType] = useState<DirectoryType>(initialType);

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        address: '',
        notes: '',
        role_position: '', // Uniquement pour collaborateurs
    });

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

            const config = TYPE_CONFIG[activeType];
            const payload: any = {
                entity_id: entityUUID,
                name: formData.name.trim(),
                phone: formData.phone.trim() || null,
                email: formData.email.trim() || null,
                address: formData.address.trim() || null,
                notes: formData.notes.trim() || null,
                is_active: true,
                created_by: profile?.id || null,
            };

            if (activeType === 'collaborators') {
                payload.role_position = formData.role_position.trim() || null;
            }

            const { error } = await supabase.from(config.table).insert(payload);
            if (error) throw error;

            toast.success(`${config.label} créé avec succès !`);
            if (onSuccess) onSuccess();
            else router.push('/repertoire');
        } catch (error: any) {
            toast.error(error.message || 'Erreur lors de l\'enregistrement');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* type Selector */}
            <div className="flex p-1 bg-emerald-50/50 rounded-xl gap-1 border-2 border-emerald-100">
                {(Object.entries(TYPE_CONFIG) as [DirectoryType, any][]).map(([type, cfg]) => (
                    <button
                        key={type}
                        type="button"
                        onClick={() => setActiveType(type)}
                        className={cn(
                            "flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-lg transition-all",
                            activeType === type
                                ? "bg-white border-2 border-emerald-200 text-emerald-700 shadow-sm"
                                : "text-emerald-500/40 hover:bg-white/50 hover:text-emerald-600"
                        )}
                    >
                        <cfg.icon className="w-5 h-5" />
                        <span className="text-[9px] font-black uppercase tracking-widest">{cfg.label}</span>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                    <Input
                        label="Nom complet / Raison sociale *"
                        placeholder="Ex: Jean Dupont ou SARL Exemple"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        className="bg-white border-2 border-emerald-100 h-14 text-lg font-black uppercase tracking-tighter text-emerald-950 rounded-xl focus:border-emerald-400 transition-all shadow-sm"
                    />
                </div>

                {activeType === 'collaborators' && (
                    <div className="md:col-span-2">
                        <Input
                            label="Fonction / Poste"
                            placeholder="Ex: Directeur Technique, Comptable..."
                            value={formData.role_position}
                            onChange={(e) => setFormData({ ...formData, role_position: e.target.value })}
                            className="bg-white border-2 border-emerald-100 text-emerald-950 font-bold rounded-xl focus:border-emerald-400"
                        />
                    </div>
                )}

                <Input
                    label="Téléphone"
                    placeholder="+243..."
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="bg-white border-2 border-emerald-100 text-emerald-950 font-bold rounded-xl focus:border-emerald-400"
                />
                <Input
                    label="Email"
                    type="email"
                    placeholder="contact@exemple.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="bg-white border-2 border-emerald-100 text-emerald-950 font-bold rounded-xl focus:border-emerald-400"
                />

                <div className="md:col-span-2 text-emerald-950">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-emerald-800/40 mb-2 pl-1">Adresse physique</label>
                    <textarea
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        rows={2}
                        placeholder="Rue, Quartier, Ville..."
                        className="w-full p-4 bg-white border-2 border-emerald-100 rounded-xl focus:border-emerald-400 transition-all text-sm font-bold placeholder:text-emerald-200 outline-none shadow-sm"
                    />
                </div>

                <div className="md:col-span-2 text-emerald-950">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-emerald-800/40 mb-2 pl-1">Notes & Observations</label>
                    <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows={3}
                        placeholder="Détails supplémentaires..."
                        className="w-full p-4 bg-white border-2 border-emerald-100 rounded-xl focus:border-emerald-400 transition-all text-sm font-bold placeholder:text-emerald-200 outline-none shadow-sm"
                    />
                </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t-2 border-emerald-100">
                {onCancel && (
                    <Button type="button" variant="secondary" onClick={onCancel} className="h-14 px-8 rounded-xl text-xs font-black uppercase tracking-widest border-2 border-emerald-100 bg-white text-emerald-600 hover:text-emerald-950 hover:bg-emerald-50 border-none transition-colors">
                        Annuler
                    </Button>
                )}
                <Button
                    type="submit"
                    loading={loading}
                    className="h-14 px-10 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 text-xs font-black uppercase tracking-widest transition-all active:scale-95 border-b-4 border-emerald-700"
                    icon={<CheckCircle2 className="w-5 h-5" />}
                >
                    {loading ? 'Création...' : `Enregistrer le ${TYPE_CONFIG[activeType].label}`}
                </Button>
            </div>
        </form>
    );
}
