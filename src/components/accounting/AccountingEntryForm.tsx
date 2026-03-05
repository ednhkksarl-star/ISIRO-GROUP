'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { useToast } from '@/components/ui/Toast';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { useEntity } from '@/hooks/useEntity';
import { useEntityContext } from '@/hooks/useEntityContext';
import EntitySelector from '@/components/entity/EntitySelector';
import { formatNumber } from '@/utils/formatNumber';
import { Plus, Trash2, Calendar, FileText, Info, Hash, DollarSign, Check, ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/utils/cn';

interface AccountingEntryInput {
    id: string;
    entry_date: string;
    code: string;
    description: string;
    numero_piece: string;
    entrees: number;
    sorties: number;
}

interface AccountingEntryFormProps {
    onSuccess?: () => void;
    onCancel?: () => void;
    initialEntityId?: string | null;
    entryId?: string | null; // For Edit mode
}

export default function AccountingEntryForm({
    onSuccess,
    onCancel,
    initialEntityId,
    entryId = null
}: AccountingEntryFormProps) {
    const router = useRouter();
    const { profile } = useAuth();
    const toast = useToast();
    const supabase = createSupabaseClient();
    const { selectedEntityId: globalSelectedEntityId } = useEntity();
    const { activeEntityId } = useEntityContext();
    const [loading, setLoading] = useState(false);
    const [showValidation, setShowValidation] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);

    // Use provided entity ID, or context, or global selection
    const [localEntityId, setLocalEntityId] = useState<string | null>(initialEntityId || activeEntityId || globalSelectedEntityId || profile?.entity_id || null);

    const canSelectEntity = profile?.role === 'SUPER_ADMIN_GROUP' ||
        profile?.role === 'ADMIN_ENTITY' ||
        (profile?.entity_ids && profile.entity_ids.length > 1);

    const [currency, setCurrency] = useState<'USD' | 'CDF'>('USD');
    const { convertToUSD, rate } = useExchangeRate();

    const [entries, setEntries] = useState<AccountingEntryInput[]>([
        {
            id: Date.now().toString(),
            entry_date: new Date().toISOString().split('T')[0],
            code: '',
            description: '',
            numero_piece: '',
            entrees: 0,
            sorties: 0,
        },
    ]);

    // Fetch data if in edit mode
    useEffect(() => {
        if (entryId) {
            const fetchEntry = async () => {
                setLoading(true);
                try {
                    const { data, error } = await supabase
                        .from('accounting_entries')
                        .select('*')
                        .eq('id', entryId)
                        .single();

                    if (error) throw error;
                    if (data) {
                        const entryData = data as any;
                        setLocalEntityId(entryData.entity_id);
                        setCurrency(entryData.currency as 'USD' | 'CDF');
                        setEntries([{
                            id: entryData.id,
                            entry_date: entryData.entry_date,
                            code: entryData.code || '',
                            description: entryData.description,
                            numero_piece: entryData.numero_piece || '',
                            entrees: entryData.entrees || 0,
                            sorties: entryData.sorties || 0,
                        }]);
                    }
                } catch (err) {
                    toast.error('Erreur lors du chargement de l\'écriture');
                    onCancel?.();
                } finally {
                    setLoading(false);
                }
            };
            fetchEntry();
        }
    }, [entryId, supabase, onCancel, toast]);

    const addEntry = () => {
        if (entryId) return; // Cannot add multiple entries in edit mode
        setEntries([
            ...entries,
            {
                id: (Date.now() + entries.length).toString(),
                entry_date: entries[entries.length - 1]?.entry_date || new Date().toISOString().split('T')[0],
                code: '',
                description: '',
                numero_piece: '',
                entrees: 0,
                sorties: 0,
            },
        ]);
        setShowValidation(false);
    };

    const removeEntry = (id: string) => {
        if (entries.length > 1) {
            setEntries(entries.filter((entry) => entry.id !== id));
        }
    };

    const updateEntry = (id: string, field: keyof AccountingEntryInput, value: any) => {
        setEntries(
            entries.map((entry) => {
                if (entry.id === id) {
                    const updated = { ...entry, [field]: value };
                    if (field === 'entrees' && value > 0) {
                        updated.sorties = 0;
                    } else if (field === 'sorties' && value > 0) {
                        updated.entrees = 0;
                    }
                    return updated;
                }
                return entry;
            })
        );
    };

    const handleSubmit = async () => {
        setShowValidation(true);

        if (!localEntityId) {
            toast.error('Veuillez sélectionner une entité');
            return;
        }

        const invalidEntries = entries.filter(
            (entry) => !entry.description.trim() || (entry.entrees <= 0 && entry.sorties <= 0)
        );

        if (invalidEntries.length > 0) {
            toast.error('Toutes les écritures doivent avoir un libellé et un montant');
            return;
        }

        setLoading(true);
        try {
            if (entryId) {
                // Update mode
                const entry = entries[0];
                const entreesUSD = currency === 'USD' ? entry.entrees : convertToUSD(entry.entrees);
                const sortiesUSD = currency === 'USD' ? entry.sorties : convertToUSD(entry.sorties);

                const { error } = await (supabase
                    .from('accounting_entries')
                    .update as any)({
                        entity_id: localEntityId,
                        entry_date: entry.entry_date,
                        code: entry.code || null,
                        description: entry.description,
                        numero_piece: entry.numero_piece || null,
                        entrees: entreesUSD,
                        sorties: sortiesUSD,
                        debit: entreesUSD,
                        credit: sortiesUSD,
                        currency: currency,
                    } as any)
                    .eq('id', entryId);

                if (error) throw error;
                toast.success('Écriture mise à jour');
            } else {
                // Bulk Insert mode
                // Get current balance
                const { data: lastEntry } = await supabase
                    .from('accounting_entries')
                    .select('balance')
                    .eq('entity_id', localEntityId)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                let currentBalance = (lastEntry as { balance: number } | null)?.balance || 0;

                // Get count for entry numbers
                const year = new Date(entries[0].entry_date).getFullYear();
                const { count } = await supabase
                    .from('accounting_entries')
                    .select('*', { count: 'exact', head: true })
                    .eq('entity_id', localEntityId)
                    .gte('entry_date', `${year}-01-01`)
                    .lte('entry_date', `${year}-12-31`);

                const baseEntryNumber = (count || 0) + 1;

                const entriesToInsert = entries.map((entry, index) => {
                    const entreesUSD = currency === 'USD' ? entry.entrees : convertToUSD(entry.entrees);
                    const sortiesUSD = currency === 'USD' ? entry.sorties : convertToUSD(entry.sorties);

                    currentBalance = currentBalance + entreesUSD - sortiesUSD;
                    const entryNumber = `EC-${year}-${String(baseEntryNumber + index).padStart(4, '0')}`;

                    return {
                        entity_id: localEntityId,
                        entry_number: entryNumber,
                        entry_date: entry.entry_date,
                        code: entry.code || null,
                        description: entry.description,
                        numero_piece: entry.numero_piece || null,
                        entrees: entreesUSD,
                        sorties: sortiesUSD,
                        balance: currentBalance,
                        currency: currency,
                        debit: entreesUSD,
                        credit: sortiesUSD,
                        created_by: profile?.id || '',
                    };
                });

                const { error } = await (supabase
                    .from('accounting_entries')
                    .insert as any)(entriesToInsert);

                if (error) throw error;
                toast.success(`${entries.length} écriture(s) créée(s)`);
            }

            if (onSuccess) onSuccess();
            else router.push('/accounting');
        } catch (error: any) {
            toast.error(error.message || 'Erreur lors de l\'enregistrement');
        } finally {
            setLoading(false);
        }
    };

    const nextStep = () => {
        if (currentStep === 1 && !localEntityId) return toast.warning('Entité requise');
        setCurrentStep(prev => prev + 1);
    };

    return (
        <div className="flex flex-col h-full">
            {/* Steps Progress */}
            <div className="flex justify-between items-center mb-10 px-1 relative">
                {[
                    { id: 1, name: 'Configuration', icon: Info },
                    { id: 2, name: 'Écritures', icon: Hash },
                    { id: 3, name: 'Finalisation', icon: Check },
                ].map((step, idx, arr) => {
                    const Icon = step.icon;
                    const isActive = currentStep === step.id;
                    const isCompleted = currentStep > step.id;

                    return (
                        <div key={step.id} className="flex flex-col items-center flex-1 relative">
                            <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 z-10 border-2",
                                isActive ? "bg-emerald-500 text-white border-emerald-600 shadow-lg shadow-emerald-500/20 scale-110" :
                                    isCompleted ? "bg-success text-white border-success" :
                                        "bg-white text-emerald-200 border-emerald-100"
                            )}>
                                {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5 relative -top-[1px]" />}
                            </div>
                            <span className={cn(
                                "text-[9px] font-black uppercase tracking-widest mt-3 transition-all duration-300",
                                isActive ? "text-emerald-950 opacity-100" : "text-emerald-600/40 opacity-60"
                            )}>{step.name}</span>

                            {idx < arr.length - 1 && (
                                <div className={cn(
                                    "absolute h-1 w-full top-5 left-1/2 -z-0 transition-all duration-1000",
                                    isCompleted ? "bg-success" : "bg-emerald-100"
                                )} />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Step 1: Configuration */}
            {currentStep === 1 && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                    <div className="bg-emerald-50/50 border-2 border-emerald-100 rounded-xl p-6 space-y-6 shadow-sm">
                        {canSelectEntity && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest ml-1 flex items-center gap-2">
                                    <Info className="w-3 h-3" /> Entité Responsable
                                </label>
                                <div className="p-1 bg-white border-2 border-emerald-100 rounded-xl">
                                    <EntitySelector
                                        selectedEntityId={localEntityId}
                                        onSelectEntity={setLocalEntityId}
                                        userRole={profile?.role || ''}
                                        userEntityIds={profile?.entity_ids || null}
                                        className="w-full border-none shadow-none"
                                        placement="top"
                                    />
                                </div>
                            </div>
                        )}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest ml-1 flex items-center gap-2">
                                <DollarSign className="w-3 h-3" /> Devise Globale de Saisie
                            </label>
                            <div className="flex bg-white border-2 border-emerald-100 p-1 rounded-xl gap-1">
                                <button
                                    type="button"
                                    onClick={() => setCurrency('USD')}
                                    className={cn(
                                        "flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                        currency === 'USD' ? "bg-emerald-500 text-white shadow-sm" : "text-emerald-400 hover:bg-emerald-50"
                                    )}
                                >USD (Dollar)</button>
                                <button
                                    type="button"
                                    onClick={() => setCurrency('CDF')}
                                    className={cn(
                                        "flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                        currency === 'CDF' ? "bg-emerald-500 text-white shadow-sm" : "text-emerald-400 hover:bg-emerald-50"
                                    )}
                                >CDF (Franc)</button>
                            </div>
                        </div>
                        {currency === 'CDF' && rate && (
                            <div className="flex items-center gap-3 px-4 py-3 bg-emerald-100/50 rounded-xl border border-emerald-200">
                                <Info className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                                <p className="text-[10px] font-black text-emerald-950 uppercase tracking-tight">
                                    Taux actuel: <span className="text-emerald-600">1 USD = {rate.toLocaleString()} CDF</span>. Tous les montants seront convertis pour le livre.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Step 2: Entries */}
            {currentStep === 2 && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest">Écritures à enregistrer ({entries.length})</h3>
                        {!entryId && (
                            <button
                                type="button"
                                onClick={addEntry}
                                className="bg-emerald-950 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-emerald-950/20"
                            >
                                <Plus className="w-3.5 h-3.5" /> Nouvelle Ligne
                            </button>
                        )}
                    </div>

                    <div className="max-h-[380px] overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                        {entries.map((entry, index) => (
                            <div key={entry.id} className="bg-white border-2 border-emerald-100 rounded-xl p-5 relative group hover:border-emerald-300 transition-all shadow-sm">
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                                    {/* Date & Code */}
                                    <div className="md:col-span-3 space-y-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[8px] font-black text-emerald-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                                                <Calendar className="w-2.5 h-2.5" /> Date d&apos;Opération
                                            </label>
                                            <input
                                                type="date"
                                                value={entry.entry_date}
                                                onChange={(e) => updateEntry(entry.id, 'entry_date', e.target.value)}
                                                className="w-full bg-emerald-50/30 border-2 border-emerald-100 rounded-lg px-3 py-2 text-[11px] font-black uppercase text-emerald-950 outline-none focus:border-emerald-400 transition-all"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[8px] font-black text-emerald-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                                                <Hash className="w-2.5 h-2.5" /> Code Comptable
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Ex: 701"
                                                value={entry.code}
                                                onChange={(e) => updateEntry(entry.id, 'code', e.target.value)}
                                                className="w-full bg-emerald-50/30 border-2 border-emerald-100 rounded-lg px-3 py-2 text-[11px] font-black uppercase text-emerald-950 outline-none focus:border-emerald-400 transition-all placeholder:text-emerald-100"
                                            />
                                        </div>
                                    </div>

                                    {/* Description & Piece */}
                                    <div className="md:col-span-5 space-y-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[8px] font-black text-emerald-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                                                <FileText className="w-2.5 h-2.5" /> Libellé détaillé
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="Désignation de l'écriture..."
                                                value={entry.description}
                                                onChange={(e) => updateEntry(entry.id, 'description', e.target.value)}
                                                className={cn(
                                                    "w-full bg-emerald-50/50 border-2 rounded-lg px-4 py-2 text-[11px] font-black uppercase text-emerald-950 outline-none transition-all",
                                                    showValidation && !entry.description.trim() ? "border-error bg-error/5" : "border-emerald-100 focus:border-emerald-400"
                                                )}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[8px] font-black text-emerald-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                                                <Hash className="w-2.5 h-2.5" /> Pièce justificative
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="N° Facture, Chèque, etc."
                                                value={entry.numero_piece}
                                                onChange={(e) => updateEntry(entry.id, 'numero_piece', e.target.value)}
                                                className="w-full bg-emerald-50/30 border-2 border-emerald-100 rounded-lg px-4 py-2 text-[11px] font-black uppercase text-emerald-950 outline-none focus:border-emerald-400 transition-all placeholder:text-emerald-100"
                                            />
                                        </div>
                                    </div>

                                    {/* Amounts */}
                                    <div className="md:col-span-4 space-y-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[8px] font-black text-success uppercase tracking-widest ml-1">Entrée (Recette)</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    placeholder="0.00"
                                                    value={entry.entrees || ''}
                                                    onChange={(e) => updateEntry(entry.id, 'entrees', parseFloat(e.target.value) || 0)}
                                                    className={cn(
                                                        "w-full bg-success/5 border-2 rounded-lg px-4 py-2 text-sm font-black text-success outline-none transition-all text-right pr-10",
                                                        showValidation && entry.entrees <= 0 && entry.sorties <= 0 ? "border-error ring-2 ring-error/10" : "border-success/10 focus:border-success"
                                                    )}
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-success/40">{currency}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[8px] font-black text-error uppercase tracking-widest ml-1">Sortie (Dépense)</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    placeholder="0.00"
                                                    value={entry.sorties || ''}
                                                    onChange={(e) => updateEntry(entry.id, 'sorties', parseFloat(e.target.value) || 0)}
                                                    className={cn(
                                                        "w-full bg-error/5 border-2 rounded-lg px-4 py-2 text-sm font-black text-error outline-none transition-all text-right pr-10",
                                                        showValidation && entry.entrees <= 0 && entry.sorties <= 0 ? "border-error ring-2 ring-error/10" : "border-error/10 focus:border-error"
                                                    )}
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-error/40">{currency}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Remove Button */}
                                {!entryId && entries.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeEntry(entry.id)}
                                        className="absolute -top-3 -right-3 w-8 h-8 bg-white border-2 border-red-100 rounded-xl flex items-center justify-center text-red-200 hover:text-red-500 hover:border-red-500 shadow-lg lg:opacity-0 group-hover:opacity-100 transition-all active:scale-95"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Step 3: Summary */}
            {currentStep === 3 && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                    <div className="bg-emerald-950 rounded-[2rem] p-8 text-white shadow-xl shadow-emerald-950/20 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-success/10 rounded-full -mr-24 -mt-24 blur-3xl group-hover:bg-success/20 transition-all duration-1000" />
                        <div className="relative z-10 space-y-6">
                            <div className="flex justify-between items-center border-b border-white/10 pb-4">
                                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em]">Résumé de l&apos;opération</p>
                                <span className="text-[10px] font-black bg-white/10 px-3 py-1 rounded-full">{entries.length} ligne(s)</span>
                            </div>
                            <div className="grid grid-cols-2 gap-8">
                                <div>
                                    <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">Total Entrées</p>
                                    <p className="text-2xl font-black text-success tabular-nums">+{formatNumber(entries.reduce((sum, e) => sum + e.entrees, 0))} <span className="text-sm">{currency}</span></p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">Total Sorties</p>
                                    <p className="text-2xl font-black text-error tabular-nums">-{formatNumber(entries.reduce((sum, e) => sum + e.sorties, 0))} <span className="text-sm">{currency}</span></p>
                                </div>
                            </div>
                            <div className="pt-4 border-t border-white/10 flex justify-between items-end">
                                <div>
                                    <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">Impact sur le Solde</p>
                                    <p className="text-3xl font-black text-white tabular-nums tracking-tighter">
                                        {entries.reduce((sum, e) => sum + e.entrees - e.sorties, 0) >= 0 ? '+' : ''}
                                        {formatNumber(entries.reduce((sum, e) => sum + e.entrees - e.sorties, 0))}
                                        <span className="text-lg ml-2 font-black text-emerald-500">{currency}</span>
                                    </p>
                                </div>
                                <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex items-center gap-3">
                                    <Info className="w-5 h-5 text-emerald-400" />
                                    <p className="text-[9px] font-black text-white/40 uppercase tracking-wide leading-tight max-w-[120px]">Validation automatique du livre de caisse après soumission.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Navigation Footer */}
            <div className="flex items-center justify-between mt-10 pt-6 border-t-2 border-emerald-50 bg-white">
                <button
                    type="button"
                    onClick={currentStep === 1 ? onCancel : () => setCurrentStep(prev => prev - 1)}
                    className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-emerald-600/60 hover:text-emerald-600 hover:bg-emerald-50 transition-all flex items-center gap-2"
                >
                    {currentStep === 1 ? 'Annuler' : <><ChevronLeft className="w-4 h-4" /> Retour</>}
                </button>

                <button
                    onClick={currentStep === 3 ? handleSubmit : nextStep}
                    disabled={loading || !localEntityId}
                    className="h-14 px-10 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-success/20 flex items-center gap-3 border-b-4 border-emerald-700 disabled:opacity-50 disabled:scale-100"
                >
                    {loading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : currentStep === 3 ? (
                        <>
                            <Check className="w-4 h-4 stroke-[3]" />
                            {entryId ? 'Mettre à jour' : `Enregistrer ${entries.length} écriture${entries.length > 1 ? 's' : ''}`}
                        </>
                    ) : (
                        <>Suivant <ChevronRight className="w-4 h-4" /></>
                    )}
                </button>
            </div>
        </div>
    );
}
