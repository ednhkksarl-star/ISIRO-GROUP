'use client';

import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import { User, Shield, Bell, Lock, DollarSign } from 'lucide-react';

export default function SettingsPage() {
  const { profile } = useAuth();

  const canManageRates = profile?.role === 'SUPER_ADMIN_GROUP' || 
                         profile?.role === 'ADMIN_ENTITY' || 
                         profile?.role === 'ACCOUNTANT';

  const settingsItems = [
    {
      title: 'Profil',
      description: 'Gérer vos informations personnelles et photo de profil',
      icon: User,
      href: '/settings/profile',
    },
    {
      title: 'Taux de change',
      description: 'Gérer les taux de change USD/CDF',
      icon: DollarSign,
      href: '/settings/exchange-rates',
      roles: ['SUPER_ADMIN_GROUP', 'ADMIN_ENTITY', 'ACCOUNTANT'],
    },
    {
      title: 'Sécurité',
      description: 'Modifier votre mot de passe',
      icon: Lock,
      href: '/settings/security',
      disabled: false,
    },
    {
      title: 'Notifications',
      description: 'Gérer vos préférences de notifications',
      icon: Bell,
      href: '/settings/notifications',
      disabled: true,
    },
  ].filter((item) => {
    // Filtrer selon les rôles si spécifié
    if (item.roles && profile) {
      return item.roles.includes(profile.role);
    }
    return true;
  });

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text">Paramètres</h1>
          <p className="text-text-light mt-1 text-sm sm:text-base">
            Gérez vos paramètres et préférences
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {settingsItems.map((item) => {
            const Icon = item.icon;
            const content = (
              <Card hover={!item.disabled} className={item.disabled ? 'opacity-50' : ''}>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base sm:text-lg font-semibold text-text mb-1">
                      {item.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-text-light">
                      {item.description}
                    </p>
                    {item.disabled && (
                      <span className="inline-block mt-2 text-xs text-text-light bg-gray-100 px-2 py-1 rounded">
                        Bientôt disponible
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            );

            if (item.disabled) {
              return <div key={item.href}>{content}</div>;
            }

            return (
              <Link key={item.href} href={item.href}>
                {content}
              </Link>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}

