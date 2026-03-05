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
export const maxDuration = 60;

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

export async function POST(request: NextRequest) {
  const auth = await ensureAdmin(request);
  if ('error' in auth) return auth.error;
  const supabase = auth.supabaseAdmin;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  const payload = body as DataExportPayload;
  if (payload.version !== EXPORT_VERSION || !payload.data || typeof payload.data !== 'object') {
    return NextResponse.json(
      { error: 'Fichier d\'import invalide (version ou format)' },
      { status: 400 }
    );
  }

  const stats: Record<string, { inserted: number; errors: number }> = {};
  const mode = (request.headers.get('x-import-mode') || 'upsert') as 'upsert' | 'insert';

  for (const table of DATA_EXPORT_TABLE_ORDER) {
    const rows = payload.data[table as ExportTableName];
    if (!Array.isArray(rows) || rows.length === 0) {
      stats[table] = { inserted: 0, errors: 0 };
      continue;
    }

    let inserted = 0;
    let errors = 0;

    try {
      if (mode === 'upsert') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any).from(table).upsert(rows, {
          onConflict: 'id',
          ignoreDuplicates: false,
        });
        if (error) {
          errors = rows.length;
        } else {
          inserted = rows.length;
        }
      } else {
        for (const row of rows) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase as any).from(table).insert(row);
          if (error) errors++;
          else inserted++;
        }
      }
    } catch {
      errors = rows.length;
    }
    stats[table] = { inserted, errors };
  }

  return NextResponse.json({
    success: true,
    message: 'Import terminé',
    stats,
  });
}
