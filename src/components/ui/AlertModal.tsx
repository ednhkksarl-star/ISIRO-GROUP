'use client';

import { CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react';
import Modal from './Modal';
import { cn } from '@/utils/cn';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  variant?: 'success' | 'error' | 'warning' | 'info';
  confirmText?: string;
  autoClose?: boolean;
  autoCloseDelay?: number;
}

export default function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  variant = 'info',
  confirmText = 'OK',
  autoClose = false,
  autoCloseDelay = 3000,
}: AlertModalProps) {
  // Auto-close si activé
  if (isOpen && autoClose) {
    setTimeout(() => {
      onClose();
    }, autoCloseDelay);
  }

  const variantStyles = {
    success: {
      icon: CheckCircle,
      iconColor: 'text-white',
      bg: 'bg-gradient-to-br from-emerald-400 to-emerald-600',
      shadow: 'shadow-emerald-200',
      title: title || 'Succès',
    },
    error: {
      icon: XCircle,
      iconColor: 'text-white',
      bg: 'bg-gradient-to-br from-rose-400 to-rose-600',
      shadow: 'shadow-rose-200',
      title: title || 'Erreur',
    },
    warning: {
      icon: AlertTriangle,
      iconColor: 'text-white',
      bg: 'bg-gradient-to-br from-amber-400 to-amber-600',
      shadow: 'shadow-amber-200',
      title: title || 'Attention',
    },
    info: {
      icon: Info,
      iconColor: 'text-white',
      bg: 'bg-gradient-to-br from-sky-400 to-sky-600',
      shadow: 'shadow-sky-200',
      title: title || 'Information',
    },
  };

  const styles = variantStyles[variant];
  const Icon = styles.icon;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      showCloseButton={!autoClose}
    >
      <div className="text-center py-6 sm:py-8 px-4">
        {/* Icon with Ring and Pulse Effect */}
        <div className="relative mx-auto mb-8">
          <div className={cn(
            "w-20 h-20 sm:w-24 sm:h-24 rounded-3xl flex items-center justify-center mx-auto animate-in scale-in duration-500",
            styles.bg,
            styles.shadow,
            "shadow-2xl"
          )}>
            <Icon className={cn("w-10 h-10 sm:w-12 sm:h-12", styles.iconColor)} />
          </div>
          {/* Subtle pulse ring */}
          <div className={cn(
            "absolute inset-0 w-20 h-20 sm:w-24 sm:h-24 rounded-3xl mx-auto animate-ping opacity-20 -z-10",
            styles.bg
          )} />
        </div>

        {/* Title & Description */}
        <div className="space-y-3 mb-8">
          <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {styles.title}
          </h3>
          <p className="text-slate-500 text-sm sm:text-base font-medium leading-relaxed max-w-xs mx-auto">
            {message}
          </p>
        </div>

        {/* Action Button */}
        {!autoClose && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "w-full sm:w-auto min-w-[160px] py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all",
                "bg-slate-900 text-white hover:scale-105 active:scale-95 shadow-xl shadow-slate-900/20"
              )}
            >
              {confirmText}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

