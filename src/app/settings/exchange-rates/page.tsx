'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import { toast } from 'react-toastify';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import BackButton from '@/components/ui/BackButton';
import { useModal } from '@/hooks/useModal';
import { formatNumber } from '@/utils/formatNumber';
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
        usd_to_cdf: 2400,
        is_active: true,
        notes: '',
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingRate(null);
    setFormData({
      rate_date: new Date().toISOString().split('T')[0],
      usd_to_cdf: 2400,
      is_active: true,
      notes: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;

    try {
      if (editingRate) {
        // Mettre à jour
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
        // Créer
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
      toast.error(error.message || 'Erreur lors de l\'enregistrement');
      console.error(error);
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
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Accès refusé</h2>
            <p className="text-gray-600">
              Vous n&apos;avez pas les permissions nécessaires pour gérer les taux de change.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
        <BackButton />
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-text">Taux de change</h1>
            <p className="text-text-light mt-1 text-sm sm:text-base">Gestion des taux USD/CDF</p>
          </div>
          <Button
            icon={<Plus className="w-5 h-5" />}
            onClick={() => handleOpenModal()}
            className="w-full sm:w-auto"
          >
            Nouveau taux
          </Button>
        </div>

        {/* Search */}
        <Card>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-light w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher un taux..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-inactive rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>
        </Card>

        {/* Rates Table */}
        <Card>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="min-w-full divide-y divide-inactive">
              <thead className="bg-primary/5">
                <tr>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-bold text-primary uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-bold text-primary uppercase tracking-wider">
                    Taux (1 USD = X CDF)
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-bold text-primary uppercase tracking-wider hidden sm:table-cell">
                    Statut
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-bold text-primary uppercase tracking-wider hidden md:table-cell">
                    Notes
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-right text-xs font-bold text-primary uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-inactive">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-3 sm:px-6 py-8 text-center text-text-light">
                      Chargement...
                    </td>
                  </tr>
                ) : filteredRates.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 sm:px-6 py-8 text-center text-text-light">
                      Aucun taux de change trouvé
                    </td>
                  </tr>
                ) : (
                  filteredRates.map((rate) => (
                    <tr key={rate.id} className="hover:bg-primary/5 transition-colors">
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-text">
                        {new Date(rate.rate_date).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-text">
                        {formatNumber(rate.usd_to_cdf)} CDF
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            rate.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {rate.is_active ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-sm text-text-light hidden md:table-cell">
                        {rate.notes || '-'}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenModal(rate)}
                            className="text-primary hover:text-primary-dark transition-colors"
                            title="Modifier"
                          >
                            <Edit className="w-4 h-4 sm:w-5 sm:h-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(rate.id)}
                            className="text-error hover:text-red-700 transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Modal Create/Edit */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingRate ? 'Modifier le taux de change' : 'Nouveau taux de change'}
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={handleCloseModal}>
              Annuler
            </Button>
            <Button onClick={handleSubmit}>
              {editingRate ? 'Mettre à jour' : 'Créer'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Date *"
            type="date"
            required
            value={formData.rate_date}
            onChange={(e) => setFormData({ ...formData, rate_date: e.target.value })}
          />
          <Input
            label="Taux (1 USD = X CDF) *"
            type="number"
            required
            min="0"
            step="0.01"
            value={formData.usd_to_cdf === 0 ? '' : formData.usd_to_cdf}
            onChange={(e) => {
              const value = e.target.value;
              setFormData({
                ...formData,
                usd_to_cdf: value === '' ? 0 : parseFloat(value) || 0,
              });
            }}
            placeholder="2400"
          />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="form-checkbox h-5 w-5 text-primary rounded focus:ring-primary"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
              Taux actif
            </label>
          </div>
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={deleteModal.close}
        onConfirm={handleDeleteConfirm}
        title="Confirmer la suppression"
        message="Êtes-vous sûr de vouloir supprimer ce taux de change ? Cette action est irréversible."
        variant="danger"
      />
    </AppLayout>
  );
}

