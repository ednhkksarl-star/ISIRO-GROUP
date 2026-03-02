'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { createSupabaseClient } from '@/services/supabaseClient';
import { toast } from 'react-toastify';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import BackButton from '@/components/ui/BackButton';

export default function EditPartnerPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createSupabaseClient();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', address: '', notes: '' });

  useEffect(() => {
    if (params.id) {
      supabase.from('partners').select('*').eq('id', params.id).maybeSingle()
        .then(({ data }) => {
          if (!data) return;
          const row = data as { name?: string; phone?: string | null; email?: string | null; address?: string | null; notes?: string | null };
          setFormData({ name: row.name || '', phone: row.phone || '', email: row.email || '', address: row.address || '', notes: row.notes || '' });
        })
        .then(() => setFetching(false), () => setFetching(false));
    }
  }, [params.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await (supabase.from('partners') as any).update({
        name: formData.name.trim(),
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        address: formData.address.trim() || null,
        notes: formData.notes.trim() || null,
        updated_at: new Date().toISOString(),
      }).eq('id', params.id);
      if (error) throw error;
      toast.success('Partenaire mis à jour');
      router.push('/repertoire');
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return (<AppLayout><div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" /></div></AppLayout>);

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-4">
        <BackButton href="/repertoire" />
        <h1 className="text-2xl font-bold text-text">Modifier le partenaire</h1>
        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Nom" value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} required />
            <Input label="Téléphone" value={formData.phone} onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))} />
            <Input label="Email" type="email" value={formData.email} onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))} />
            <div><label className="block text-sm font-medium text-text mb-1">Adresse</label><textarea value={formData.address} onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary" rows={2} /></div>
            <div><label className="block text-sm font-medium text-text mb-1">Notes</label><textarea value={formData.notes} onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary" rows={2} /></div>
            <div className="flex gap-2"><Button type="submit" loading={loading}>Enregistrer</Button><Button type="button" variant="secondary" onClick={() => router.push('/repertoire')}>Annuler</Button></div>
          </form>
        </Card>
      </div>
    </AppLayout>
  );
}
