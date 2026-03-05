'use client';

import { useEffect, useState, useMemo } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { Plus, Edit, Trash2, Search, DollarSign, Calendar, Info, Settings, Save, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useModal } from '@/hooks/useModal';
import { formatNumber } from '@/utils/formatNumber';
import SettingsTabs from '@/components/settings/SettingsTabs';
import { cn } from '@/utils/cn';

// Type pour les taux de change
interface ExchangeRate {
  id: string;
  rate_date: string;
  usd_to_cdf: number;
  is_active: boolean;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export default function ExchangeRatesPage() {
  const { profile } = useAuth();
  const toast = useToast();
  const supabase = createSupabaseClient();
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingRate, setEditingRate] = useState<ExchangeRate | null>(null);
  const deleteModal = useModal();
  const [rateToDelete, setRateToDelete] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    rate_date: new Date().toISOString().split('T')[0],
    usd_to_cdf: 2400,
    is_active: true,
    notes: '',
  });

  // Taux actuel (le plus récent actif)
  const currentRate = useMemo(() => {
    return rates.find(r => r.is_active) || rates[0];
  }, [rates]);

  // Vérifier les permissions
  const canManage = profile?.role === 'SUPER_ADMIN_GROUP' ||
    profile?.role === 'ADMIN_ENTITY' ||
    profile?.role === 'ACCOUNTANT';

  useEffect(() => {
    if (canManage) {
      fetchRates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  const fetchRates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('exchange_rates')
        .select('*')
        .order('rate_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRates(data || []);
    } catch (error: any) {
      toast.error('Erreur lors du chargement des taux');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (rate?: ExchangeRate) => {
    if (rate) {
      setEditingRate(rate);
      setFormData({
        rate_date: rate.rate_date,
        usd_to_cdf: rate.usd_to_cdf,
        is_active: rate.is_active,
        notes: rate.notes || '',
      });
    } else {
      setEditingRate(null);
      setFormData({
        rate_date: new Date().toISOString().split('T')[0],
        usd_to_cdf: rates.length > 0 ? rates[0].usd_to_cdf : 2400,
        is_active: true,
        notes: '',
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingRate(null);
  };

  const handleSubmit = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!profile?.id) return;

    try {
      if (editingRate) {
        const { error } = await (supabase
          .from('exchange_rates') as any)
          .update({
            rate_date: formData.rate_date,
            usd_to_cdf: formData.usd_to_cdf,
            is_active: formData.is_active,
            notes: formData.notes || null,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', editingRate.id);

        if (error) throw error;
        toast.success('Taux de change mis à jour');
      } else {
        const { error } = await (supabase
          .from('exchange_rates') as any)
          .insert({
            rate_date: formData.rate_date,
            usd_to_cdf: formData.usd_to_cdf,
            is_active: formData.is_active,
            notes: formData.notes || null,
            created_by: profile.id,
          } as any);

        if (error) throw error;
        toast.success('Taux de change créé');
      }

      handleCloseModal();
      fetchRates();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de l\'enregistrement du taux');
      console.error('Exchange rate save error:', error);
    }
  };

  const handleDeleteClick = (id: string) => {
    setRateToDelete(id);
    deleteModal.open();
  };

  const handleDeleteConfirm = async () => {
    if (!rateToDelete) return;

    try {
      const { error } = await (supabase
        .from('exchange_rates') as any)
        .delete()
        .eq('id', rateToDelete);

      if (error) throw error;
      toast.success('Taux de change supprimé');
      fetchRates();
    } catch (error: any) {
      toast.error('Erreur lors de la suppression');
      console.error(error);
    } finally {
      deleteModal.close();
      setRateToDelete(null);
    }
  };

  const filteredRates = rates.filter(
    (rate) =>
      rate.rate_date.includes(searchTerm) ||
      rate.usd_to_cdf.toString().includes(searchTerm) ||
      (rate.notes && rate.notes.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (!canManage) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="bg-white border-2 border-rose-100 p-10 rounded-[2rem] text-center space-y-4 max-w-md shadow-sm">
            <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mx-auto">
              <AlertCircle className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-black uppercase text-rose-950">Accès Refusé</h2>
            <p className="text-rose-800/60 font-medium">Vous n'avez pas les permissions nécessaires pour gérer les taux de change.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header Block: Vibrant Minimalist */}
        <div className="bg-white border-2 border-emerald-100 p-8 sm:p-10 rounded-[2rem] relative overflow-hidden group hover:border-emerald-300 transition-all duration-700 shadow-sm">
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-emerald-50 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-700" />
          <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-yellow-50 rounded-full opacity-30 group-hover:scale-125 transition-transform duration-700" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-100">
                <Settings className="w-4 h-4 text-emerald-600" />
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800">Paramètres</span>
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-emerald-950 uppercase leading-none">Taux de Change</h1>
                <div className="h-1.5 w-24 bg-yellow-400 mt-4 rounded-full" />
              </div>
              <p className="text-emerald-800/60 text-sm font-bold max-w-md">Référentiel mondial des taux de change USD vers CDF au sein de l'organisation.</p>
            </div>

            <Button
              icon={<Plus className="w-5 h-5 stroke-[3]" />}
              onClick={() => handleOpenModal()}
              className="px-8 shadow-lg shadow-emerald-100 ring-2 ring-emerald-600 ring-offset-2"
            >
              Nouveau Taux
            </Button>
          </div>
        </div>

        {/* Persisted Navigation Tabs */}
        <SettingsTabs />

        {/* KPI Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border-2 border-emerald-100 p-6 rounded-[2rem] shadow-sm flex items-center gap-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform" />
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 border border-emerald-100 relative z-10 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
              <DollarSign className="w-7 h-7 stroke-[2.5]" />
            </div>
            <div className="relative z-10">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-900/60">Taux Actuel</p>
              <h3 className="text-2xl font-black text-emerald-950 mt-1">{currentRate ? formatNumber(currentRate.usd_to_cdf) : '0'} <span className="text-xs text-emerald-800/40 ml-1 uppercase">CDF / USD</span></h3>
            </div>
          </div>

          <div className="bg-white border-2 border-emerald-100 p-6 rounded-[2rem] shadow-sm flex items-center gap-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-50 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform" />
            <div className="w-14 h-14 bg-yellow-50 rounded-2xl flex items-center justify-center text-yellow-600 border border-yellow-100 relative z-10 transition-colors group-hover:bg-yellow-400 group-hover:text-white">
              <Calendar className="w-7 h-7 stroke-[2.5]" />
            </div>
            <div className="relative z-10">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-900/60">Dernière Mise à Jour</p>
              <h3 className="text-lg font-black text-emerald-950 mt-1">
                {currentRate ? new Date(currentRate.rate_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Indisponible'}
              </h3>
            </div>
          </div>

          <div className="bg-white border-2 border-emerald-100 p-6 rounded-[2rem] shadow-sm flex items-center gap-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform" />
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 border border-emerald-100 relative z-10 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
              <Info className="w-7 h-7 stroke-[2.5]" />
            </div>
            <div className="relative z-10">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-900/60">Nombre total</p>
              <h3 className="text-2xl font-black text-emerald-950 mt-1">{rates.length} <span className="text-xs text-emerald-800/40 ml-1 uppercase">Entrées</span></h3>
            </div>
          </div>
        </div>

        {/* Search Bar: Glass Card */}
        <div className="bg-white/50 border-2 border-white backdrop-blur-md p-4 rounded-3xl flex items-center gap-4 group transition-all duration-300 hover:border-emerald-200 shadow-sm ring-1 ring-emerald-50">
          <div className="w-12 h-12 bg-white rounded-2xl border border-emerald-100 flex items-center justify-center text-emerald-400 group-focus-within:text-emerald-600 transition-colors">
            <Search className="w-5 h-5 stroke-[2.5]" />
          </div>
          <input
            type="text"
            placeholder="Rechercher une date ou un taux spécifique..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-emerald-950 font-bold placeholder:text-emerald-100"
          />
        </div>

        {/* Rates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            Array(6).fill(0).map((_, i) => (
              <div key={i} className="h-48 bg-emerald-50 animate-pulse rounded-[2rem] border-2 border-emerald-100" />
            ))
          ) : filteredRates.length === 0 ? (
            <div className="col-span-full py-20 text-center space-y-4">
              <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-200">
                <Search className="w-10 h-10" />
              </div>
              <p className="text-emerald-900/40 font-black uppercase tracking-widest">Aucun résultat trouvé</p>
            </div>
          ) : (
            filteredRates.map((rate) => (
              <div
                key={rate.id}
                className={cn(
                  "bg-white border-2 p-6 rounded-[2rem] relative overflow-hidden transition-all duration-500 group shadow-sm",
                  rate.is_active ? "border-emerald-100 hover:border-emerald-400" : "border-gray-100 opacity-60 hover:opacity-100"
                )}
              >
                {/* Visual Accent */}
                <div className={cn(
                  "absolute top-0 right-0 w-24 h-24 rounded-full -mr-12 -mt-12 transition-all group-hover:scale-125",
                  rate.is_active ? "bg-emerald-50" : "bg-gray-50"
                )} />

                <div className="relative z-10 flex flex-col h-full gap-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center border transition-colors",
                        rate.is_active
                          ? "bg-emerald-50 text-emerald-600 border-emerald-100 group-hover:bg-emerald-600 group-hover:text-white"
                          : "bg-gray-50 text-gray-400 border-gray-100"
                      )}>
                        <Calendar className="w-5 h-5 stroke-[2.5]" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-900/60 leading-none">Date de référence</p>
                        <p className="text-xs font-black text-emerald-950 mt-1">{new Date(rate.rate_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                      </div>
                    </div>
                    {rate.is_active && (
                      <span className="bg-emerald-100 text-emerald-800 text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border border-emerald-200">Actif</span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-900/60">Taux de conversion</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black text-emerald-950 tracking-tight">{formatNumber(rate.usd_to_cdf)}</span>
                      <span className="text-xs font-black text-emerald-800/40 uppercase tracking-widest">CDF / USD</span>
                    </div>
                  </div>

                  {rate.notes && (
                    <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-50">
                      <p className="text-[10px] italic font-bold text-emerald-800/60 line-clamp-2">"{rate.notes}"</p>
                    </div>
                  )}

                  <div className="mt-auto pt-4 border-t-2 border-emerald-50 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => handleOpenModal(rate)}
                        className="p-2 text-emerald-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(rate.id)}
                        className="p-2 text-rose-200 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                    <p className="text-[8px] font-black uppercase tracking-[0.2em] text-emerald-900/40">ISIRO CORE</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal: Vibrant Minimalist */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingRate ? 'Modifier le taux' : 'Nouveau taux de change'}
        size="md"
      >
        <form id="exchange-rate-form" onSubmit={handleSubmit} className="space-y-6 py-2">
          {/* Header context */}
          <div className="p-4 bg-emerald-50 border-2 border-emerald-100 rounded-[1.5rem] flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-emerald-600 border border-emerald-100">
              <DollarSign className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-900/60 leading-none">Configuration</p>
              <p className="text-sm font-black text-emerald-950 mt-1">Définissez le taux de référence du jour.</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-1.5">
              <label htmlFor="rate_date" className="block text-[10px] font-black uppercase tracking-widest text-emerald-900/60 ml-1">Date de référence *</label>
              <input
                id="rate_date"
                type="date"
                required
                value={formData.rate_date}
                onChange={(e) => setFormData({ ...formData, rate_date: e.target.value })}
                className="w-full px-5 py-4 bg-white border-2 border-emerald-100 rounded-2xl text-sm font-black text-emerald-950 focus:border-emerald-400 focus:outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="usd_to_cdf" className="block text-[10px] font-black uppercase tracking-widest text-emerald-900/60 ml-1">Valeur en CDF (pour 1 USD) *</label>
              <div className="relative">
                <input
                  id="usd_to_cdf"
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  value={formData.usd_to_cdf === 0 ? '' : formData.usd_to_cdf}
                  onChange={(e) => setFormData({ ...formData, usd_to_cdf: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0 })}
                  placeholder="2400"
                  className="w-full px-5 py-4 bg-white border-2 border-emerald-100 rounded-2xl text-sm font-black text-emerald-950 focus:border-emerald-400 focus:outline-none transition-all"
                />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-emerald-200">CDF</span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-emerald-50 ring-1 ring-emerald-100 rounded-2xl group cursor-pointer" onClick={() => setFormData(p => ({ ...p, is_active: !p.is_active }))}>
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                formData.is_active ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200" : "bg-white text-emerald-200 border border-emerald-100"
              )}>
                {formData.is_active ? <AlertCircle className="w-5 h-5 fill-white/20" /> : <Plus className="w-5 h-5" />}
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-950 leading-none">Taux Actif</p>
                <p className="text-[10px] font-bold text-emerald-800/60 mt-1 uppercase tracking-tighter">Définir comme référence actuelle</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="notes" className="block text-[10px] font-black uppercase tracking-widest text-emerald-900/60 ml-1">Notes Additionnelles</label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                placeholder="Ex: Taux indicatif de la Banque Centrale..."
                className="w-full px-5 py-4 bg-white border-2 border-emerald-100 rounded-2xl text-sm font-bold text-emerald-950 focus:border-emerald-400 focus:outline-none transition-all placeholder:text-emerald-100"
              />
            </div>
          </div>

          <div className="flex gap-4 justify-end mt-8">
            <Button type="button" variant="secondary" onClick={handleCloseModal}>
              Annuler
            </Button>
            <Button type="submit" icon={<Save className="w-4 h-4 stroke-[3]" />}>
              {editingRate ? 'Mettre à jour' : 'Confirmer'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={deleteModal.close}
        onConfirm={handleDeleteConfirm}
        title="Supprimer ce taux ?"
        message="Cette action effacera définitivement ce taux de l'historique de l'organisation."
        variant="danger"
      />
    </AppLayout>
  );
}

