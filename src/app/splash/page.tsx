'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/Providers';
import Image from 'next/image';

export default function SplashPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Afficher le splash pendant au moins 2 secondes
    const splashTimer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);

    return () => clearTimeout(splashTimer);
  }, []);

  useEffect(() => {
    // Ne rediriger que lorsque le splash est terminé et que l'auth est chargée
    if (!showSplash && !loading) {
      if (user && profile?.is_active) {
        router.replace('/dashboard');
      } else {
        router.replace('/auth/login');
      }
    }
  }, [showSplash, loading, user, profile, router]);

  return (
    <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
      <div className="flex flex-col items-center justify-center space-y-6 animate-fade-in">
        {/* Logo avec animation */}
        <div className="relative w-48 h-48 sm:w-64 sm:h-64 animate-pulse-slow">
          <Image
            src="/logo_isiro.png"
            alt="ISIRO GROUP"
            fill
            className="object-contain"
            priority
            unoptimized
          />
        </div>
        
        {/* Texte de chargement */}
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>

    </div>
  );
}

