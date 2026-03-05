'use client';

import { useState, useRef } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { Download, Upload, FileJson, Shield, AlertTriangle, Settings } from 'lucide-react';
import { toast } from 'react-toastify';
import Button from '@/components/ui/Button';
import { cn } from '@/utils/cn';
import type { DataExportPayload } from '@/lib/dataExportImport';

export default function DataExportImportPage() {
  const { profile } = useAuth();
  const supabase = createSupabaseClient();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importConfirm, setImportConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = profile?.role === 'SUPER_ADMIN_GROUP';

  const handleExport = async () => {
    if (!isAdmin) return;
    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Session expirée. Reconnectez-vous.');
        return;
      }
      const res = await fetch('/api/data/export', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 403) toast.error('Réservé aux administrateurs.');
        else toast.error(err?.error || 'Export impossible.');
        return;
      }
      const payload: DataExportPayload = await res.json();
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `isiro-group-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export téléchargé.');
    } catch (e) {
      console.error(e);
      toast.error('Erreur lors de l\'export.');
    } finally {
      setExporting(false);
    }
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.json')) {
        toast.error('Choisissez un fichier .json');
        return;
      }
      setImportFile(file);
      setImportConfirm(false);
    }
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!isAdmin || !importFile) return;
    setImporting(true);
    try {
      const text = await importFile.text();
      const payload = JSON.parse(text) as DataExportPayload;
      if (!payload.data || payload.version === undefined) {
        toast.error('Fichier d\'import invalide.');
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Session expirée. Reconnectez-vous.');
        return;
      }
      const res = await fetch('/api/data/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          'X-Import-Mode': 'upsert',
        },
        body: text,
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(result?.error || 'Import impossible.');
        return;
      }
      toast.success('Import terminé.');
      setImportFile(null);
      setImportConfirm(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (e) {
      console.error(e);
      toast.error('Erreur lors de l\'import.');
    } finally {
      setImporting(false);
    }
  };

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 p-6">
          <Shield className="w-16 h-16 text-amber-500" />
          <h2 className="text-xl font-bold text-slate-800">Accès réservé</h2>
          <p className="text-slate-600 text-center max-w-md">
            L&apos;export et l&apos;import des données sont réservés aux administrateurs du groupe (Super Admin).
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="bg-white border-2 border-emerald-100 p-8 sm:p-10 rounded-[2rem] relative overflow-hidden">
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-emerald-50 rounded-full opacity-50" />
          <div className="relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-100">
              <Settings className="w-4 h-4 text-emerald-600" />
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800">
                Données
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-emerald-950 uppercase">
              Export / Import
            </h1>
            <p className="text-emerald-800/60 text-sm font-bold max-w-2xl">
              Exporter toutes les données de l&apos;application (entités, utilisateurs, factures, comptabilité, etc.)
              ou importer un fichier d&apos;export précédent. Utilisez cette fonction pour sauvegarder ou migrer
              les données vers la même application.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Export */}
          <div className="bg-white border-2 border-emerald-100 p-6 rounded-2xl">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100">
                <Download className="w-7 h-7 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-emerald-950">Exporter les données</h3>
                <p className="text-sm text-emerald-800/60">
                  Télécharge un fichier JSON contenant toutes les données.
                </p>
              </div>
            </div>
            <Button
              onClick={handleExport}
              disabled={exporting}
              className="w-full"
              icon={<FileJson className="w-5 h-5" />}
            >
              {exporting ? 'Export en cours…' : 'Télécharger l\'export'}
            </Button>
          </div>

          {/* Import */}
          <div className="bg-white border-2 border-amber-100 p-6 rounded-2xl">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-xl bg-amber-50 flex items-center justify-center border border-amber-100">
                <Upload className="w-7 h-7 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Importer des données</h3>
                <p className="text-sm text-slate-600">
                  Charge un fichier d&apos;export .json (fusion avec les données existantes).
                </p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportFileChange}
            />
            <div className="space-y-3">
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
                icon={<FileJson className="w-5 h-5" />}
              >
                Choisir un fichier
              </Button>
              {importFile && (
                <div className={cn(
                  'p-3 rounded-xl border-2',
                  importConfirm ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-slate-50'
                )}>
                  <p className="text-sm font-medium text-slate-700 truncate">{importFile.name}</p>
                  {!importConfirm ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 border-amber-300 text-amber-800"
                      onClick={() => setImportConfirm(true)}
                      icon={<AlertTriangle className="w-4 h-4" />}
                    >
                      Confirmer l&apos;import
                    </Button>
                  ) : (
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleImport}
                        loading={importing}
                        className="bg-amber-600 hover:bg-amber-700"
                      >
                        {importing ? 'Import…' : 'Importer'}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => { setImportConfirm(false); setImportFile(null); }}
                        disabled={importing}
                      >
                        Annuler
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">À savoir</p>
            <ul className="list-disc list-inside mt-1 space-y-1 text-amber-800">
              <li>L&apos;export inclut toutes les tables : entités, rôles, utilisateurs (profil), taux de change, factures et lignes, paiements, écritures comptables, dépenses, tâches, courriers, documents, budgets et dépenses ménage, répertoire (clients, fournisseurs, partenaires, collaborateurs), journaux d&apos;audit.</li>
              <li>L&apos;import fusionne les enregistrements (upsert par id). Les utilisateurs doivent exister dans l&apos;authentification (Auth) ; le fichier ne crée pas de comptes Auth.</li>
              <li>Effectuez un export régulier comme sauvegarde avant toute opération importante.</li>
            </ul>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
