'use client';

import { Menu, Power, User, Building2, X } from 'lucide-react';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/utils/cn';
import EntitySelector from '@/components/entity/EntitySelector';
import { useEntity } from '@/hooks/useEntity';
import { createSupabaseClient } from '@/services/supabaseClient';
import { getEntityUUID } from '@/utils/entityHelpers';
import { getRoleLabel } from '@/utils/roleTranslations';
import type { UserRole } from '@/types/database.types';
import type { Database } from '@/types/database.types';

type Entity = Database['public']['Tables']['entities']['Row'];

interface HeaderProps {
  onMenuClick: () => void;
  onToggleSidebar?: () => void;
  sidebarCollapsed?: boolean;
  user: {
    full_name: string | null;
    email: string;
    role: UserRole;
    entity_id: string | null;
    entity_ids: string[] | null;
    avatar_url: string | null;
  };
  onSignOut: () => Promise<void>;
}

/* ── Logout Modal ── */
function LogoutModal({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl p-7 flex flex-col gap-5 bg-white"
        style={{
          boxShadow: '0 32px 72px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)',
          animation: 'modalIn 0.25s cubic-bezier(0.16,1,0.3,1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 flex items-center justify-center w-7 h-7 rounded-xl bg-slate-100 text-slate-400 hover:bg-slate-200 transition-all"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
            <Power className="w-6 h-6" style={{ color: '#ef4444' }} />
          </div>
        </div>

        <div className="text-center">
          <h3 className="text-lg font-black text-slate-900 tracking-tight">Se déconnecter ?</h3>
          <p className="text-sm mt-1.5 text-slate-500 leading-relaxed">
            Bonjour <span className="font-bold text-slate-800">{name}</span>,<br />
            votre session sera terminée.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 h-10 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 h-10 rounded-2xl text-[11px] font-black uppercase tracking-widest text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 4px 16px -4px rgba(239,68,68,0.4)' }}
          >
            Déconnecter
          </button>
        </div>
      </div>
      <style jsx global>{`
        @keyframes modalIn { from { opacity:0; transform:scale(0.94) translateY(10px);} to { opacity:1; transform:scale(1) translateY(0);} }
      `}</style>
    </div>
  );
}

/* ── Header ── */
export default function Header({ onMenuClick, sidebarCollapsed = false, user, onSignOut }: HeaderProps) {
  const { selectedEntityId, setSelectedEntityId } = useEntity();
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createSupabaseClient();
  const [currentEntity, setCurrentEntity] = useState<Entity | null>(null);
  const [loadingEntity, setLoadingEntity] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const entityIdFromPath = pathname?.startsWith('/entities/')
    ? pathname.split('/entities/')[1]?.split('/')[0] : null;

  const isAdmin = user.role === 'SUPER_ADMIN_GROUP' || user.role === 'ADMIN_ENTITY';
  let activeEntityId: string | null = null;
  if (entityIdFromPath) activeEntityId = entityIdFromPath;
  else if (isAdmin) activeEntityId = selectedEntityId ?? null;
  else activeEntityId = selectedEntityId || user.entity_id || user.entity_ids?.[0] || null;

  useEffect(() => {
    (async () => {
      if (!activeEntityId) { setCurrentEntity(null); setLoadingEntity(false); return; }
      try {
        setLoadingEntity(true);
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activeEntityId!);
        const { data } = await supabase.from('entities').select('id, name, logo_url, code')
          .eq(isUUID ? 'id' : 'code', activeEntityId!).maybeSingle();
        setCurrentEntity(data);
      } catch { setCurrentEntity(null); }
      finally { setLoadingEntity(false); }
    })();
  }, [activeEntityId]);

  const canSelectEntity = isAdmin || (user.entity_ids && user.entity_ids.length > 1);

  return (
    <>
      {/* ── Header bar — frosted WHITE glass ── */}
      <header
        className={cn(
          'fixed top-0 right-0 z-40 flex items-center h-14 transition-all duration-300',
          sidebarCollapsed ? 'left-0 lg:left-[72px]' : 'left-0 lg:left-[256px]',
        )}
        style={{
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(0,0,0,0.07)',
          boxShadow: '0 1px 12px rgba(0,0,0,0.05)',
        }}
      >
        <div className="flex-1 flex items-center justify-between px-4 sm:px-6">

          {/* Left */}
          <div className="flex items-center gap-3">
            <button
              onClick={onMenuClick}
              className="lg:hidden flex items-center justify-center w-8 h-8 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5">
              {currentEntity && !loadingEntity ? (
                <>
                  <div className="w-7 h-7 rounded-xl overflow-hidden relative flex-shrink-0 bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                    {currentEntity.logo_url
                      ? <Image src={currentEntity.logo_url} alt="" fill className="object-contain p-1" unoptimized />
                      : <Building2 className="w-3.5 h-3.5 text-emerald-600" />}
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-800 hidden sm:block">
                    {currentEntity.name}
                  </span>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse bg-emerald-500" />
                  <span className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-500">
                    Récapitulatif Global
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Entity Selector */}
            {canSelectEntity && (
              <div className="hidden md:block">
                <EntitySelector
                  selectedEntityId={selectedEntityId}
                  onSelectEntity={async (entityId) => {
                    setSelectedEntityId(entityId);
                    if (!entityId) router.push('/dashboard');
                    else {
                      const uuid = await getEntityUUID(entityId);
                      if (uuid) router.push(`/entities/${uuid}`);
                    }
                  }}
                  userRole={user.role}
                  userEntityIds={user.entity_ids || []}
                />
              </div>
            )}

            <div className="w-px h-5 bg-slate-200 hidden sm:block" />

            {/* User pill */}
            <div className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-2xl bg-slate-50 border border-slate-200">
              {/* Avatar */}
              <div className="relative w-7 h-7 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0 bg-emerald-100 border border-emerald-200">
                {user.avatar_url
                  ? <Image src={user.avatar_url} alt="" fill className="object-cover" unoptimized />
                  : <User className="w-3.5 h-3.5 text-emerald-600" />}
              </div>

              {/* Name + Role */}
              <div className="hidden sm:block text-left">
                <p className="text-[10px] font-black text-slate-800 uppercase leading-none tracking-wider">
                  {user.full_name?.split(' ')[0] || '—'}
                </p>
                <p className="text-[8px] font-bold uppercase tracking-widest mt-0.5 text-emerald-600">
                  {getRoleLabel(user.role)}
                </p>
              </div>

              {/* Power button */}
              <button
                onClick={() => setShowLogoutModal(true)}
                title="Se déconnecter"
                className="flex items-center justify-center w-6 h-6 rounded-lg ml-1 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200"
              >
                <Power className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {showLogoutModal && (
        <LogoutModal
          name={user.full_name?.split(' ')[0] || user.email}
          onConfirm={async () => { await onSignOut(); setShowLogoutModal(false); }}
          onCancel={() => setShowLogoutModal(false)}
        />
      )}
    </>
  );
}
