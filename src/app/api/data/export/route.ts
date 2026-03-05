import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import {
  DATA_EXPORT_TABLE_ORDER,
  EXPORT_VERSION,
  type DataExportPayload,
  type ExportTableName,
} from '@/lib/dataExportImport';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function ensureAdmin(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
    return { error: NextResponse.json({ error: 'Configuration manquante' }, { status: 500 }) };
  }
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) };
  }
  const supabaseAnon = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });
  const {
    data: { user },
    error: authError,
  } = await supabaseAnon.auth.getUser(authHeader.replace('Bearer ', ''));
  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Token invalide' }, { status: 401 }) };
  }
  const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  const role = (profile as { role?: string } | null)?.role;
  if (role !== 'SUPER_ADMIN_GROUP') {
    return { error: NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 }) };
  }
  return { supabaseAdmin };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await ensureAdmin(request);
    if ('error' in auth) return auth.error;
    const supabase = auth.supabaseAdmin;
    const data: Record<string, unknown[]> = {};

    for (const table of DATA_EXPORT_TABLE_ORDER) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: rows, error } = await (supabase as any).from(table).select('*');
        if (error) {
          // 42P01 = table does not exist, PGRST116 = no rows (not an error for select)
          if (error.code === '42P01' || error.code === 'PGRST204') {
            data[table] = [];
            continue;
          }
          console.warn(`[data/export] Table ${table} skipped:`, error.code, error.message);
          data[table] = [];
          continue;
        }
        data[table] = Array.isArray(rows) ? rows : [];
      } catch (err) {
        console.warn(`[data/export] Table ${table} error:`, err);
        data[table] = [];
      }
    }

    const payload: DataExportPayload = {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      app: 'ISIRO-GROUP',
      data: data as DataExportPayload['data'],
    };

    return NextResponse.json(payload);
  } catch (err) {
    console.error('[data/export]', err);
    return NextResponse.json(
      { error: 'Erreur serveur', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
