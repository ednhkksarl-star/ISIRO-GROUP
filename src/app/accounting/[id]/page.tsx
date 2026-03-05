'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { useToast } from '@/components/ui/Toast';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import BackButton from '@/components/ui/BackButton';
import { ArrowLeft, Pencil, Calendar, FileText, Hash, DollarSign, Building2 } from 'lucide-react';
import Link from 'next/link';
import { formatNumber } from '@/utils/formatNumber';
import type { Database } from '@/types/database.types';

type AccountingEntry = Database['public']['Tables']['accounting_entries']['Row'];

function AccountingEntryDetailContent() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuth();
  const toast = useToast();
  const [entry, setEntry] = useState<AccountingEntry | null>(null);
  const [entityName, setEntityName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const supabase = createSupabaseClient();

  const entryId = params?.id as string;

  useEffect(() => {
    if (entryId) {
      fetchEntry();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId]);

  const fetchEntry = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('accounting_entries')
        .select('*')
        .eq('id', entryId)
        .single();

      if (error) throw error;
      
      const entryData = data as AccountingEntry;
      setEntry(entryData);

      // Récupérer le nom de l'entité
      if (entryData?.entity_id) {
        const { data: entityData } = await supabase
          .from('entities')
          .select('name')
          .eq('id', entryData.entity_id)
          .single();
        
        if (entityData) {
          setEntityName((entityData as { name: string }).name);
        }
      }
    } catch (error: any) {
      toast.error('Erreur lors du chargement de l\'écriture');
      console.error(error);
      router.push('/accounting');
    } finally {
      setLoading(false);
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

  if (!entry) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Écriture non trouvée</p>
          <Link href="/accounting">
            <Button variant="secondary" className="mt-4">
              Retour au livre de caisse
            </Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* En-tête */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <BackButton href="/accounting" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-text">Détail de l&apos;écriture</h1>
              <p className="text-text-light mt-1">{entry.entry_number}</p>
            </div>
          </div>
          <Link href={`/accounting/${entry.id}/edit`}>
            <Button icon={<Pencil className="w-5 h-5" />}>
              Modifier
            </Button>
          </Link>
        </div>

        {/* Informations principales */}
        <Card>
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Informations de l&apos;écriture
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Numéro d'écriture */}
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Hash className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Numéro d&apos;écriture</p>
                  <p className="font-semibold text-gray-900">{entry.entry_number}</p>
                </div>
              </div>

              {/* Date */}
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Date</p>
                  <p className="font-semibold text-gray-900">
                    {new Date(entry.entry_date).toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              {/* Entité */}
              <div className="flex items-start gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Building2 className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Entité</p>
                  <p className="font-semibold text-gray-900">{entityName || 'Non spécifiée'}</p>
                </div>
              </div>

              {/* Code */}
              {entry.code && (
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Hash className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Code</p>
                    <p className="font-semibold text-gray-900">{entry.code}</p>
                  </div>
                </div>
              )}

              {/* Numéro de pièce */}
              {entry.numero_piece && (
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <FileText className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Numéro de pièce</p>
                    <p className="font-semibold text-gray-900">{entry.numero_piece}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Libellé */}
            <div className="mt-6 pt-6 border-t">
              <p className="text-sm text-gray-500 mb-2">Libellé</p>
              <p className="text-gray-900 bg-gray-50 p-4 rounded-lg">{entry.description}</p>
            </div>
          </div>
        </Card>

        {/* Montants */}
        <Card>
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              Montants
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Entrées */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                <p className="text-sm text-green-600 font-medium mb-2">Entrées</p>
                <p className="text-2xl font-bold text-green-700">
                  {formatNumber(entry.entrees || 0)}
                </p>
                <p className="text-sm text-green-600 mt-1">USD</p>
              </div>

              {/* Sorties */}
              <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                <p className="text-sm text-red-600 font-medium mb-2">Sorties</p>
                <p className="text-2xl font-bold text-red-700">
                  {formatNumber(entry.sorties || 0)}
                </p>
                <p className="text-sm text-red-600 mt-1">USD</p>
              </div>

              {/* Solde */}
              <div className={`${entry.balance >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'} border rounded-xl p-6 text-center`}>
                <p className={`text-sm ${entry.balance >= 0 ? 'text-blue-600' : 'text-orange-600'} font-medium mb-2`}>Solde après opération</p>
                <p className={`text-2xl font-bold ${entry.balance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                  {formatNumber(entry.balance)}
                </p>
                <p className={`text-sm ${entry.balance >= 0 ? 'text-blue-600' : 'text-orange-600'} mt-1`}>USD</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Métadonnées */}
        <Card>
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Métadonnées</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Créé le:</span>
                <span className="ml-2 text-gray-900">
                  {new Date(entry.created_at).toLocaleString('fr-FR')}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Modifié le:</span>
                <span className="ml-2 text-gray-900">
                  {new Date(entry.updated_at).toLocaleString('fr-FR')}
                </span>
              </div>
              {entry.currency && (
                <div>
                  <span className="text-gray-500">Devise originale:</span>
                  <span className="ml-2 text-gray-900">{entry.currency}</span>
                </div>
              )}
              {entry.reference_type && (
                <div>
                  <span className="text-gray-500">Type de référence:</span>
                  <span className="ml-2 text-gray-900">{entry.reference_type}</span>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Boutons d'action */}
        <div className="flex justify-between">
          <Link href="/accounting">
            <Button variant="secondary" icon={<ArrowLeft className="w-5 h-5" />}>
              Retour à la liste
            </Button>
          </Link>
          <Link href={`/accounting/${entry.id}/edit`}>
            <Button icon={<Pencil className="w-5 h-5" />}>
              Modifier cette écriture
            </Button>
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}

export default function AccountingEntryDetailPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    }>
      <AccountingEntryDetailContent />
    </Suspense>
  );
}
