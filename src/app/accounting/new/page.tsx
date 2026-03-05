'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import AccountingEntryForm from '@/components/accounting/AccountingEntryForm';

function NewAccountingEntryPageContent() {
  const searchParams = useSearchParams();
  const targetEntityId = searchParams?.get('entity') || null;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-0">
        <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Nouvelle écriture</h1>
          <p className="text-slate-500 mt-1 text-sm font-medium">Créer une ou plusieurs écritures dans le livre de caisse</p>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
          <AccountingEntryForm initialEntityId={targetEntityId} />
        </div>
      </div>
    </AppLayout>
  );
}

export default function NewAccountingEntryPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    }>
      <NewAccountingEntryPageContent />
    </Suspense>
  );
}
