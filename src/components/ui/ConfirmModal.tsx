'use client';

import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

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
      icon: 'text-error',
      bg: 'bg-error/10',
      button: 'bg-error hover:bg-red-600',
    },
    warning: {
      icon: 'text-warning',
      bg: 'bg-warning/10',
      button: 'bg-warning hover:bg-yellow-600',
    },
    info: {
      icon: 'text-primary',
      bg: 'bg-primary/10',
      button: 'bg-primary hover:bg-primary-dark',
    },
  };

  const styles = variantStyles[variant];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      showCloseButton={true}
    >
      <div className="text-center py-4 sm:py-6">
        {/* Icône */}
        <div
          className={`w-16 h-16 sm:w-20 sm:h-20 ${styles.bg} rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6`}
        >
          <AlertTriangle className={`w-8 h-8 sm:w-10 sm:h-10 ${styles.icon}`} />
        </div>

        {/* Titre */}
        {title && (
          <h3 className="text-xl sm:text-2xl font-bold text-text mb-3 sm:mb-4">
            {title}
          </h3>
        )}

        {/* Message */}
        <p className="text-text-light text-sm sm:text-base mb-6 sm:mb-8 px-4">
          {message}
        </p>

        {/* Boutons */}
        <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 px-4">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            loading={loading}
            className={`w-full sm:w-auto ${styles.button} text-white`}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

