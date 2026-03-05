'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { Plus, Trash2, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { useEntity } from '@/hooks/useEntity';
import { useEntityContext } from '@/hooks/useEntityContext';
import EntitySelector from '@/components/entity/EntitySelector';
import { formatNumber } from '@/utils/formatNumber';
import InvoiceForm from '@/components/billing/InvoiceForm';

interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

function NewInvoicePageContent() {
  const router = useRouter();

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-0">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">
            Nouvelle facture
          </h1>
          <p className="text-[13px] font-bold text-slate-500 uppercase tracking-widest mt-1 opacity-70">
            Création d'un nouveau document de facturation
          </p>
        </div>

        <div className="glass-card p-6 sm:p-8 animate-in border-none">
          <InvoiceForm
            onSuccess={(id: string) => router.push(`/billing/${id}`)}
            onCancel={() => router.back()}
          />
        </div>
      </div>
    </AppLayout>
  );
}

export default function NewInvoicePage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    }>
      <NewInvoicePageContent />
    </Suspense>
  );
}
