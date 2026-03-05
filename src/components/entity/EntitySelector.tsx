'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Building2, Globe, Check } from 'lucide-react';
import { cn } from '@/utils/cn';
import { createSupabaseClient } from '@/services/supabaseClient';
import { normalizeEntityIds } from '@/utils/entityHelpers';
import Portal from '@/components/ui/Portal';

interface Entity { id: string; code: string; name: string; }

interface EntitySelectorProps {
  selectedEntityId: string | null;
  onSelectEntity: (entityId: string | null) => void;
  userRole: string;
  userEntityIds: string[] | null;
  className?: string;
  navigateOnSelect?: boolean;
  placement?: 'top' | 'bottom';
}

export default function EntitySelector({
  selectedEntityId, onSelectEntity, userRole, userEntityIds,
  className, navigateOnSelect = false, placement = 'bottom',
}: EntitySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const supabase = createSupabaseClient();
  const router = useRouter();

  const canViewAll = userRole === 'SUPER_ADMIN_GROUP' || userRole === 'ADMIN_ENTITY';

  useEffect(() => { fetchEntities(); }, []);

  const fetchEntities = async () => {
    try {
      const { data } = await supabase.from('entities').select('*').order('name', { ascending: true });
      setEntities(data || []);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => {
    const update = () => {
      if (isOpen && triggerRef.current) {
        const r = triggerRef.current.getBoundingClientRect();
        setCoords({ top: placement === 'top' ? r.top : r.bottom, left: r.left, width: Math.max(r.width, 220) });
      }
    };
    if (isOpen) { update(); window.addEventListener('scroll', update, true); window.addEventListener('resize', update); }
    return () => { window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); };
  }, [isOpen, placement]);

  const handleSelect = (entityId: string | null) => {
    onSelectEntity(entityId);
    setIsOpen(false);
    if (navigateOnSelect) router.push(entityId ? `/entities/${entityId}` : '/entities');
  };

  const selectedEntity = entities.find(e => {
    if (!selectedEntityId) return false;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedEntityId);
    return isUUID ? e.id === selectedEntityId : e.code === selectedEntityId;
  });

  useEffect(() => { if (selectedEntityId && !selectedEntity) fetchEntities(); }, [selectedEntityId]);

  const [normalizedEntityIds, setNormalizedEntityIds] = useState<string[]>([]);
  useEffect(() => {
    (async () => {
      if (!canViewAll && userEntityIds) {
        const arr = Array.isArray(userEntityIds)
          ? userEntityIds.filter((id): id is string => typeof id === 'string') : [];
        setNormalizedEntityIds(arr.length > 0 ? await normalizeEntityIds(arr) : []);
      } else { setNormalizedEntityIds([]); }
    })();
  }, [userEntityIds, canViewAll]);

  const accessibleEntities = useMemo(() => {
    if (canViewAll) return entities;
    return normalizedEntityIds.length > 0 ? entities.filter(e => normalizedEntityIds.includes(e.id)) : entities;
  }, [entities, normalizedEntityIds, canViewAll]);

  const label = selectedEntity?.name ?? 'Toutes les entités';
  const Icon = selectedEntity ? Building2 : Globe;

  /* ── dropdown style (fixed position portal) ── */
  const dropdownStyle: React.CSSProperties = {
    position: 'fixed',
    left: coords.left,
    minWidth: coords.width,
    zIndex: 9999,
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    boxShadow: '0 16px 40px -8px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)',
    borderRadius: 16,
    overflow: 'hidden',
    maxHeight: 288,
    overflowY: 'auto',
    ...(placement === 'top'
      ? { bottom: window.innerHeight - coords.top + 6 }
      : { top: coords.top + 6 }),
  };

  return (
    <div className={cn('relative inline-block', className)}>
      {/* ── Trigger ── */}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(v => !v)}
        className="flex items-center gap-1.5 h-8 pl-2.5 pr-2 rounded-xl transition-all duration-200 border"
        style={{
          background: '#f8fafc',
          borderColor: '#e2e8f0',
          color: '#475569',
          minWidth: 100,
          maxWidth: 190,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#10b981'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0'; }}
      >
        <Icon className="w-3 h-3 flex-shrink-0 text-emerald-500" strokeWidth={2} />
        <span className="text-[10px] font-black uppercase tracking-widest truncate flex-1 text-slate-700">{label}</span>
        <ChevronDown
          className="w-3 h-3 flex-shrink-0 text-slate-400 transition-transform duration-200"
          style={{ transform: isOpen ? 'rotate(180deg)' : undefined }}
        />
      </button>

      {/* ── Dropdown ── */}
      {isOpen && (
        <Portal>
          <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)} />
          <div style={dropdownStyle}>
            {/* All entities */}
            {canViewAll && (
              <button
                onClick={() => handleSelect(null)}
                className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-all duration-150"
                style={{
                  background: !selectedEntityId ? 'rgba(16,185,129,0.1)' : 'transparent',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                }}
                onMouseEnter={e => { if (selectedEntityId) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { if (selectedEntityId) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <Globe className="w-3.5 h-3.5 flex-shrink-0" style={{ color: !selectedEntityId ? '#10b981' : 'rgba(255,255,255,0.35)' }} />
                <span className="text-[10px] font-black uppercase tracking-widest flex-1" style={{ color: !selectedEntityId ? '#10b981' : 'rgba(255,255,255,0.55)' }}>
                  ISIRO GROUP (Tout)
                </span>
                {!selectedEntityId && <Check className="w-3 h-3 flex-shrink-0" style={{ color: '#10b981' }} />}
              </button>
            )}

            {loading ? (
              <div className="py-5 flex justify-center">
                <div className="w-5 h-5 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: '#10b981' }} />
              </div>
            ) : accessibleEntities.length === 0 ? (
              <div className="px-4 py-5 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                Aucune entité
              </div>
            ) : accessibleEntities.map(entity => {
              const isSel = selectedEntityId === entity.id;
              return (
                <button
                  key={entity.id}
                  onClick={() => handleSelect(entity.id)}
                  className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-all duration-150"
                  style={{ background: isSel ? 'rgba(16,185,129,0.08)' : 'transparent' }}
                  onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = '#f8fafc'; }}
                  onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <Building2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: isSel ? '#10b981' : '#94a3b8' }} />
                  <span className="text-[11px] font-bold flex-1 truncate" style={{ color: isSel ? '#059669' : '#475569' }}>
                    {entity.name}
                  </span>
                  {isSel && <Check className="w-3 h-3 flex-shrink-0 text-emerald-500" />}
                </button>
              );
            })}
          </div>
        </Portal>
      )}
    </div>
  );
}
