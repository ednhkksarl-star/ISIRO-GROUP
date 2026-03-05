'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, Lock, DollarSign, Bell } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuth } from '@/components/providers/Providers';

export default function SettingsTabs() {
    const pathname = usePathname();
    const { profile } = useAuth();

    const tabs = [
        {
            label: 'Profil',
            href: '/settings/profile',
            icon: User,
        },
        {
            label: 'Taux de change',
            href: '/settings/exchange-rates',
            icon: DollarSign,
            roles: ['SUPER_ADMIN_GROUP', 'ADMIN_ENTITY', 'ACCOUNTANT'],
        },
        {
            label: 'Sécurité',
            href: '/settings/security',
            icon: Lock,
        },
        {
            label: 'Notifications',
            href: '/settings/notifications',
            icon: Bell,
            disabled: true,
        },
    ].filter((tab) => {
        if (tab.roles && profile) {
            return tab.roles.includes(profile.role);
        }
        return true;
    });

    return (
        <div className="flex items-center gap-2 p-1.5 bg-emerald-50 border-2 border-emerald-100 rounded-2xl mb-8 overflow-x-auto no-scrollbar">
            {tabs.map((tab) => {
                const isActive = pathname === tab.href;
                const isAvailable = !tab.disabled;

                return (
                    <Link
                        key={tab.href}
                        href={isAvailable ? tab.href : '#'}
                        className={cn(
                            "flex items-center gap-2.5 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 whitespace-nowrap",
                            isActive
                                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200 ring-2 ring-emerald-600 ring-offset-2"
                                : isAvailable
                                    ? "text-emerald-800/60 hover:bg-white hover:text-emerald-600"
                                    : "text-emerald-800/20 cursor-not-allowed"
                        )}
                    >
                        <tab.icon className={cn("w-4 h-4", isActive ? "stroke-[3]" : "stroke-[2.5]")} />
                        {tab.label}
                    </Link>
                );
            })}
        </div>
    );
}
