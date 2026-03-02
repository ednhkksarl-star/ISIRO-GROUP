'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { createSupabaseClient } from '@/services/supabaseClient';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'react-toastify';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

export default function ClientDetailPage() {
  const params = useParams();
  const supabase = createSupabaseClient();
  const [row, setRow] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      supabase
        .from('clients')
        .select('*')
        .eq('id', params.id)
        .eq('is_active', true)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) {
            toast.error('Erreur lors du chargement');
            return;
          }
          setRow(data);
        })
        .then(() => setLoading(false), () => setLoading(false));
    }
  }, [params.id]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" /></div>
      </AppLayout>
    );
  }

  if (!row) {
    return (
      <AppLayout>
        <div className="text-center py-12 text-gray-500">Client non trouvé</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <Link href="/repertoire" className="flex items-center gap-2 text-text-light hover:text-text">
            <ArrowLeft className="w-5 h-5" /> Retour
          </Link>
          <Link href={`/clients/${row.id}/edit`}>
            <Button variant="outline">Modifier</Button>
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-text">Fiche client</h1>
        <Card>
          <dl className="grid gap-3">
            <div><dt className="text-sm text-text-light">Nom</dt><dd className="font-medium">{row.name || '—'}</dd></div>
            <div><dt className="text-sm text-text-light">Téléphone</dt><dd>{row.phone || '—'}</dd></div>
            <div><dt className="text-sm text-text-light">Email</dt><dd>{row.email || '—'}</dd></div>
            <div><dt className="text-sm text-text-light">Adresse</dt><dd className="whitespace-pre-wrap">{row.address || '—'}</dd></div>
            {row.notes && <div><dt className="text-sm text-text-light">Notes</dt><dd className="whitespace-pre-wrap">{row.notes}</dd></div>}
          </dl>
        </Card>
      </div>
    </AppLayout>
  );
}
