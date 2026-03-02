'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { toast } from 'react-toastify';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import BackButton from '@/components/ui/BackButton';
import { useEntity } from '@/hooks/useEntity';
import EntitySelector from '@/components/entity/EntitySelector';
import { getEntityUUID } from '@/utils/entityHelpers';

function NewCollaboratorPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const { selectedEntityId, isGroupView } = useEntity();
  const supabase = createSupabaseClient();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', address: '', notes: '', role_position: '' });
  const [localEntityId, setLocalEntityId] = useState<string | null>(null);

  const entityId = searchParams?.get('entity') || localEntityId || (isGroupView ? null : selectedEntityId) || profile?.entity_id;
  const canSelectEntity = profile?.role === 'SUPER_ADMIN_GROUP' || profile?.role === 'ADMIN_ENTITY' || (profile?.entity_ids && profile.entity_ids.length > 1);

  useEffect(() => {
    if (searchParams?.get('entity')) setLocalEntityId(searchParams.get('entity'));
    else if (selectedEntityId && !isGroupView) setLocalEntityId(selectedEntityId);
    else if (profile?.entity_id) setLocalEntityId(profile.entity_id);
    else if (profile?.entity_ids?.length === 1) setLocalEntityId(profile.entity_ids[0]);
  }, [searchParams, selectedEntityId, isGroupView, profile?.entity_id, profile?.entity_ids]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const uuid = await getEntityUUID(entityId ?? null);
    if (!uuid) { toast.error('Veuillez sélectionner une entité'); return; }
    setLoading(true);
    try {
      const { error } = await (supabase.from('collaborators') as any).insert({
        entity_id: uuid,
        name: formData.name.trim(),
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        address: formData.address.trim() || null,
        notes: formData.notes.trim() || null,
        role_position: formData.role_position.trim() || null,
        is_active: true,
        created_by: profile?.id || null,
      });
      if (error) throw error;
      toast.success('Collaborateur créé');
      router.push('/repertoire');
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-4">
        <BackButton href="/repertoire" />
        <h1 className="text-2xl font-bold text-text">Nouveau collaborateur</h1>
        {canSelectEntity && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-text-light">Entité :</span>
            <EntitySelector selectedEntityId={localEntityId} onSelectEntity={setLocalEntityId} userRole={profile?.role || ''} userEntityIds={profile?.entity_ids || []} />
          </div>
        )}
        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Nom" value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} required />
            <Input label="Fonction / Poste" value={formData.role_position} onChange={(e) => setFormData((p) => ({ ...p, role_position: e.target.value }))} />
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

export default function NewCollaboratorPage() {
  return (
    <Suspense fallback={<AppLayout><div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" /></div></AppLayout>}>
      <NewCollaboratorPageContent />
    </Suspense>
  );
}
