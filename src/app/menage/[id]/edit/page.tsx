'use client';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { useToast } from '@/components/ui/Toast';
import { X, FileText, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import BackButton from '@/components/ui/BackButton';

const CATEGORIES = [
  { value: 'subscriptions', label: 'Abonnements' },
  { value: 'rent', label: 'Loyer' },
  { value: 'worker_salary', label: 'Salaire travailleurs' },
  { value: 'maintenance', label: 'Entretien' },
  { value: 'utilities', label: 'Services publics' },
  { value: 'food', label: 'Alimentation' },
  { value: 'health', label: 'Santé' },
  { value: 'education', label: 'Éducation' },
  { value: 'savings', label: 'Épargne' },
  { value: 'other', label: 'Autres' },
];

const RECURRING_FREQUENCIES = [
  { value: 'weekly', label: 'Hebdomadaire' },
  { value: 'monthly', label: 'Mensuel' },
  { value: 'quarterly', label: 'Trimestriel' },
  { value: 'yearly', label: 'Annuel' },
];

export default function EditHouseholdExpensePage() {
  const router = useRouter();
  const params = useParams();
  const { profile } = useAuth();
  const toast = useToast();
  const supabase = createSupabaseClient();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [existingReceiptUrl, setExistingReceiptUrl] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    expense_date: new Date().toISOString().split('T')[0],
    category: 'other',
    description: '',
    amount: '' as string | number,
    vendor_name: '',
    worker_name: '',
    notes: '',
    is_recurring: false,
    recurring_frequency: 'monthly',
  });

  // Vérifier que seul le super admin peut accéder
  useEffect(() => {
    if (profile && profile.role !== 'SUPER_ADMIN_GROUP') {
      router.push('/dashboard');
    }
  }, [profile, router]);

  useEffect(() => {
    if (params.id && profile?.role === 'SUPER_ADMIN_GROUP') {
      fetchExpense();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, profile]);

  const fetchExpense = async () => {
    try {
      setFetching(true);
      const { data, error } = await supabase
        .from('household_expenses')
        .select('*')
        .eq('id', params.id)
        .eq('created_by', profile?.id || '')
        .single();

      if (error) throw error;

      if (data) {
        const expenseData = data as any;
        setFormData({
          expense_date: expenseData.expense_date,
          category: expenseData.category,
          description: expenseData.description,
          amount: Number(expenseData.amount) || '',
          vendor_name: expenseData.vendor_name || '',
          worker_name: expenseData.worker_name || '',
          notes: expenseData.notes || '',
          is_recurring: expenseData.is_recurring || false,
          recurring_frequency: expenseData.recurring_frequency || 'monthly',
        });
        setExistingReceiptUrl(expenseData.receipt_url);
        setReceiptUrl(expenseData.receipt_url);
        if (expenseData.receipt_url && expenseData.receipt_url.match(/\.(jpg|jpeg|png)$/i)) {
          setReceiptPreview(expenseData.receipt_url);
        }
      }
    } catch (error: any) {
      toast.error('Erreur lors du chargement de la dépense');
      console.error(error);
      router.push('/menage');
    } finally {
      setFetching(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Format de fichier non supporté. Utilisez PDF, JPG ou PNG.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Le fichier est trop volumineux. Taille maximale: 10MB.');
      return;
    }

    setReceiptFile(file);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setReceiptPreview(null);
    }
  };

  const handleRemoveReceipt = async () => {
    if (existingReceiptUrl) {
      try {
        const fileName = existingReceiptUrl.split('/').pop();
        if (fileName) {
          const { error } = await supabase.storage
            .from('documents')
            .remove([`household-expenses/${profile?.id}/${fileName}`]);
          if (error) {
            console.error('Erreur lors de la suppression du fichier:', error);
          }
        }
      } catch (error) {
        console.error('Erreur lors de la suppression du fichier:', error);
      }
    }
    setExistingReceiptUrl(null);
    setReceiptUrl(null);
    setReceiptPreview(null);
    setReceiptFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amountValue = typeof formData.amount === 'string' ? parseFloat(formData.amount) : formData.amount;
    if (!formData.description || !amountValue || amountValue <= 0) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setLoading(true);
    setUploading(true);

    try {
      // Upload du nouveau reçu si présent
      let finalReceiptUrl = existingReceiptUrl;
      if (receiptFile && !receiptUrl) {
        // Supprimer l'ancien reçu si présent
        if (existingReceiptUrl) {
          await handleRemoveReceipt();
        }

        const fileExt = receiptFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `household-expenses/${profile?.id}/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, receiptFile, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);
        finalReceiptUrl = urlData.publicUrl;
      }

      // Mettre à jour la dépense
      const updatePayload: any = {
        expense_date: formData.expense_date,
        category: formData.category,
        description: formData.description,
        amount: typeof formData.amount === 'string' ? parseFloat(formData.amount) : formData.amount,
        vendor_name: formData.vendor_name || null,
        worker_name: formData.category === 'worker_salary' ? formData.worker_name || null : null,
        receipt_url: finalReceiptUrl,
        notes: formData.notes || null,
        is_recurring: formData.is_recurring,
        recurring_frequency: formData.is_recurring ? formData.recurring_frequency : null,
        updated_at: new Date().toISOString(),
      };
      
      const { error } = await (supabase.from('household_expenses') as any)
        .update(updatePayload)
        .eq('id', params.id)
        .eq('created_by', profile?.id || '');

      if (error) throw error;

      toast.success('Dépense mise à jour avec succès');
      router.push('/menage');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la mise à jour');
      console.error(error);
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  if (profile?.role !== 'SUPER_ADMIN_GROUP') {
    return null;
  }

  if (fetching) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6 px-4 sm:px-0">
        <BackButton />
        
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Modifier la dépense</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Modifier une dépense personnelle</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <div className="space-y-4">
              <Input
                label="Date de la dépense *"
                type="date"
                required
                value={formData.expense_date}
                onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
              />

              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                  Catégorie *
                </label>
                <select
                  id="category"
                  name="category"
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Description *"
                type="text"
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ex: Abonnement internet, Loyer maison, Salaire jardinier..."
              />

              <Input
                label="Montant (USD) *"
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData({ ...formData, amount: value === '' ? '' : parseFloat(value) || '' });
                }}
                onFocus={(e) => {
                  if (e.target.value === '0' || e.target.value === '') {
                    e.target.select();
                  }
                }}
              />

              {formData.category === 'worker_salary' ? (
                <Input
                  label="Nom du travailleur"
                  type="text"
                  value={formData.worker_name}
                  onChange={(e) => setFormData({ ...formData, worker_name: e.target.value })}
                  placeholder="Ex: Jean, Marie..."
                />
              ) : (
                <Input
                  label="Fournisseur/Prestataire"
                  type="text"
                  value={formData.vendor_name}
                  onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                  placeholder="Ex: Orange, Supermarché, Garage..."
                />
              )}

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_recurring"
                  checked={formData.is_recurring}
                  onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                />
                <label htmlFor="is_recurring" className="ml-2 block text-sm text-gray-900">
                  Dépense récurrente
                </label>
              </div>

              {formData.is_recurring && (
                <div>
                  <label htmlFor="recurring_frequency" className="block text-sm font-medium text-gray-700 mb-2">
                    Fréquence *
                  </label>
                  <select
                    id="recurring_frequency"
                    name="recurring_frequency"
                    required={formData.is_recurring}
                    value={formData.recurring_frequency}
                    onChange={(e) => setFormData({ ...formData, recurring_frequency: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                  >
                    {RECURRING_FREQUENCIES.map((freq) => (
                      <option key={freq.value} value={freq.value}>
                        {freq.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={4}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                  placeholder="Notes supplémentaires..."
                />
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Reçu/Facture</h2>
            <div className="space-y-4">
              {!receiptFile && !receiptUrl ? (
                <div>
                  <label htmlFor="receipt-file" className="block text-sm font-medium text-gray-700 mb-2">
                    Uploader un fichier (PDF, JPG, PNG - Max 10MB)
                  </label>
                  <input
                    id="receipt-file"
                    name="receipt-file"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                  />
                </div>
              ) : (
                <div className="border-2 border-gray-300 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {receiptPreview ? (
                        <ImageIcon className="w-5 h-5 text-blue-600" />
                      ) : (
                        <FileText className="w-5 h-5 text-red-600" />
                      )}
                      <span className="text-sm font-medium text-gray-900">
                        {receiptFile?.name || 'Reçu téléchargé'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveReceipt}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  {receiptPreview && (
                    <div className="mt-4 relative w-full h-64 border-2 border-gray-300 rounded-lg overflow-hidden">
                      <Image
                        src={receiptPreview}
                        alt="Preview"
                        fill
                        className="object-contain"
                        unoptimized
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>

          <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4">
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
              className="w-full sm:w-auto"
            >
              {uploading ? 'Téléchargement...' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}

