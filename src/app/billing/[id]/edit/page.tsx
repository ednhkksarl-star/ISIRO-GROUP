'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { useToast } from '@/components/ui/Toast';
import { Plus, Trash2, X, ArrowLeft } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { useEntity } from '@/hooks/useEntity';
import { useEntityContext } from '@/hooks/useEntityContext';
import EntitySelector from '@/components/entity/EntitySelector';
import Link from 'next/link';
import { formatNumber } from '@/utils/formatNumber';
import type { Database } from '@/types/database.types';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const dynamicParams = true;

type Invoice = Database['public']['Tables']['invoices']['Row'] & {
  additional_taxes?: Array<{ name: string; rate: number }> | null;
};
type InvoiceItem = Database['public']['Tables']['invoice_items']['Row'];

interface InvoiceItemForm {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface AdditionalTax {
  name: string;
  rate: number;
}

function EditInvoicePageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const toast = useToast();
  const supabase = createSupabaseClient();
  const { selectedEntityId, setSelectedEntityId } = useEntity();
  const { activeEntityId } = useEntityContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Déterminer l'entité à utiliser
  const targetEntityId = searchParams?.get('entity') || activeEntityId || selectedEntityId || profile?.entity_id || null;

  // Vérifier si l'utilisateur peut sélectionner une entité
  const canSelectEntity = profile?.role === 'SUPER_ADMIN_GROUP' ||
    profile?.role === 'ADMIN_ENTITY' ||
    (profile?.entity_ids && profile.entity_ids.length > 1);

  const [formData, setFormData] = useState({
    client_name: '',
    client_phone: '',
    client_address: '',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    reference_type: '',
    notes: '',
    status: 'draft' as 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled',
  });

  const [additionalTaxes, setAdditionalTaxes] = useState<AdditionalTax[]>([]);
  const [newTaxName, setNewTaxName] = useState('');
  const [newTaxRate, setNewTaxRate] = useState(0);
  const [items, setItems] = useState<InvoiceItemForm[]>([
    { description: '', quantity: 1, unit_price: 0, total: 0 },
  ]);
  const [currency, setCurrency] = useState<'USD' | 'CDF'>('USD');
  const { rate, convertToCDF, convertToUSD } = useExchangeRate();

  useEffect(() => {
    if (params.id) {
      fetchInvoice();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', params.id)
        .single();

      if (invoiceError) throw invoiceError;
      const invoice = invoiceData as Invoice;

      // Charger les items
      const { data: itemsData, error: itemsError } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', params.id)
        .order('created_at', { ascending: true });

      if (itemsError) throw itemsError;

      const typedItems = (itemsData || []) as InvoiceItem[];

      // Mettre à jour le formulaire avec les données de la facture
      setFormData({
        client_name: invoice.client_name,
        client_phone: invoice.client_phone || '',
        client_address: invoice.client_address || '',
        issue_date: invoice.issue_date,
        due_date: invoice.due_date,
        reference_type: (invoice as any).reference_type || '',
        notes: invoice.notes || '',
        status: invoice.status,
      });

      setCurrency((invoice.currency as 'USD' | 'CDF') || 'USD');
      setItems(
        typedItems.length > 0
          ? typedItems.map((item) => ({
              id: item.id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total: item.total,
            }))
          : [{ description: '', quantity: 1, unit_price: 0, total: 0 }]
      );

      // Charger les taxes additionnelles
      if (invoice.additional_taxes && Array.isArray(invoice.additional_taxes)) {
        setAdditionalTaxes(invoice.additional_taxes);
      }
    } catch (error: any) {
      toast.error('Erreur lors du chargement de la facture');
      console.error(error);
      router.push('/billing');
    } finally {
      setLoading(false);
    }
  };

  const calculateItemTotal = (item: InvoiceItemForm) => {
    return item.quantity * item.unit_price;
  };

  const updateItem = (index: number, field: keyof InvoiceItemForm, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].total = calculateItemTotal(newItems[index]);
    }
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, unit_price: 0, total: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Calculer le sous-total
  const subtotal = items.reduce((sum, item) => {
    const itemTotal = Number(item.total) || 0;
    return sum + itemTotal;
  }, 0);

  // Calculer la TVA (16% fixe)
  const vatAmount = (subtotal * 16) / 100;

  // Calculer les autres taxes
  const additionalTaxesAmount = additionalTaxes.reduce((sum, tax) => {
    return sum + (subtotal * tax.rate) / 100;
  }, 0);

  // Calculer le total final
  const total = subtotal + vatAmount + additionalTaxesAmount;

  const addTax = () => {
    if (newTaxName && newTaxRate > 0) {
      setAdditionalTaxes([...additionalTaxes, { name: newTaxName, rate: newTaxRate }]);
      setNewTaxName('');
      setNewTaxRate(0);
    }
  };

  const removeTax = (index: number) => {
    setAdditionalTaxes(additionalTaxes.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEntityId) {
      toast.error('Veuillez sélectionner une entité');
      return;
    }

    setSaving(true);
    try {
      // Convertir les montants en USD pour stockage
      const subtotalUSD = currency === 'USD' ? subtotal : convertToUSD(subtotal);
      const vatAmountUSD = currency === 'USD' ? vatAmount : convertToUSD(vatAmount);
      const additionalTaxesAmountUSD = currency === 'USD' ? additionalTaxesAmount : convertToUSD(additionalTaxesAmount);
      const totalUSD = currency === 'USD' ? total : convertToUSD(total);

      // Mettre à jour la facture
      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({
          client_name: formData.client_name,
          client_phone: formData.client_phone || null,
          client_address: formData.client_address || null,
          issue_date: formData.issue_date,
          due_date: formData.due_date,
          status: formData.status,
          subtotal: subtotalUSD,
          tax_rate: 16,
          tax_amount: vatAmountUSD,
          additional_taxes: additionalTaxes.length > 0 ? additionalTaxes : null,
          total: totalUSD,
          currency: currency,
          reference_type: formData.reference_type || null,
          notes: formData.notes || null,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', params.id);

      if (invoiceError) throw invoiceError;

      // Supprimer tous les anciens items
      const { error: deleteError } = await supabase
        .from('invoice_items')
        .delete()
        .eq('invoice_id', params.id);

      if (deleteError) throw deleteError;

      // Créer les nouveaux items
      if (items.length > 0 && items[0].description) {
        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(
            items
              .filter((item) => item.description)
              .map((item) => ({
                invoice_id: params.id,
                description: item.description,
                quantity: item.quantity,
                unit_price: currency === 'CDF' ? convertToUSD(item.unit_price) : item.unit_price,
                total: currency === 'CDF' ? convertToUSD(item.total) : item.total,
              })) as any
          );

        if (itemsError) throw itemsError;
      }

      toast.success('Facture mise à jour avec succès');
      router.push(`/billing/${params.id}`);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la mise à jour');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <Link
              href={`/billing/${params.id}`}
              className="flex items-center gap-2 text-text-light hover:text-text transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm sm:text-base">Retour</span>
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-text">Modifier la facture</h1>
              <p className="text-text-light mt-1 text-sm sm:text-base">
                Modifiez les informations de la facture
              </p>
            </div>
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

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {/* Client Info */}
          <Card>
            <h2 className="text-lg font-semibold text-text mb-4">Informations client</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Nom du client *"
                type="text"
                required
                value={formData.client_name}
                onChange={(e) =>
                  setFormData({ ...formData, client_name: e.target.value })
                }
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Téléphone
                </label>
                <input
                  type="tel"
                  placeholder="+243 XXX XXX XXX"
                  value={formData.client_phone}
                  onChange={(e) =>
                    setFormData({ ...formData, client_phone: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="client-address" className="block text-sm font-medium text-gray-700 mb-2">
                Adresse
              </label>
              <textarea
                id="client-address"
                value={formData.client_address}
                onChange={(e) =>
                  setFormData({ ...formData, client_address: e.target.value })
                }
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                aria-label="Adresse du client"
              />
            </div>
          </Card>

          {/* Currency & Dates */}
          <Card>
            <h2 className="text-lg font-semibold text-text mb-4">Devise et dates</h2>
            <div className="mb-4">
              <label htmlFor="currency-select" className="block text-sm font-medium text-gray-700 mb-2">
                Devise *
              </label>
              <select
                id="currency-select"
                required
                value={currency}
                onChange={(e) => setCurrency(e.target.value as 'USD' | 'CDF')}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all bg-white"
                aria-label="Sélectionner la devise"
              >
                <option value="USD">USD (Dollar américain)</option>
                <option value="CDF">CDF (Franc congolais)</option>
              </select>
              {currency === 'CDF' && rate && (
                <p className="text-xs text-text-light mt-1">
                  Taux du jour: 1 USD = {formatNumber(rate)} CDF
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="issue-date" className="block text-sm font-medium text-gray-700 mb-2">
                  Date d&apos;émission *
                </label>
                <input
                  id="issue-date"
                  type="date"
                  required
                  value={formData.issue_date}
                  onChange={(e) =>
                    setFormData({ ...formData, issue_date: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  aria-label="Date d'émission de la facture"
                />
              </div>
              <div>
                <label htmlFor="due-date" className="block text-sm font-medium text-gray-700 mb-2">
                  Date d&apos;échéance *
                </label>
                <input
                  id="due-date"
                  type="date"
                  required
                  value={formData.due_date}
                  onChange={(e) =>
                    setFormData({ ...formData, due_date: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  aria-label="Date d'échéance de la facture"
                />
              </div>
            </div>
            <div className="mt-4">
              <label htmlFor="status-select" className="block text-sm font-medium text-gray-700 mb-2">
                Statut *
              </label>
              <select
                id="status-select"
                required
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as Invoice['status'] })
                }
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all bg-white"
              >
                <option value="draft">Brouillon</option>
                <option value="sent">Envoyée</option>
                <option value="paid">Payée</option>
                <option value="overdue">Impayée</option>
                <option value="cancelled">Annulée</option>
              </select>
            </div>
          </Card>

          {/* Items */}
          <Card>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
              <h2 className="text-lg font-semibold text-text">Lignes de facture</h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addItem}
                icon={<Plus className="w-4 h-4" />}
              >
                Ajouter une ligne
              </Button>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="grid grid-cols-12 gap-3 sm:gap-4 items-end p-4 bg-gradient-to-r from-white to-primary/5 border-2 border-primary/10 rounded-xl hover:border-primary/20 transition-all"
                >
                  <div className="col-span-12 md:col-span-5">
                    <label className="block text-sm font-medium text-text mb-2">
                      Description
                    </label>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) =>
                        updateItem(index, 'description', e.target.value)
                      }
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all bg-white/90 backdrop-blur-sm"
                      placeholder="Description de l'article"
                    />
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <label className="block text-sm font-medium text-text mb-2">
                      Qté
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.quantity === 0 ? '' : item.quantity}
                      onChange={(e) => {
                        const value = e.target.value;
                        updateItem(index, 'quantity', value === '' ? 0 : parseFloat(value) || 0);
                      }}
                      onFocus={(e) => {
                        if (e.target.value === '0') {
                          e.target.value = '';
                        }
                      }}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all bg-white/90 backdrop-blur-sm"
                      aria-label={`Quantité ${index + 1}`}
                    />
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <label className="block text-sm font-medium text-text mb-2">
                      Prix unit.
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_price === 0 ? '' : item.unit_price}
                      onChange={(e) => {
                        const value = e.target.value;
                        updateItem(index, 'unit_price', value === '' ? 0 : parseFloat(value) || 0);
                      }}
                      onFocus={(e) => {
                        if (e.target.value === '0') {
                          e.target.value = '';
                        }
                      }}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all bg-white/90 backdrop-blur-sm"
                      aria-label={`Prix unitaire ${index + 1}`}
                    />
                  </div>
                  <div className="col-span-3 md:col-span-2">
                    <label className="block text-sm font-medium text-text mb-2">
                      Total
                    </label>
                    <input
                      type="text"
                      value={item.total.toFixed(2)}
                      readOnly
                      className="w-full px-4 py-3 border-2 border-primary/20 rounded-lg bg-gradient-to-r from-primary/5 to-transparent font-semibold text-text"
                      aria-label={`Total ${index + 1}`}
                    />
                  </div>
                  <div className="col-span-1 flex items-end">
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="p-2 text-error hover:text-red-700 hover:bg-error/10 rounded-lg transition-all"
                      title="Supprimer"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Summary */}
          <Card>
            <h2 className="text-lg font-semibold text-text mb-4">Résumé</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-gradient-to-r from-primary/5 to-transparent rounded-lg">
                <span className="text-text-light font-medium">Sous-total:</span>
                <span className="font-bold text-text text-lg">
                  {formatNumber(subtotal)} {currency}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gradient-to-r from-primary/5 to-transparent rounded-lg">
                <span className="text-text-light font-medium">TVA (16% fixe):</span>
                <span className="font-bold text-text">
                  {formatNumber(vatAmount)} {currency}
                </span>
              </div>

              {/* Autres taxes */}
              {additionalTaxes.length > 0 && (
                <div className="space-y-2">
                  {additionalTaxes.map((tax, index) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-text-light font-medium">{tax.name}:</span>
                        <span className="text-xs text-text-light">{tax.rate}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-text">
                          {formatNumber((subtotal * tax.rate) / 100)} {currency}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeTax(index)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Ajouter une autre taxe */}
              <div className="p-3 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={newTaxName}
                    onChange={(e) => setNewTaxName(e.target.value)}
                    placeholder="Nom de la taxe"
                    className="flex-1 px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={newTaxRate === 0 ? '' : newTaxRate}
                      onChange={(e) => {
                        const value = e.target.value;
                        setNewTaxRate(value === '' ? 0 : parseFloat(value) || 0);
                      }}
                      onFocus={(e) => {
                        if (e.target.value === '0') {
                          e.target.value = '';
                        }
                      }}
                      placeholder="Taux %"
                      className="w-24 px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    />
                    <span className="text-text-light">%</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addTax}
                      disabled={!newTaxName || newTaxRate <= 0}
                      icon={<Plus className="w-4 h-4" />}
                    >
                      Ajouter
                    </Button>
                  </div>
                </div>
              </div>

              {additionalTaxesAmount > 0 && (
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                  <span className="text-text-light font-medium">Total autres taxes:</span>
                  <span className="font-bold text-text">
                    {formatNumber(additionalTaxesAmount)} {currency}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center p-4 bg-gradient-to-r from-primary to-primary-dark rounded-lg border-2 border-primary/20">
                <span className="text-white font-bold text-lg">Total:</span>
                <span className="text-white font-bold text-xl">
                  {formatNumber(total)} {currency}
                </span>
              </div>
            </div>
          </Card>

          {/* Référence */}
          <Card>
            <h2 className="text-lg font-semibold text-text mb-4">Référence</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type de référence
                </label>
                <input
                  type="text"
                  value={formData.reference_type}
                  onChange={(e) => setFormData({ ...formData, reference_type: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  placeholder="Saisir le type de référence (ex: Commande, Contrat, etc.)"
                />
              </div>
            </div>
          </Card>

          {/* Notes */}
          <Card>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all bg-white/80 backdrop-blur-sm"
              placeholder="Notes additionnelles..."
            />
          </Card>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row justify-end gap-3">
            <Link href={`/billing/${params.id}`}>
              <Button
                type="button"
                variant="secondary"
              >
                Annuler
              </Button>
            </Link>
            <Button
              type="submit"
              loading={saving}
              icon={!saving && <Plus className="w-5 h-5" />}
            >
              {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}

export default function EditInvoicePage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    }>
      <EditInvoicePageContent />
    </Suspense>
  );
}

