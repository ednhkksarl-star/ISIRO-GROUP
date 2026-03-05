'use client';

import { User as UserIcon, Mail, Shield, Calendar, Building, CheckCircle, XCircle } from 'lucide-react';
import Image from 'next/image';
import Modal from '@/components/ui/Modal';
import { getRoleLabel } from '@/utils/roleTranslations';
import { cn } from '@/utils/cn';
import type { Database } from '@/types/database.types';

type User = Database['public']['Tables']['users']['Row'];

interface UserProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User | null;
}

export default function UserProfileModal({ isOpen, onClose, user }: UserProfileModalProps) {
    if (!user) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Profil Utilisateur"
            size="md"
        >
            <div className="space-y-8 py-2">
                {/* Profile Header Card */}
                <div className="bg-emerald-50/50 border-2 border-emerald-100 p-6 rounded-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-100 rounded-full -mr-16 -mt-16 transition-transform duration-500 group-hover:scale-110 opacity-50" />

                    <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6">
                        <div className="relative w-24 h-24 group-hover:scale-105 transition-transform duration-500">
                            <div className="absolute inset-0 bg-emerald-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                            {user.avatar_url ? (
                                <div className="w-full h-full rounded-2xl overflow-hidden bg-white shadow-xl shadow-emerald-500/10 border-2 border-emerald-100 flex items-center justify-center relative z-10 transition-colors">
                                    <Image
                                        src={user.avatar_url}
                                        alt={user.full_name || user.email}
                                        width={96}
                                        height={96}
                                        className="object-cover"
                                        unoptimized
                                    />
                                </div>
                            ) : (
                                <div className="w-full h-full rounded-2xl bg-white border-2 border-emerald-100 flex items-center justify-center text-emerald-300 relative z-10 transition-colors transition-colors">
                                    <UserIcon className="w-12 h-12" />
                                </div>
                            )}
                        </div>

                        <div className="text-center sm:text-left space-y-2">
                            <h2 className="text-2xl font-black text-emerald-950 uppercase tracking-tight leading-tight">
                                {user.full_name || "Utilisateur"}
                            </h2>
                            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                                <span className="px-3 py-1 bg-emerald-950 text-white rounded-lg text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-emerald-900/20">
                                    {getRoleLabel(user.role)}
                                </span>
                                <div className={cn(
                                    "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 border",
                                    user.is_active
                                        ? "bg-emerald-100 border-emerald-200 text-emerald-700"
                                        : "bg-rose-100 border-rose-200 text-rose-700"
                                )}>
                                    {user.is_active ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                    {user.is_active ? "Actif" : "Inactif"}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-white border-2 border-emerald-50 p-5 rounded-xl space-y-4 shadow-sm hover:border-emerald-100 transition-colors group">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Mail className="w-4 h-4 text-emerald-600" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-[9px] font-black text-emerald-800/40 uppercase tracking-widest">Email</p>
                                <p className="text-xs font-bold text-emerald-950 truncate max-w-[150px]">{user.email}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border-2 border-emerald-50 p-5 rounded-xl space-y-4 shadow-sm hover:border-emerald-100 transition-colors group">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Building className="w-4 h-4 text-emerald-600" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-[9px] font-black text-emerald-800/40 uppercase tracking-widest">Accès Entités</p>
                                <p className="text-xs font-bold text-emerald-950">
                                    {user.entity_ids && user.entity_ids.length > 0
                                        ? `${user.entity_ids.length} entité(s)`
                                        : user.entity_id
                                            ? '1 entité'
                                            : 'Toutes les entitiés'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border-2 border-emerald-50 p-5 rounded-xl space-y-4 shadow-sm hover:border-emerald-100 transition-colors group">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Shield className="w-4 h-4 text-emerald-600" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-[9px] font-black text-emerald-800/40 uppercase tracking-widest">Rôle Système</p>
                                <p className="text-xs font-bold text-emerald-950 uppercase">{user.role}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border-2 border-emerald-50 p-5 rounded-xl space-y-4 shadow-sm hover:border-emerald-100 transition-colors group">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Calendar className="w-4 h-4 text-emerald-600" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-[9px] font-black text-emerald-800/40 uppercase tracking-widest">Membre depuis</p>
                                <p className="text-xs font-bold text-emerald-950">
                                    {new Date(user.created_at).toLocaleDateString('fr-FR', {
                                        day: 'numeric',
                                        month: 'long',
                                        year: 'numeric',
                                    })}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer info */}
                <div className="pt-2 text-center">
                    <p className="text-[9px] font-black text-emerald-800/20 uppercase tracking-[0.3em]">Isiro Group • Directory Services</p>
                </div>
            </div>
        </Modal>
    );
}
