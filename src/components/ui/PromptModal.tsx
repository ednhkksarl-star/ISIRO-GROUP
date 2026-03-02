'use client';

import { useState, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import Input from './Input';

interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
  title?: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  required?: boolean;
  type?: 'text' | 'number' | 'email' | 'tel';
}

export default function PromptModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Saisie',
  message,
  placeholder = '',
  defaultValue = '',
  confirmText = 'Valider',
  cancelText = 'Annuler',
  required = false,
  type = 'text',
}: PromptModalProps) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
    }
  }, [isOpen, defaultValue]);

  const handleConfirm = () => {
    if (required && !value.trim()) {
      return;
    }
    onConfirm(value);
    onClose();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      showCloseButton={true}
    >
      <div className="py-4 sm:py-6">
        {/* Icône */}
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
          <HelpCircle className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
        </div>

        {/* Titre */}
        {title && (
          <h3 className="text-xl sm:text-2xl font-bold text-text mb-3 sm:mb-4 text-center">
            {title}
          </h3>
        )}

        {/* Message */}
        <p className="text-text-light text-sm sm:text-base mb-4 sm:mb-6 text-center px-4">
          {message}
        </p>

        {/* Input */}
        <div className="mb-6 sm:mb-8 px-4">
          <Input
            type={type}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            required={required}
            autoFocus
            className="w-full"
          />
        </div>

        {/* Boutons */}
        <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 px-4">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={required && !value.trim()}
            className="w-full sm:w-auto"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

