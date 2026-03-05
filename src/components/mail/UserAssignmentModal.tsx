'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { createSupabaseClient } from '@/services/supabaseClient';

interface User {
  id: string;
  full_name: string | null;
  email: string;
  entity_id: string | null;
}

interface Entity {
  id: string;
  name: string;
  code: string;
}

interface UserAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (userId: string | null) => void;
  currentUserId: string | null;
  profile: any;
}

export default function UserAssignmentModal({
  isOpen,
  onClose,
  onSelect,
  currentUserId,
  profile,
}: UserAssignmentModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const supabase = createSupabaseClient();

  useEffect(() => {
    if (isOpen) {
      fetchEntities();
      fetchUsers();
    } else {
      setSearchTerm('');
      setSelectedEntityId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEntityId, isOpen]);

  const fetchEntities = async () => {
    try {
      const { data, error } = await supabase
        .from('entities')
        .select('id, name, code')
        .order('name', { ascending: true });

      if (error) throw error;
      setEntities(data || []);
    } catch (error: any) {
      console.error('Erreur lors du chargement des entités:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      // Récupérer tous les utilisateurs actifs avec entity_ids
      const query = supabase
        .from('users')
        .select('id, full_name, email, entity_id, entity_ids')
        .eq('is_active', true)
        .order('full_name', { ascending: true });

      const { data, error } = await query;

      if (error) {
        console.error('Erreur Supabase lors du chargement des utilisateurs:', error);
        console.error('Code erreur:', error.code);
        console.error('Message:', error.message);
        console.error('Details:', error.details);
        console.error('Hint:', error.hint);
        throw error;
      }

      let filteredData = data || [];

      // Filtrer côté client si une entité est sélectionnée
      if (selectedEntityId) {
        console.log('Filtrage par entité (côté client):', selectedEntityId);
        filteredData = filteredData.filter((user: any) => {
          // Vérifier si entity_ids (array JSONB) contient l'ID sélectionné
          if (user.entity_ids && Array.isArray(user.entity_ids)) {
            return user.entity_ids.includes(selectedEntityId);
          }
          // Fallback: vérifier aussi entity_id si entity_ids n'est pas défini
          return user.entity_id === selectedEntityId;
        });
        console.log('Utilisateurs trouvés pour l\'entité', selectedEntityId, ':', filteredData.length);
        filteredData.forEach((user: any) => {
          console.log('  -', user.full_name || user.email, '(entity_id:', user.entity_id, ', entity_ids:', user.entity_ids, ')');
        });
      } else {
        console.log('Chargement de tous les utilisateurs actifs (sans filtre):', filteredData.length);
      }

      setUsers(filteredData);
    } catch (error: any) {
      console.error('Erreur lors du chargement des utilisateurs:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!searchTerm) return users;

    const term = searchTerm.toLowerCase();
    return users.filter(
      (user) =>
        (user.full_name || '').toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term)
    );
  }, [users, searchTerm]);

  const handleSelect = (userId: string | null) => {
    onSelect(userId);
    onClose();
  };

  const getEntityName = (entityId: string | null) => {
    if (!entityId) return '';
    const entity = entities.find((e) => e.id === entityId);
    return entity ? `${entity.name} (${entity.code})` : '';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Assigner à un utilisateur"
      size="lg"
    >
      <div className="space-y-6">
        {/* Filtre par entité */}
        <div>
          <label htmlFor="entity-filter" className="block text-[10px] font-black uppercase tracking-widest text-emerald-800/40 mb-3 ml-1">
            Filtrer par entité
          </label>
          <select
            id="entity-filter"
            name="entity-filter"
            value={selectedEntityId || ''}
            onChange={(e) => setSelectedEntityId(e.target.value || null)}
            className="w-full px-4 py-3 bg-white border-2 border-emerald-100 rounded-xl text-sm font-bold text-emerald-950 outline-none focus:border-emerald-500 transition-all appearance-none cursor-pointer"
          >
            <option value="">Toutes les entités</option>
            {entities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.name} ({entity.code})
              </option>
            ))}
          </select>
        </div>

        {/* Recherche */}
        <div className="relative">
          <label htmlFor="user-search" className="sr-only">
            Rechercher un utilisateur
          </label>
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-emerald-400 w-5 h-5" />
          <input
            id="user-search"
            name="user-search"
            type="text"
            placeholder="Rechercher un utilisateur..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border-2 border-emerald-100 rounded-xl text-sm font-bold text-emerald-950 outline-none focus:border-emerald-500 transition-all placeholder:text-emerald-200"
          />
        </div>

        {/* Liste des utilisateurs */}
        <div className="border-2 border-emerald-100 rounded-xl max-h-96 overflow-y-auto bg-white shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-emerald-800/30 font-black uppercase tracking-widest text-xs">Chargement...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center text-emerald-800/30 font-black uppercase tracking-widest text-xs">
              Aucun utilisateur trouvé
            </div>
          ) : (
            <div className="divide-y-2 divide-emerald-50">
              <button
                onClick={() => handleSelect(null)}
                className={`w-full px-6 py-4 text-left hover:bg-emerald-50 transition-all relative group ${!currentUserId ? 'bg-emerald-100/30' : ''
                  }`}
              >
                {!currentUserId && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-yellow-400 rounded-r-full" />}
                <div className="font-black text-emerald-950 uppercase tracking-tight text-sm">Non assigné</div>
              </button>
              {filteredUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleSelect(user.id)}
                  className={`w-full px-6 py-4 text-left hover:bg-emerald-50 transition-all relative group ${currentUserId === user.id ? 'bg-emerald-100/30' : ''
                    }`}
                >
                  {currentUserId === user.id && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-yellow-400 rounded-r-full" />}
                  <div className="font-black text-emerald-950 uppercase tracking-tight text-sm">
                    {user.full_name || user.email}
                  </div>
                  <div className="text-[10px] font-bold text-emerald-600 tracking-tight mt-0.5">{user.email}</div>
                  {user.entity_id && (
                    <div className="text-[9px] font-black uppercase tracking-widest text-emerald-800/40 mt-2">
                      {getEntityName(user.entity_id)}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-8 pt-6 border-t-2 border-emerald-50">
        <Button variant="secondary" onClick={onClose} className="bg-white border-2 border-emerald-100 text-emerald-600 hover:bg-emerald-50 rounded-xl px-8 h-12 text-[10px] font-black uppercase tracking-widest">
          Annuler
        </Button>
      </div>
    </Modal>
  );
}

