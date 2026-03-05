'use client';

import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/utils/cn';
import Portal from './Portal';

interface SheetProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    description?: string;
    children: ReactNode;
    footer?: ReactNode;
    size?: 'md' | 'lg' | 'xl' | 'full';
}

export default function Sheet({
    isOpen,
    onClose,
    title,
    description,
    children,
    footer,
    size = 'md',
}: SheetProps) {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    const sizeClasses = {
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        full: 'max-w-2xl',
    };

    if (!isOpen) return null;

    return (
        <Portal>
            <div className="fixed inset-0 z-[100] flex justify-end">
                {/* Backdrop */}
                <div
                    className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-500"
                    onClick={onClose}
                />

                {/* Panel */}
                <div className={cn(
                    "relative w-full h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-500 ease-in-out",
                    sizeClasses[size]
                )}>
                    {/* Header */}
                    <div className="px-8 py-10 flex flex-col gap-1 relative overflow-hidden">
                        {/* Background Accent */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl" />

                        <div className="flex items-center justify-between relative">
                            <div className="space-y-1">
                                {title && (
                                    <h2 className="text-2xl font-black tracking-tight text-slate-900">
                                        {title}
                                    </h2>
                                )}
                                {description && (
                                    <p className="text-sm font-medium text-slate-500">
                                        {description}
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={onClose}
                                className="w-10 h-10 border border-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 hover:border-slate-300 transition-all bg-white shadow-sm hover:shadow-md"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto px-8 pb-10 scrollbar-hide">
                        {children}
                    </div>

                    {/* Footer */}
                    {footer && (
                        <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 rounded-t-[32px]">
                            {footer}
                        </div>
                    )}
                </div>
            </div>
        </Portal>
    );
}
