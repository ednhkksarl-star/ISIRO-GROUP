'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { X } from 'lucide-react';
import MailForm from '@/components/mail/MailForm';

interface Entity {
  id: string;
  name: string;
}

interface User {
  id: string;
  full_name: string | null;
  email: string;
}

function NewMailItemPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mailType = (searchParams?.get('type') as any) || 'incoming';
  const entityId = searchParams?.get('entity') || undefined;

  return (
    <AppLayout>
      <div className="max-w-[1200px] mx-auto space-y-8 p-4 sm:p-0 animate-in fade-in duration-700">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tight text-slate-900">Nouveau courrier</h1>
            <p className="text-slate-500 font-medium">Enregistrer un nouveau document administratif</p>
          </div>
          <button
            onClick={() => router.back()}
            className="px-6 py-3 bg-slate-100 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2"
          >
            <X className="w-4 h-4" /> Retour à la liste
          </button>
        </div>

        <div className="max-w-4xl mx-auto glass-card border-none p-10 ring-1 ring-slate-100">
          <MailForm
            initialType={mailType}
            initialEntityId={entityId}
            onCancel={() => router.back()}
          />
        </div>
      </div>
    </AppLayout>
  );
}

export default function NewMailItemPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    }>
      <NewMailItemPageContent />
    </Suspense>
  );
}
