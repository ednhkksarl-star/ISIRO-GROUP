'use client';

import { useState, useCallback } from 'react';

/**
 * Hook pour gérer l'état d'une modale
 */
export function useModal() {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return {
    isOpen,
    open,
    close,
    toggle,
  };
}

/**
 * Hook pour gérer une modale de confirmation
 * Retourne une fonction qui retourne une Promise<boolean>
 */
export function useConfirm() {
  return useCallback(
    (message: string, title?: string): Promise<boolean> => {
      return new Promise((resolve) => {
        // Cette fonction sera remplacée par le composant ConfirmModal
        // Pour l'instant, on utilise window.confirm comme fallback
        const result = window.confirm(message);
        resolve(result);
      });
    },
    []
  );
}

/**
 * Hook pour gérer une modale de prompt
 * Retourne une fonction qui retourne une Promise<string | null>
 */
export function usePrompt() {
  return useCallback(
    (
      message: string,
      defaultValue?: string,
      title?: string
    ): Promise<string | null> => {
      return new Promise((resolve) => {
        // Cette fonction sera remplacée par le composant PromptModal
        // Pour l'instant, on utilise window.prompt comme fallback
        const result = window.prompt(message, defaultValue || '');
        resolve(result);
      });
    },
    []
  );
}

