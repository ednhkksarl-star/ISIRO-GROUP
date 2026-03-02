'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { ArrowLeft, Download, Edit } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'react-toastify';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import type { Database } from '@/types/database.types';
import { formatNumber } from '@/utils/formatNumber';
import { generateInvoicePDF } from '@/utils/generateInvoicePDF';

type Invoice = Database['public']['Tables']['invoices']['Row'] & {
  additional_taxes?: Array<{ name: string; rate: number }> | null;
};
type InvoiceItem = Database['public']['Tables']['invoice_items']['Row'];

interface Entity {
  name: string;
  code: string;
  logo_url?: string | null;
  header_url?: string | null;
  watermark_url?: string | null;
  footer_text?: string | null;
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuth();
  const supabase = createSupabaseClient();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [entity, setEntity] = useState<Entity | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPDF, setGeneratingPDF] = useState(false);

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
      const typedInvoice = invoiceData as Invoice;
      setInvoice(typedInvoice);

      // Récupérer les items de la facture
      const { data: itemsData, error: itemsError } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', params.id);

      if (itemsError) throw itemsError;
      setItems(itemsData || []);

      // Récupérer les données de l'entité pour le PDF
      if (typedInvoice.entity_id) {
        const { data: entityData, error: entityError } = await supabase
          .from('entities')
          .select('name, code, logo_url, header_url, watermark_url, footer_text')
          .eq('id', typedInvoice.entity_id)
          .single();

        if (entityError) {
          console.warn('Impossible de charger les données de l\'entité:', entityError);
          // Utiliser des valeurs par défaut
          setEntity({
            name: 'ISIRO GROUP',
            code: 'ISO',
            logo_url: null,
            header_url: null,
            watermark_url: null,
            footer_text: null,
          });
        } else if (entityData) {
          setEntity(entityData);
        }
      } else {
        // Pas d'entité, utiliser des valeurs par défaut
        setEntity({
          name: 'ISIRO GROUP',
          code: 'ISO',
          logo_url: null,
          header_url: null,
          watermark_url: null,
          footer_text: null,
        });
      }
    } catch (error: any) {
      toast.error('Erreur lors du chargement de la facture');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePDF = async () => {
    if (!invoice || !entity) {
      toast.error('Impossible de générer le PDF: données manquantes');
      return;
    }

    try {
      setGeneratingPDF(true);
      await generateInvoicePDF({
        invoice: {
          ...invoice,
          additional_taxes: (invoice as any).additional_taxes || null,
        },
        items,
        entity,
      });
      toast.success('PDF généré avec succès');
    } catch (error: any) {
      console.error('Erreur lors de la génération du PDF:', error);
      toast.error('Erreur lors de la génération du PDF');
    } finally {
      setGeneratingPDF(false);
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

  if (!invoice) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Facture non trouvée</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <Link
            href="/billing"
            className="flex items-center gap-2 text-text-light hover:text-text transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm sm:text-base">Retour</span>
          </Link>
          <div className="flex flex-wrap gap-2">
            <Link href={`/billing/${invoice.id}/edit`} prefetch={false}>
              <Button variant="outline" size="sm" icon={<Edit className="w-4 h-4" />}>
                Modifier
              </Button>
            </Link>
            <Button
              variant="secondary"
              size="sm"
              icon={<Download className="w-4 h-4" />}
              onClick={handleGeneratePDF}
              loading={generatingPDF}
              disabled={generatingPDF || !entity}
            >
              {generatingPDF ? 'Génération...' : 'PDF'}
            </Button>
          </div>
        </div>

        <Card>
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-text">
                Facture {invoice.invoice_number}
              </h1>
              <Badge
                variant={
                  invoice.status === 'paid'
                    ? 'success'
                    : invoice.status === 'overdue'
                    ? 'error'
                    : 'info'
                }
              >
                {invoice.status === 'paid'
                  ? 'Payée'
                  : invoice.status === 'overdue'
                  ? 'Impayée'
                  : invoice.status === 'sent'
                  ? 'Envoyée'
                  : 'Brouillon'}
              </Badge>
            </div>
            <p className="text-text-light text-sm sm:text-base">
              📅 Date d&apos;émission: {new Date(invoice.issue_date).toLocaleDateString('fr-FR')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card>
              <h2 className="font-semibold text-text mb-3 text-lg">Client</h2>
              <div className="space-y-2">
                <p className="text-text font-medium text-base">{invoice.client_name}</p>
                {invoice.client_phone && (
                  <p className="text-text-light flex items-center gap-2">
                    <span className="text-primary">📞</span>
                    <a 
                      href={`tel:${invoice.client_phone}`}
                      className="text-primary hover:text-primary-dark hover:underline transition-colors"
                    >
                      {invoice.client_phone}
                    </a>
                  </p>
                )}
                {invoice.client_address && (
                  <p className="text-text-light whitespace-pre-line text-sm">
                    📍 {invoice.client_address}
                  </p>
                )}
              </div>
            </Card>
            <Card>
              <h2 className="font-semibold text-text mb-3 text-lg">Informations</h2>
              <div className="space-y-4">
                <p className="text-text-light">
                  <span className="font-medium text-text">Date d&apos;échéance:</span>{' '}
                  <span className="text-text">
                    {new Date(invoice.due_date).toLocaleDateString('fr-FR')}
                  </span>
                </p>
                <div>
                  <label className="block text-sm font-medium text-text mb-2">
                    Statut
                  </label>
                  <select
                    value={invoice.status}
                    onChange={async (e) => {
                      const newStatus = e.target.value as Invoice['status'];
                      try {
                        const { error } = await supabase
                          .from('invoices')
                          .update({ 
                            status: newStatus,
                            updated_at: new Date().toISOString()
                          } as never)
                          .eq('id', invoice.id);
                        
                        if (error) throw error;
                        
                        setInvoice({ ...invoice, status: newStatus });
                        toast.success('Statut mis à jour avec succès');
                      } catch (error: any) {
                        toast.error('Erreur lors de la mise à jour du statut');
                        console.error(error);
                      }
                    }}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all bg-white"
                  >
                    <option value="draft">Brouillon</option>
                    <option value="sent">Envoyée</option>
                    <option value="paid">Payée</option>
                    <option value="overdue">Impayée</option>
                    <option value="cancelled">Annulée</option>
                  </select>
                </div>
              </div>
            </Card>
          </div>

          <div className="mb-6 sm:mb-8">
            <h2 className="font-semibold text-text mb-4 text-lg">Lignes de facture</h2>
            <div className="overflow-x-auto rounded-xl border border-primary/10">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-primary/10 to-primary/5">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-bold text-primary uppercase">
                      Description
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-right text-xs font-bold text-primary uppercase">
                      Qté
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-right text-xs font-bold text-primary uppercase">
                      Prix unit.
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-right text-xs font-bold text-primary uppercase">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent transition-all duration-200"
                  >
                    <td className="px-4 sm:px-6 py-4 text-sm text-text font-medium">
                      {item.description}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-sm text-right text-text-light">
                      {item.quantity}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-sm text-right text-text-light">
                      {formatNumber(item.unit_price)} $US
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-sm text-right font-semibold text-text">
                      {formatNumber(item.total)} $US
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>

          <div className="border-t border-primary/20 pt-4 space-y-3">
            <div className="flex justify-between items-center p-3 bg-gradient-to-r from-primary/5 to-transparent rounded-lg">
              <span className="text-text-light font-medium">Sous-total:</span>
              <span className="font-bold text-text text-lg">
                {formatNumber(invoice.subtotal)} $US
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gradient-to-r from-primary/5 to-transparent rounded-lg">
              <span className="text-text-light font-medium">TVA ({invoice.tax_rate}%):</span>
              <span className="font-bold text-text">
                {formatNumber(invoice.tax_amount)} $US
              </span>
            </div>
            <div className="flex justify-between items-center p-4 bg-gradient-to-r from-primary to-primary-dark rounded-lg border-2 border-primary/20">
              <span className="text-white font-bold text-lg">Total:</span>
              <span className="text-white font-bold text-xl">
                {formatNumber(invoice.total)} $US
              </span>
            </div>
          </div>

          {invoice.notes && (
            <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-primary/20">
              <h2 className="font-semibold text-text mb-3 text-lg">Notes</h2>
              <p className="text-text-light whitespace-pre-line bg-gray-50 p-4 rounded-lg">
                {invoice.notes}
              </p>
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}

