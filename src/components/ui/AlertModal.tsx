'use client';

import { CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

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
      iconColor: 'text-green-600',
      bg: 'bg-green-100',
      title: title || 'Succès',
    },
    error: {
      icon: XCircle,
      iconColor: 'text-error',
      bg: 'bg-error/10',
      title: title || 'Erreur',
    },
    warning: {
      icon: AlertTriangle,
      iconColor: 'text-warning',
      bg: 'bg-warning/10',
      title: title || 'Attention',
    },
    info: {
      icon: Info,
      iconColor: 'text-primary',
      bg: 'bg-primary/10',
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
      <div className="text-center py-4 sm:py-6">
        {/* Icône */}
        <div
          className={`w-16 h-16 sm:w-20 sm:h-20 ${styles.bg} rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 animate-bounce-light`}
        >
          <Icon className={`w-8 h-8 sm:w-10 sm:h-10 ${styles.iconColor}`} />
        </div>

        {/* Titre */}
        <h3 className="text-xl sm:text-2xl font-bold text-text mb-3 sm:mb-4">
          {styles.title}
        </h3>

        {/* Message */}
        <p className="text-text-light text-sm sm:text-base mb-6 sm:mb-8 px-4">
          {message}
        </p>

        {/* Bouton */}
        {!autoClose && (
          <div className="flex justify-center px-4">
            <Button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto min-w-[120px]"
            >
              {confirmText}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

