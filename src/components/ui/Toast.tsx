'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
    exiting?: boolean;
}

interface ToastContextValue {
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
    dismiss: (id: string) => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

// ─── Config per type ─────────────────────────────────────────────────────────

const TOAST_CONFIG = {
    success: {
        icon: CheckCircle2,
        bg: 'bg-white border-emerald-200',
        iconBg: 'bg-emerald-50',
        iconColor: 'text-emerald-500',
        accent: 'bg-emerald-400',
        text: 'text-emerald-950',
        sub: 'text-emerald-700/60',
    },
    error: {
        icon: XCircle,
        bg: 'bg-white border-rose-200',
        iconBg: 'bg-rose-50',
        iconColor: 'text-rose-500',
        accent: 'bg-rose-400',
        text: 'text-rose-950',
        sub: 'text-rose-700/60',
    },
    warning: {
        icon: AlertTriangle,
        bg: 'bg-white border-amber-200',
        iconBg: 'bg-amber-50',
        iconColor: 'text-amber-500',
        accent: 'bg-amber-400',
        text: 'text-amber-950',
        sub: 'text-amber-700/60',
    },
    info: {
        icon: Info,
        bg: 'bg-white border-sky-200',
        iconBg: 'bg-sky-50',
        iconColor: 'text-sky-500',
        accent: 'bg-sky-400',
        text: 'text-sky-950',
        sub: 'text-sky-700/60',
    },
} as const;

// ─── Single Toast Item ────────────────────────────────────────────────────────

function ToastCard({
    toast,
    onDismiss,
}: {
    toast: ToastItem;
    onDismiss: (id: string) => void;
}) {
    const config = TOAST_CONFIG[toast.type];
    const Icon = config.icon;
    const duration = toast.duration ?? 4500;
    const progressRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!progressRef.current) return;
        const el = progressRef.current;
        el.style.transition = 'none';
        el.style.width = '100%';
        // Trigger reflow
        void el.offsetWidth;
        el.style.transition = `width ${duration}ms linear`;
        el.style.width = '0%';
    }, [duration]);

    return (
        <div
            className={`
        group relative flex items-start gap-3 p-4 pr-10 rounded-2xl border-2 shadow-xl shadow-black/5
        backdrop-blur-sm min-w-[300px] max-w-[400px]
        ${config.bg}
        ${toast.exiting ? 'animate-toast-out' : 'animate-toast-in'}
      `}
            role="alert"
        >
            {/* Left accent bar */}
            <div className={`absolute left-0 inset-y-0 w-1 rounded-l-2xl ${config.accent}`} />

            {/* Icon */}
            <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${config.iconBg}`}>
                <Icon className={`w-4 h-4 ${config.iconColor}`} strokeWidth={2.5} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pt-0.5">
                <p className={`text-[13px] font-bold leading-snug ${config.text}`}>
                    {toast.message}
                </p>
            </div>

            {/* Close button */}
            <button
                onClick={() => onDismiss(toast.id)}
                className={`
          absolute top-3 right-3 w-6 h-6 rounded-lg flex items-center justify-center
          opacity-40 hover:opacity-100 transition-opacity
          ${config.iconBg}
        `}
                aria-label="Fermer"
            >
                <X className={`w-3.5 h-3.5 ${config.iconColor}`} />
            </button>

            {/* Progress bar */}
            <div className="absolute bottom-0 left-1 right-0 h-0.5 rounded-b-2xl overflow-hidden">
                <div
                    ref={progressRef}
                    className={`h-full ${config.accent} opacity-40`}
                    style={{ width: '100%' }}
                />
            </div>
        </div>
    );
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const dismiss = useCallback((id: string) => {
        // Mark as exiting then remove
        setToasts((prev) =>
            prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
        );
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 300);
    }, []);

    const add = useCallback(
        (type: ToastType, message: string, duration = 4500) => {
            const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            setToasts((prev) => [...prev.slice(-4), { id, type, message, duration }]);
            setTimeout(() => dismiss(id), duration);
        },
        [dismiss]
    );

    const ctx: ToastContextValue = {
        success: (msg, dur) => add('success', msg, dur),
        error: (msg, dur) => add('error', msg, dur),
        warning: (msg, dur) => add('warning', msg, dur),
        info: (msg, dur) => add('info', msg, dur),
        dismiss,
    };

    return (
        <ToastContext.Provider value={ctx}>
            {children}
            {/* Portal-like container, fixed top-right */}
            <div
                className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none sm:top-6 sm:right-6"
                aria-live="polite"
                aria-label="Notifications"
            >
                {toasts.map((t) => (
                    <div key={t.id} className="pointer-events-auto">
                        <ToastCard toast={t} onDismiss={dismiss} />
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
    const ctx = useContext(ToastContext);
    if (!ctx) {
        throw new Error('useToast must be used inside <ToastProvider>');
    }
    return ctx;
}
