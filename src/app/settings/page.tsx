'use client';

import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import Link from 'next/link';
import { User, Shield, Bell, Lock, DollarSign, ArrowRight, Settings, Database } from 'lucide-react';
import { cn } from '@/utils/cn';

export default function SettingsPage() {
  const { profile } = useAuth();

  const settingsItems = [
    {
      title: 'Profil',
      description: 'Gérez vos informations personnelles et photo de profil',
      icon: User,
      href: '/settings/profile',
      color: 'emerald',
    },
    {
      title: 'Taux de change',
      description: 'Gérez les taux de change USD/CDF pour les transactions',
      icon: DollarSign,
      href: '/settings/exchange-rates',
      roles: ['SUPER_ADMIN_GROUP', 'ADMIN_ENTITY', 'ACCOUNTANT'],
      color: 'emerald',
    },
    {
      title: 'Sécurité',
      description: 'Protégez votre compte et modifiez votre mot de passe',
      icon: Lock,
      href: '/settings/security',
      color: 'emerald',
    },
    {
      title: 'Export / Import des données',
      description: 'Exporter ou importer toutes les données de l\'application (sauvegarde, migration)',
      icon: Database,
      href: '/settings/data-export-import',
      roles: ['SUPER_ADMIN_GROUP'],
      color: 'emerald',
    },
    {
      title: 'Notifications',
      description: 'Gérez vos préférences de notifications système',
      icon: Bell,
      href: '/settings/notifications',
      disabled: true,
      color: 'gray',
    },
  ].filter((item) => {
    if (item.roles && profile) {
      return item.roles.includes(profile.role);
    }
    return true;
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header Block: Vibrant Minimalist */}
        <div className="bg-white border-2 border-emerald-100 p-8 sm:p-10 rounded-[2rem] relative overflow-hidden group hover:border-emerald-300 transition-all duration-700 shadow-sm">
          {/* Decorative Circle */}
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-emerald-50 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-700" />
          <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-yellow-50 rounded-full opacity-30 group-hover:scale-125 transition-transform duration-700" />

          <div className="relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-100">
              <Settings className="w-4 h-4 text-emerald-600" />
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800">Préférences Système</span>
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-emerald-950 uppercase leading-none">Paramètres</h1>
              <div className="h-1.5 w-24 bg-yellow-400 mt-4 rounded-full" />
            </div>
            <p className="text-emerald-800/60 text-sm font-bold max-w-md">
              Configurez votre expérience et gérez la sécurité de votre compte ISIRO.
            </p>
          </div>
        </div>

        {/* Settings Navigation Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {settingsItems.map((item, idx) => {
            const isAvailable = !item.disabled;

            return (
              <Link
                key={item.href}
                href={isAvailable ? item.href : '#'}
                className={cn(
                  "group bg-white border-2 p-6 rounded-2xl relative overflow-hidden transition-all duration-500 shadow-sm",
                  isAvailable
                    ? "border-emerald-100 hover:border-emerald-300 cursor-pointer"
                    : "border-gray-100 opacity-60 cursor-not-allowed"
                )}
              >
                {/* Visual Accent */}
                {isAvailable && (
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
                )}

                <div className="flex items-start gap-5 relative z-10">
                  <div className={cn(
                    "w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-500",
                    isAvailable
                      ? "bg-emerald-50 text-emerald-600 border border-emerald-100 group-hover:bg-emerald-600 group-hover:text-white"
                      : "bg-gray-50 text-gray-400 border border-gray-100"
                  )}>
                    <item.icon className="w-7 h-7" />
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <h3 className={cn(
                        "text-lg font-black uppercase tracking-tight transition-colors",
                        isAvailable ? "text-emerald-950 group-hover:text-emerald-600" : "text-gray-400"
                      )}>
                        {item.title}
                      </h3>
                      {isAvailable && (
                        <ArrowRight className="w-4 h-4 text-emerald-300 group-hover:text-emerald-600 transform group-hover:translate-x-1 transition-all" />
                      )}
                    </div>
                    <p className={cn(
                      "text-xs font-bold leading-relaxed",
                      isAvailable ? "text-emerald-800/60" : "text-gray-300"
                    )}>
                      {item.description}
                    </p>
                    {item.disabled && (
                      <span className="inline-block mt-2 px-2 py-0.5 bg-gray-50 text-gray-400 text-[10px] font-black uppercase tracking-widest rounded border border-gray-100">
                        Bientôt disponible
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}

