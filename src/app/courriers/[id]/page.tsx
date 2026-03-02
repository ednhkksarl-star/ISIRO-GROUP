'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'react-toastify';
import type { Database } from '@/types/database.types';

type MailItem = Database['public']['Tables']['mail_items']['Row'];

interface EntityInfo {
  id: string;
  name: string;
  code: string;
}

interface UserInfo {
  id: string;
  full_name: string | null;
  email: string;
}

const TYPE_LABELS: Record<string, string> = {
  incoming: 'Entrant',
  outgoing: 'Sortant',
  internal: 'Interne',
};

const STATUS_LABELS: Record<string, string> = {
  registered: 'Enregistré',
  assigned: 'Affecté',
  processing: 'En traitement',
  validated: 'Validé',
  archived: 'Archivé',
};

export default function MailItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuth();
  const supabase = createSupabaseClient();
  const [mailItem, setMailItem] = useState<MailItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [originEntity, setOriginEntity] = useState<EntityInfo | null>(null);
  const [orientedEntity, setOrientedEntity] = useState<EntityInfo | null>(null);
  const [createdByUser, setCreatedByUser] = useState<UserInfo | null>(null);
  const [orientedToUser, setOrientedToUser] = useState<UserInfo | null>(null);
  const [assignedToUser, setAssignedToUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    if (params.id) {
      fetchMailItem();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  useEffect(() => {
    if (mailItem) {
      fetchRelatedData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mailItem]);

  const fetchMailItem = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('mail_items')
        .select('*')
        .eq('id', params.id)
        .single();

      if (error) throw error;
      setMailItem(data);
    } catch (error: any) {
      toast.error('Erreur lors du chargement du courrier');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedData = async () => {
    if (!mailItem) return;

    try {
      // Charger l'entité d'origine
      if (mailItem.entity_id) {
        const { data: originEntityData } = await supabase
          .from('entities')
          .select('id, name, code')
          .eq('id', mailItem.entity_id)
          .single();
        if (originEntityData) {
          setOriginEntity(originEntityData as EntityInfo);
        }
      }

      // Charger l'entité orientée
      if (mailItem.oriented_to_entity_id) {
        const { data: orientedEntityData } = await supabase
          .from('entities')
          .select('id, name, code')
          .eq('id', mailItem.oriented_to_entity_id)
          .single();
        if (orientedEntityData) {
          setOrientedEntity(orientedEntityData as EntityInfo);
        }
      }

      // Charger l'utilisateur créateur
      if (mailItem.created_by) {
        const { data: createdByData } = await supabase
          .from('users')
          .select('id, full_name, email')
          .eq('id', mailItem.created_by)
          .single();
        if (createdByData) {
          setCreatedByUser(createdByData as UserInfo);
        }
      }

      // Charger l'utilisateur orienté
      if (mailItem.oriented_to_user_id) {
        const { data: orientedUserData } = await supabase
          .from('users')
          .select('id, full_name, email')
          .eq('id', mailItem.oriented_to_user_id)
          .single();
        if (orientedUserData) {
          setOrientedToUser(orientedUserData as UserInfo);
        }
      }

      // Charger l'utilisateur assigné
      if (mailItem.assigned_to) {
        const { data: assignedUserData } = await supabase
          .from('users')
          .select('id, full_name, email')
          .eq('id', mailItem.assigned_to)
          .single();
        if (assignedUserData) {
          setAssignedToUser(assignedUserData as UserInfo);
        }
      }
    } catch (error: any) {
      console.error('Erreur lors du chargement des données associées:', error);
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

  if (!mailItem) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Courrier non trouvé</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/courriers"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Retour</span>
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Courrier {mailItem.mail_number}
            </h1>
            <div className="flex items-center gap-4 text-gray-600">
              <span className="capitalize">{TYPE_LABELS[mailItem.mail_type] || mailItem.mail_type}</span>
              <span>•</span>
              <span>{STATUS_LABELS[mailItem.status] || mailItem.status}</span>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="font-semibold text-gray-900 mb-2">Objet</h2>
              <p className="text-gray-700">{mailItem.subject}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {mailItem.mail_type === 'incoming' && mailItem.sender && (
                <div>
                  <h2 className="font-semibold text-gray-900 mb-2">Expéditeur</h2>
                  <p className="text-gray-700">{mailItem.sender}</p>
                </div>
              )}
              {mailItem.mail_type === 'outgoing' && mailItem.recipient && (
                <div>
                  <h2 className="font-semibold text-gray-900 mb-2">Destinataire</h2>
                  <p className="text-gray-700">{mailItem.recipient}</p>
                </div>
              )}
              {mailItem.received_date && (
                <div>
                  <h2 className="font-semibold text-gray-900 mb-2">Date de réception</h2>
                  <p className="text-gray-700">
                    {new Date(mailItem.received_date).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              )}
              {mailItem.sent_date && (
                <div>
                  <h2 className="font-semibold text-gray-900 mb-2">Date d&apos;envoi</h2>
                  <p className="text-gray-700">
                    {new Date(mailItem.sent_date).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              )}
            </div>

            {/* Informations d'origine et d'assignation */}
            <div className="border-t pt-6 mt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Informations d&apos;origine et d&apos;assignation</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium text-gray-700 mb-1">Entité d&apos;origine</h3>
                  <p className="text-gray-900">
                    {originEntity ? `${originEntity.name} (${originEntity.code})` : 'Chargement...'}
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-700 mb-1">Créé par</h3>
                  <p className="text-gray-900">
                    {createdByUser ? (createdByUser.full_name || createdByUser.email) : 'Chargement...'}
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-700 mb-1">Entité orientée vers</h3>
                  <p className="text-gray-900">
                    {orientedEntity ? `${orientedEntity.name} (${orientedEntity.code})` : 'Non renseigné'}
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-700 mb-1">Agent orienté vers</h3>
                  <p className="text-gray-900">
                    {orientedToUser ? (orientedToUser.full_name || orientedToUser.email) : 'Non renseigné'}
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-700 mb-1">Assigné à</h3>
                  <p className="text-gray-900">
                    {assignedToUser ? (assignedToUser.full_name || assignedToUser.email) : 'Non assigné'}
                  </p>
                </div>
              </div>
            </div>

            {mailItem.notes && (
              <div>
                <h2 className="font-semibold text-gray-900 mb-2">Notes</h2>
                <p className="text-gray-700 whitespace-pre-line">{mailItem.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

