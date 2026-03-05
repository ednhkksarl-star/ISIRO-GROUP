'use client';

import { useState, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';
import Modal from './Modal';
import { cn } from '@/utils/cn';

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
      <div className="text-center py-6 sm:py-8 px-4">
        {/* Icon Container */}
        <div className="relative mx-auto mb-8">
          <div className={cn(
            "w-20 h-20 sm:w-24 sm:h-24 rounded-3xl flex items-center justify-center mx-auto animate-in scale-in duration-500",
            "bg-gradient-to-br from-sky-400 to-sky-600 shadow-sky-200",
            "shadow-2xl"
          )}>
            <HelpCircle className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
          </div>
          {/* Subtle pulse ring */}
          <div className={cn(
            "absolute inset-0 w-20 h-20 sm:w-24 sm:h-24 rounded-3xl mx-auto animate-ping opacity-20 -z-10",
            "bg-sky-400"
          )} />
        </div>

        {/* Title & Description */}
        <div className="space-y-3 mb-8 text-center">
          <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {title}
          </h3>
          <p className="text-slate-500 text-sm sm:text-base font-medium leading-relaxed max-w-xs mx-auto">
            {message}
          </p>
        </div>

        {/* Input Field */}
        <div className="mb-8">
          <input
            type={type}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            required={required}
            autoFocus
            className={cn(
              "w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none",
              "focus:bg-white focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 transition-all text-center placeholder:text-slate-300"
            )}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:bg-slate-200 transition-all active:scale-95"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={required && !value.trim()}
            className={cn(
              "flex-1 py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] text-white transition-all hover:scale-105 active:scale-95 shadow-xl",
              "bg-sky-600 hover:bg-sky-700 shadow-sky-200",
              required && !value.trim() && "opacity-50 pointer-events-none"
            )}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}

