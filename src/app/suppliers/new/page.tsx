'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { X } from 'lucide-react';
import DirectoryForm from '@/components/directory/DirectoryForm';

function NewSupplierPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const entityId = searchParams?.get('entity') || undefined;

  return (
    <AppLayout>
      <div className="max-w-[1200px] mx-auto space-y-8 p-4 sm:p-0 animate-in fade-in duration-700">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tight text-slate-900">Nouveau Fournisseur</h1>
            <p className="text-slate-500 font-medium text-sm">Ajouter une nouvelle fiche fournisseur au répertoire</p>
          </div>
          <button
            onClick={() => router.back()}
            className="px-6 py-3 bg-slate-100 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2"
          >
            <X className="w-4 h-4" /> Retour au répertoire
          </button>
        </div>

        <div className="max-w-4xl mx-auto glass-card border-none p-10 ring-1 ring-slate-100">
          <DirectoryForm
            initialType="suppliers"
            initialEntityId={entityId}
            onCancel={() => router.back()}
          />
        </div>
      </div>
    </AppLayout>
  );
}

export default function NewSupplierPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    }>
      <NewSupplierPageContent />
    </Suspense>
  );
}
