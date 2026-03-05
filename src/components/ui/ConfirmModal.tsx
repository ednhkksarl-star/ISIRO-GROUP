'use client';

import { AlertTriangle, Trash2, Info, HelpCircle } from 'lucide-react';
import Modal from './Modal';
import { cn } from '@/utils/cn';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirmation',
  message,
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  variant = 'danger',
  loading = false,
}: ConfirmModalProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const variantStyles = {
    danger: {
      icon: Trash2,
      iconColor: 'text-rose-600',
      bg: 'bg-rose-50 border-2 border-rose-100',
      shadow: '',
      button: 'bg-rose-500 hover:bg-rose-600 border-rose-700 shadow-rose-200',
    },
    warning: {
      icon: AlertTriangle,
      iconColor: 'text-amber-600',
      bg: 'bg-amber-50 border-2 border-amber-100',
      shadow: '',
      button: 'bg-amber-500 hover:bg-amber-600 border-amber-700 shadow-amber-200',
    },
    info: {
      icon: HelpCircle,
      iconColor: 'text-emerald-600',
      bg: 'bg-emerald-50 border-2 border-emerald-100',
      shadow: '',
      button: 'bg-emerald-500 hover:bg-emerald-600 border-emerald-700 shadow-emerald-200',
    },
  };

  const styles = variantStyles[variant];
  const Icon = styles.icon;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      showCloseButton={true}
    >
      <div className="text-center py-4 px-2">
        {/* Icon Container */}
        <div className="relative mx-auto mb-6">
          <div className={cn(
            "w-16 h-16 rounded-2xl flex items-center justify-center mx-auto animate-in scale-in duration-500",
            styles.bg,
            "shadow-sm"
          )}>
            <Icon className={cn("w-8 h-8", styles.iconColor)} />
          </div>
        </div>

        {/* Title & Description */}
        <div className="space-y-2 mb-8">
          <h3 className="text-xl sm:text-2xl font-black text-emerald-950 tracking-tight uppercase">
            {title}
          </h3>
          <p className="text-emerald-800/40 text-[10px] font-bold uppercase tracking-widest leading-relaxed max-w-xs mx-auto">
            {message}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 h-11 bg-white border-2 border-emerald-100 text-emerald-800 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-50 transition-all active:scale-95"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className={cn(
              "flex-1 h-11 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all active:scale-95 border-b-4",
              styles.button,
              loading && "opacity-50"
            )}
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}

