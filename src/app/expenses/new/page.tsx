'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { toast } from 'react-toastify';
import { Upload, X } from 'lucide-react';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { useEntity } from '@/hooks/useEntity';
import EntitySelector from '@/components/entity/EntitySelector';
import Button from '@/components/ui/Button';
import { formatNumber } from '@/utils/formatNumber';

const CATEGORIES = [
  { value: 'rent', label: 'Loyer' },
  { value: 'salaries', label: 'Salaires' },
  { value: 'transport', label: 'Transport' },
  { value: 'supplies', label: 'Fournitures' },
  { value: 'procurement', label: 'Approvisionnement' },
  { value: 'purchases', label: 'Achats' },
  { value: 'other', label: 'Autres' },
];

export default function NewExpensePage() {
  const router = useRouter();
  const { profile } = useAuth();
  const supabase = createSupabaseClient();
  const { selectedEntityId, setSelectedEntityId } = useEntity();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    expense_date: new Date().toISOString().split('T')[0],
    category: 'other',
    description: '',
    amount: 0,
    vendor_name: '',
  });
  const [currency, setCurrency] = useState<'USD' | 'CDF'>('USD');
  const { rate, convertToUSD } = useExchangeRate();
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptFileName, setReceiptFileName] = useState<string | null>(null);

  // Déterminer l'entité à utiliser
  const targetEntityId = selectedEntityId || profile?.entity_id || null;
  
  // Vérifier si l'utilisateur peut sélectionner une entité
  const canSelectEntity = profile?.role === 'SUPER_ADMIN_GROUP' || 
                          profile?.role === 'ADMIN_ENTITY' ||
                          (profile?.entity_ids && profile.entity_ids.length > 1);

  const handleFileUpload = async (file: File) => {
    if (!targetEntityId) {
      toast.error('Veuillez sélectionner une entité');
      return;
    }

    // Vérifier la taille du fichier (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Le fichier est trop volumineux (max 10MB)');
      return;
    }

    // Vérifier le type de fichier
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Type de fichier non autorisé (PNG, JPG, PDF uniquement)');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${targetEntityId}/${Date.now()}.${fileExt}`;
      const filePath = `expenses/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('documents').getPublicUrl(filePath);

      setReceiptUrl(publicUrl);
      setReceiptFileName(file.name);
      toast.success('Justificatif uploadé avec succès');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de l\'upload');
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveReceipt = async () => {
    if (receiptUrl) {
      // Extraire le chemin du fichier depuis l'URL
      try {
        const urlParts = receiptUrl.split('/storage/v1/object/public/documents/');
        if (urlParts.length > 1) {
          const filePath = urlParts[1];
          await supabase.storage.from('documents').remove([filePath]);
        }
      } catch (error) {
        console.error('Erreur lors de la suppression du fichier:', error);
      }
    }
    setReceiptUrl(null);
    setReceiptFileName(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEntityId) {
      toast.error('Veuillez sélectionner une entité');
      return;
    }

    setLoading(true);
    try {
      // Générer le numéro de dépense
      const { data: expenseNumberData, error: numberError } = await (supabase.rpc as any)(
        'generate_expense_number',
        { p_entity_id: targetEntityId }
      );

      if (numberError) throw numberError;

      // Créer la dépense (toujours stocker en USD)
      const amountInUSD = currency === 'USD' ? formData.amount : convertToUSD(formData.amount);
      const { error } = await supabase.from('expenses').insert({
        entity_id: targetEntityId,
        expense_number: expenseNumberData,
        expense_date: formData.expense_date,
        category: formData.category as any,
        description: formData.description,
        amount: amountInUSD,
        currency: currency,
        vendor_name: formData.vendor_name || null,
        receipt_url: receiptUrl,
        status: 'pending',
        created_by: profile?.id,
      } as any);

      if (error) throw error;

      toast.success('Dépense créée avec succès');
      router.push('/expenses');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6 px-4 sm:px-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-text">Nouvelle dépense</h1>
            <p className="text-text-light mt-1 text-sm sm:text-base">Enregistrer une nouvelle charge</p>
          </div>
          {canSelectEntity && profile && (
            <EntitySelector
              selectedEntityId={selectedEntityId}
              onSelectEntity={setSelectedEntityId}
              userRole={profile.role}
              userEntityIds={profile.entity_ids}
              className="w-auto"
            />
          )}
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-4 sm:p-6 space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date *
              </label>
              <input
                type="date"
                required
                value={formData.expense_date}
                onChange={(e) =>
                  setFormData({ ...formData, expense_date: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Catégorie *
              </label>
              <select
                required
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Devise *
            </label>
            <select
              required
              value={currency}
              onChange={(e) => setCurrency(e.target.value as 'USD' | 'CDF')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="USD">USD (Dollar américain)</option>
              <option value="CDF">CDF (Franc congolais)</option>
            </select>
            {currency === 'CDF' && rate && (
              <p className="text-xs text-gray-500 mt-1">
                Taux du jour: 1 USD = {formatNumber(rate)} CDF
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              required
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Montant ({currency}) *
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.amount === 0 ? '' : formData.amount}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData({
                    ...formData,
                    amount: value === '' ? 0 : parseFloat(value) || 0,
                  });
                }}
                onFocus={(e) => {
                  if (e.target.value === '0') {
                    e.target.value = '';
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fournisseur
              </label>
              <input
                type="text"
                value={formData.vendor_name}
                onChange={(e) =>
                  setFormData({ ...formData, vendor_name: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Justificatif
            </label>
            {receiptUrl ? (
              <div className="mt-1 p-4 border-2 border-green-300 bg-green-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <Upload className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{receiptFileName || 'Fichier uploadé'}</p>
                      <p className="text-xs text-gray-500">Justificatif uploadé avec succès</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveReceipt}
                    className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                    title="Supprimer le justificatif"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-1">
                <input
                  type="file"
                  id="receipt-upload"
                  className="hidden"
                  accept="image/jpeg,image/jpg,image/png,application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
                <label
                  htmlFor="receipt-upload"
                  className="flex flex-col items-center justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <Upload className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-sm font-medium text-primary-600 hover:text-primary-500">
                      Cliquez pour télécharger un fichier
                    </span>
                    <span className="text-xs text-gray-500">ou glisser-déposer</span>
                    <span className="text-xs text-gray-400 mt-1">PNG, JPG, PDF jusqu&apos;à 10MB</span>
                  </div>
                </label>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.back()}
              className="w-full sm:w-auto"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              loading={loading || uploading}
              disabled={loading || uploading || !targetEntityId}
              className="w-full sm:w-auto"
            >
              {loading ? 'Création...' : uploading ? 'Upload...' : 'Créer la dépense'}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}

