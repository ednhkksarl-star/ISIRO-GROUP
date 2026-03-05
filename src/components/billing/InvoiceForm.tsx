'use client';

import { useState, useMemo } from 'react';
import { Plus, Trash2, X, ChevronRight, ChevronLeft, Check, Info, FileText, User, Settings, Package } from 'lucide-react';
import { createSupabaseClient } from '@/services/supabaseClient';
import { useAuth } from '@/components/providers/Providers';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { useEntity } from '@/hooks/useEntity';
import { formatNumber } from '@/utils/formatNumber';
import { useToast } from '@/components/ui/Toast';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { cn } from '@/utils/cn';
import EntitySelector from '@/components/entity/EntitySelector';

interface InvoiceItem {
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
}

interface AdditionalTax {
    name: string;
    rate: number;
}

interface InvoiceFormProps {
    onSuccess?: (invoiceId: string) => void;
    onCancel?: () => void;
}

const STEPS = [
    { id: 1, name: 'Client', icon: User },
    { id: 2, name: 'Config', icon: Settings },
    { id: 3, name: 'Articles', icon: Package },
    { id: 4, name: 'Finaliser', icon: FileText },
];

export default function InvoiceForm({ onSuccess, onCancel }: InvoiceFormProps) {
    const { profile } = useAuth();
  const toast = useToast();
    const supabase = createSupabaseClient();
    const { selectedEntityId, setSelectedEntityId } = useEntity();
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const { rate, convertToUSD } = useExchangeRate();

    const canSelectEntity = profile?.role === 'SUPER_ADMIN_GROUP' ||
        profile?.role === 'ADMIN_ENTITY' ||
        (profile?.entity_ids && profile.entity_ids.length > 1);

    const [formData, setFormData] = useState({
        client_name: '',
        client_phone: '',
        client_address: '',
        issue_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: '',
        reference_type: '',
    });

    const [items, setItems] = useState<InvoiceItem[]>([
        { description: '', quantity: 1, unit_price: 0, total: 0 },
    ]);
    const [currency, setCurrency] = useState<'USD' | 'CDF'>('USD');
    const [additionalTaxes, setAdditionalTaxes] = useState<AdditionalTax[]>([]);
    const [newTaxName, setNewTaxName] = useState('');
    const [newTaxRate, setNewTaxRate] = useState(0);

    const subtotal = items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
    const vatAmount = (subtotal * 16) / 100;
    const additionalTaxesAmount = additionalTaxes.reduce((sum, tax) => sum + (subtotal * tax.rate) / 100, 0);
    const total = subtotal + vatAmount + additionalTaxesAmount;

    const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        if (field === 'quantity' || field === 'unit_price') {
            newItems[index].total = (Number(newItems[index].quantity) || 0) * (Number(newItems[index].unit_price) || 0);
        }
        setItems(newItems);
    };

    const addItem = () => setItems([...items, { description: '', quantity: 1, unit_price: 0, total: 0 }]);
    const removeItem = (index: number) => items.length > 1 && setItems(items.filter((_, i) => i !== index));

    const addTax = () => {
        if (newTaxName && newTaxRate > 0) {
            setAdditionalTaxes([...additionalTaxes, { name: newTaxName, rate: newTaxRate }]);
            setNewTaxName('');
            setNewTaxRate(0);
        }
    };

    const removeTax = (index: number) => setAdditionalTaxes(additionalTaxes.filter((_, i) => i !== index));

    const nextStep = () => {
        if (currentStep === 1 && !formData.client_name) return toast.warning('Le nom du client est requis');
        if (currentStep === 3 && items.some(i => !i.description && i.total > 0)) return toast.warning('Veuillez remplir les descriptions');
        setCurrentStep(prev => Math.min(prev + 1, 4));
    };

    const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

    const handleSubmit = async () => {
        if (!selectedEntityId && !profile?.entity_id) return toast.error('Veuillez sélectionner une entité');

        setLoading(true);
        try {
            const targetId = selectedEntityId || profile?.entity_id;
            const { data: invoiceNumberData, error: numberError } = await (supabase.rpc as any)(
                'generate_invoice_number',
                { p_entity_id: targetId }
            );
            if (numberError) throw numberError;

            const subtotalUSD = currency === 'USD' ? subtotal : convertToUSD(subtotal);
            const vatAmountUSD = currency === 'USD' ? vatAmount : convertToUSD(vatAmount);
            const totalUSD = currency === 'USD' ? total : convertToUSD(total);

            const { data: invoice, error: invoiceError } = await supabase
                .from('invoices')
                .insert({
                    entity_id: targetId,
                    invoice_number: invoiceNumberData,
                    client_name: formData.client_name,
                    client_phone: formData.client_phone || null,
                    client_address: formData.client_address || null,
                    issue_date: formData.issue_date,
                    due_date: formData.due_date,
                    status: 'draft',
                    subtotal: subtotalUSD,
                    tax_rate: 16,
                    tax_amount: vatAmountUSD,
                    additional_taxes: additionalTaxes.length > 0 ? additionalTaxes : null,
                    total: totalUSD,
                    currency: currency,
                    reference_type: formData.reference_type || null,
                    reference_id: `REF-${Date.now()}`,
                    notes: formData.notes || null,
                    created_by: profile?.id || '',
                } as any)
                .select()
                .single();

            if (invoiceError) throw invoiceError;

            const invoiceData = invoice as any;
            if (items.some(i => i.description)) {
                const { error: itemsError } = await supabase
                    .from('invoice_items')
                    .insert(items.filter(i => i.description).map(item => ({
                        invoice_id: invoiceData.id,
                        description: item.description,
                        quantity: item.quantity,
                        unit_price: currency === 'CDF' ? convertToUSD(item.unit_price) : item.unit_price,
                        total: currency === 'CDF' ? convertToUSD(item.total) : item.total,
                    })) as any);
                if (itemsError) throw itemsError;
            }

            toast.success('Facture créée avec succès');
            onSuccess?.(invoiceData.id);
        } catch (error: any) {
            toast.error(error.message || 'Erreur lors de la création');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Progress Header - more compact */}
            <div className="flex justify-between items-center mb-10 px-1 relative">
                {STEPS.map((step, idx) => {
                    const Icon = step.icon;
                    const isActive = currentStep === step.id;
                    const isCompleted = currentStep > step.id;

                    return (
                        <div key={step.id} className="flex flex-col items-center flex-1 relative">
                            <div className={cn(
                                "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 z-10 border-2",
                                isActive ? "bg-emerald-500 text-white border-emerald-600 shadow-xl shadow-emerald-500/20 scale-110" :
                                    isCompleted ? "bg-success text-white border-success shadow-lg shadow-success/20" :
                                        "bg-white text-emerald-200 border-emerald-100"
                            )}>
                                {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                            </div>
                            <span className={cn(
                                "text-[10px] font-black uppercase tracking-widest mt-3 transition-all duration-300",
                                isActive ? "text-emerald-950 opacity-100" : "text-emerald-600/40 opacity-60"
                            )}>{step.name}</span>

                            {idx < STEPS.length - 1 && (
                                <div className={cn(
                                    "absolute h-1 w-full top-6 left-1/2 -z-0 transition-all duration-1000",
                                    isCompleted ? "bg-success" : "bg-emerald-100"
                                )} />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Form Content - removed min-height */}
            <div className="flex-1">
                {currentStep === 1 && (
                    <div className="space-y-6 animate-in slide-in-from-right-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Input
                                label="Nom du Client *"
                                required
                                value={formData.client_name}
                                onChange={e => setFormData({ ...formData, client_name: e.target.value })}
                                placeholder="Ex: Entrepôt Central..."
                                className="bg-white border-2 border-emerald-100 h-14 text-sm font-black uppercase tracking-tighter text-emerald-950 rounded-xl focus:border-emerald-400 transition-all shadow-sm"
                            />
                            <Input
                                label="Téléphone"
                                value={formData.client_phone}
                                onChange={e => setFormData({ ...formData, client_phone: e.target.value })}
                                placeholder="+243..."
                                className="bg-white border-2 border-emerald-100 h-14 text-sm font-black uppercase tracking-tighter text-emerald-950 rounded-xl focus:border-emerald-400 transition-all shadow-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-emerald-800/40 uppercase tracking-widest mb-1.5 ml-1">Adresse Complète</label>
                            <textarea
                                value={formData.client_address}
                                onChange={e => setFormData({ ...formData, client_address: e.target.value })}
                                rows={3}
                                placeholder="Adresse du client pour la facturation..."
                                className="w-full p-4 bg-white border-2 border-emerald-100 rounded-xl focus:border-emerald-400 transition-all text-sm font-bold placeholder:text-emerald-200 outline-none shadow-sm resize-none"
                            />
                        </div>
                        {canSelectEntity && profile && (
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-emerald-800/40 uppercase tracking-widest ml-1">Entité Emettrice</label>
                                <div className="p-1 bg-emerald-50/50 border-2 border-emerald-100 rounded-xl">
                                    <EntitySelector
                                        selectedEntityId={selectedEntityId}
                                        onSelectEntity={setSelectedEntityId}
                                        userRole={profile.role}
                                        userEntityIds={profile.entity_ids}
                                        className="w-full border-none shadow-none"
                                        placement="top"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {currentStep === 2 && (
                    <div className="space-y-6 animate-in slide-in-from-right-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <label className="block text-[10px] font-black text-emerald-800/40 uppercase tracking-widest ml-1">Dates Facturation</label>
                                <div className="bg-emerald-50/50 p-4 rounded-xl border-2 border-emerald-100 space-y-4 shadow-sm">
                                    <Input
                                        type="date"
                                        label="Date d'émission"
                                        value={formData.issue_date}
                                        onChange={e => setFormData({ ...formData, issue_date: e.target.value })}
                                        className="bg-white border-2 border-emerald-100 h-12 text-xs font-black rounded-xl"
                                    />
                                    <Input
                                        type="date"
                                        label="Date d'échéance"
                                        value={formData.due_date}
                                        onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                                        className="bg-white border-2 border-emerald-100 h-12 text-xs font-black rounded-xl"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="block text-[10px] font-black text-emerald-800/40 uppercase tracking-widest ml-1">Devise & Taux</label>
                                <div className="bg-emerald-50/50 p-4 rounded-xl border-2 border-emerald-100 space-y-4 shadow-sm">
                                    <div className="flex p-1 bg-white rounded-xl border-2 border-emerald-100 gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setCurrency('USD')}
                                            className={cn(
                                                "flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                                currency === 'USD' ? "bg-emerald-500 text-white shadow-sm" : "text-emerald-400 hover:bg-emerald-50"
                                            )}
                                        >USD</button>
                                        <button
                                            type="button"
                                            onClick={() => setCurrency('CDF')}
                                            className={cn(
                                                "flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                                currency === 'CDF' ? "bg-emerald-500 text-white shadow-sm" : "text-emerald-400 hover:bg-emerald-50"
                                            )}
                                        >CDF</button>
                                    </div>
                                    {currency === 'CDF' && rate && (
                                        <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border-2 border-emerald-100 shadow-sm">
                                            <Info className="w-5 h-5 text-emerald-500" />
                                            <p className="text-[10px] font-black text-emerald-950 uppercase tracking-tighter">1 USD = {formatNumber(rate)} CDF</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {currentStep === 3 && (
                    <div className="space-y-4 animate-in slide-in-from-right-4">
                        <div className="flex items-center justify-between px-1">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Détails des articles</h3>
                            <button
                                type="button"
                                onClick={addItem}
                                className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-all"
                            >
                                <Plus className="w-3 h-3" /> Ajouter
                            </button>
                        </div>

                        <div className="max-h-[350px] overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                            {items.map((item, idx) => (
                                <div key={idx} className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 flex gap-4 items-start group hover:border-slate-300 transition-all">
                                    <div className="flex-1 space-y-3">
                                        <input
                                            placeholder="Désignation de l'article ou service"
                                            value={item.description}
                                            onChange={e => updateItem(idx, 'description', e.target.value)}
                                            className="w-full bg-transparent border-none p-0 text-sm font-black focus:ring-0 placeholder:text-slate-300"
                                        />
                                        <div className="flex gap-6 items-center">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Quantité</span>
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={e => updateItem(idx, 'quantity', e.target.value)}
                                                    className="w-20 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-black shadow-sm"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Prix Unit.</span>
                                                <input
                                                    type="number"
                                                    value={item.unit_price}
                                                    onChange={e => updateItem(idx, 'unit_price', e.target.value)}
                                                    className="w-28 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-black shadow-sm"
                                                />
                                            </div>
                                            <div className="ml-auto flex flex-col items-end gap-1">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Total</span>
                                                <span className="text-sm font-black text-slate-900">{formatNumber(item.total)} {currency}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeItem(idx)}
                                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {currentStep === 4 && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 transition-all duration-500">
                        {/* Summary & Totals */}
                        <div className="bg-emerald-950 rounded-[2rem] p-8 text-white shadow-xl shadow-emerald-950/20 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-success/10 rounded-full -mr-24 -mt-24 blur-3xl group-hover:bg-success/20 transition-all duration-1000" />
                            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -ml-16 -mb-16 blur-2xl" />

                            <div className="relative z-10 flex flex-col md:flex-row justify-between items-end md:items-center gap-6">
                                <div>
                                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] mb-2 opacity-80">Montant Total à Décaisser</p>
                                    <div className="flex items-baseline gap-3">
                                        <h2 className="text-5xl font-black tracking-tighter tabular-nums text-success">{formatNumber(total)}</h2>
                                        <span className="text-xl font-black text-emerald-400 uppercase tracking-widest">{currency}</span>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2 text-right">
                                    <div className="flex items-center gap-8 px-6 py-4 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10">
                                        <div>
                                            <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-1">Sous-Total (HT)</p>
                                            <p className="text-sm font-black tabular-nums">{formatNumber(subtotal)} {currency}</p>
                                        </div>
                                        <div className="w-px h-8 bg-white/10" />
                                        <div>
                                            <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-1">TVA (16%)</p>
                                            <p className="text-sm font-black tabular-nums text-success">+{formatNumber(vatAmount)} {currency}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Additional Configuration Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                            {/* Left Column: Refs & Taxes */}
                            <div className="space-y-6">
                                <section className="space-y-3">
                                    <h4 className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest px-1">1. Références</h4>
                                    <div className="bg-emerald-50/50 p-4 rounded-xl border-2 border-emerald-100 space-y-4 shadow-sm">
                                        <Input
                                            label="Type de Référence"
                                            value={formData.reference_type}
                                            onChange={e => setFormData({ ...formData, reference_type: e.target.value })}
                                            placeholder="Ex: Bon de commande..."
                                            className="bg-white border-2 border-emerald-100 h-10 text-xs font-black rounded-lg"
                                        />
                                        <div className="flex flex-col gap-1 px-4 py-2 bg-white rounded-lg border-2 border-emerald-100 border-dashed">
                                            <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">ID Référence</span>
                                            <span className="text-[10px] font-black text-emerald-800/40 uppercase tracking-tight italic">Auto-généré à la validation</span>
                                        </div>
                                    </div>
                                </section>

                                <section className="space-y-3">
                                    <div className="flex justify-between items-center px-1">
                                        <h4 className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest">2. Taxes additionnelles</h4>
                                        <span className="text-[9px] font-black text-emerald-500 bg-emerald-50 border border-emerald-100 px-3 py-0.5 rounded-full">{additionalTaxes.length} active(s)</span>
                                    </div>

                                    <div className="space-y-2">
                                        {additionalTaxes.map((tax, idx) => (
                                            <div key={idx} className="flex items-center justify-between px-4 py-2.5 bg-white rounded-xl border-2 border-emerald-100 animate-in fade-in shadow-sm">
                                                <span className="text-xs font-black text-emerald-950 uppercase tracking-tighter">{tax.name} <span className="text-emerald-400 ml-2">({tax.rate}%)</span></span>
                                                <button onClick={() => removeTax(idx)} className="p-1.5 text-emerald-200 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><X className="w-4 h-4" /></button>
                                            </div>
                                        ))}

                                        <div className="flex gap-2 p-1.5 bg-white border-2 border-emerald-100 rounded-xl shadow-sm">
                                            <input
                                                placeholder="Nom de la taxe..."
                                                value={newTaxName}
                                                onChange={e => setNewTaxName(e.target.value)}
                                                className="flex-1 text-[10px] font-black uppercase tracking-tight bg-transparent px-3 outline-none placeholder:text-emerald-100"
                                            />
                                            <div className="flex items-center gap-1 bg-emerald-50 border-2 border-emerald-100 rounded-lg px-2">
                                                <input
                                                    type="number"
                                                    placeholder="0"
                                                    value={newTaxRate || ''}
                                                    onChange={e => setNewTaxRate(parseFloat(e.target.value) || 0)}
                                                    className="w-10 text-[10px] font-black bg-transparent outline-none text-center text-emerald-950"
                                                />
                                                <span className="text-[10px] font-black text-emerald-300">%</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={addTax}
                                                disabled={!newTaxName}
                                                className="p-3 bg-emerald-500 text-white rounded-lg disabled:opacity-30 transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
                                            ><Plus className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                </section>
                            </div>

                            {/* Right Column: Notes */}
                            <div className="flex flex-col space-y-3">
                                <h4 className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest px-1">3. Notes & Instructions</h4>
                                <div className="flex-1 bg-emerald-50/50 p-4 rounded-xl border-2 border-emerald-100 flex flex-col gap-4 shadow-sm">
                                    <textarea
                                        value={formData.notes}
                                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                        rows={6}
                                        placeholder="Commentaires, informations de paiement..."
                                        className="w-full flex-1 bg-white border-2 border-emerald-100 rounded-xl px-4 py-4 text-xs font-bold text-emerald-950 focus:border-emerald-400 transition-all outline-none resize-none placeholder:text-emerald-200 shadow-sm"
                                    />
                                    <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border-2 border-emerald-100 border-dashed">
                                        <Info className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                                        <p className="text-[9px] font-black text-emerald-600/60 uppercase tracking-widest leading-tight">Notes visibles sur le PDF final.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Navigation Footer */}
            <div className="flex items-center justify-between mt-10 pt-6 border-t-2 border-emerald-50">
                <button
                    onClick={currentStep === 1 ? onCancel : prevStep}
                    className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-emerald-600/60 hover:text-emerald-600 hover:bg-emerald-50 transition-all flex items-center gap-2"
                >
                    {currentStep === 1 ? 'Annuler' : <><ChevronLeft className="w-5 h-5" /> Retour</>}
                </button>

                <button
                    onClick={currentStep === 4 ? handleSubmit : nextStep}
                    disabled={loading}
                    className={cn(
                        "px-10 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-xl active:scale-95",
                        currentStep === 4
                            ? "bg-emerald-500 text-white border-b-4 border-emerald-700 shadow-emerald-500/20"
                            : "bg-emerald-500 text-white border-b-4 border-emerald-700 shadow-emerald-500/20"
                    )}
                >
                    {loading ? 'Traitement...' : currentStep === 4 ? (
                        <>
                            <Check className="w-5 h-5" />
                            Confirmer & Créer
                        </>
                    ) : (
                        <>Suivant <ChevronRight className="w-5 h-5" /></>
                    )}
                </button>
            </div>
        </div>
    );
}
