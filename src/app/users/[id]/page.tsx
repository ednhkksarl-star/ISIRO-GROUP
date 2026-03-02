'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { ArrowLeft, User as UserIcon } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'react-toastify';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import type { Database } from '@/types/database.types';

type User = Database['public']['Tables']['users']['Row'];

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuth();
  const supabase = createSupabaseClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      fetchUser();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const fetchUser = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', params.id)
        .maybeSingle();

      if (error) throw error;
      setUser(data);
    } catch (error: any) {
      toast.error('Erreur lors du chargement de l\'utilisateur');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  if (!user) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Utilisateur non trouvé</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/users"
            className="flex items-center gap-2 text-text-light hover:text-text transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm sm:text-base">Retour</span>
          </Link>
          {profile?.role === 'SUPER_ADMIN_GROUP' && (
            <Link
              href={`/users/${user.id}/edit`}
              prefetch={false}
              className="text-primary hover:text-primary-dark text-sm sm:text-base font-medium"
            >
              Modifier
            </Link>
          )}
        </div>

        <Card>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
            {user.avatar_url ? (
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden ring-2 ring-primary/20 flex-shrink-0">
                <Image
                  src={user.avatar_url}
                  alt={user.full_name || user.email}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <UserIcon className="w-10 h-10 sm:w-12 sm:h-12 text-primary" />
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-text mb-1">
                {user.full_name || user.email}
              </h1>
              {user.full_name && (
                <p className="text-text-light text-sm sm:text-base mb-3">{user.email}</p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="info">{user.role.replace(/_/g, ' ')}</Badge>
                <Badge variant={user.is_active ? 'success' : 'error'}>
                  {user.is_active ? 'Actif' : 'Inactif'}
                </Badge>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <Card>
            <h2 className="text-base sm:text-lg font-semibold text-text mb-4">
              Informations
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs sm:text-sm text-text-light">Email</p>
                <p className="text-sm sm:text-base font-medium text-text">{user.email}</p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-text-light">Nom complet</p>
                <p className="text-sm sm:text-base font-medium text-text">
                  {user.full_name || '-'}
                </p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-text-light">Rôle</p>
                <p className="text-sm sm:text-base font-medium text-text">
                  {user.role.replace(/_/g, ' ')}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="text-base sm:text-lg font-semibold text-text mb-4">
              Accès
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs sm:text-sm text-text-light">Entités accessibles</p>
                <p className="text-sm sm:text-base font-medium text-text">
                  {user.entity_ids && user.entity_ids.length > 0
                    ? `${user.entity_ids.length} entité(s)`
                    : user.entity_id
                    ? '1 entité'
                    : 'Toutes les entités'}
                </p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-text-light">Date de création</p>
                <p className="text-sm sm:text-base font-medium text-text">
                  {new Date(user.created_at).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

