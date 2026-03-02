import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

// Client pour les composants React (singleton pour éviter les instances multiples)
let clientInstance: ReturnType<typeof createClientComponentClient<Database>> | null = null;
let isInitializing = false;

export const createSupabaseClient = () => {
  // Si on est côté serveur, créer une nouvelle instance (Next.js gère le singleton)
  if (typeof window === 'undefined') {
    return createClientComponentClient<Database>();
  }

  // Côté client, utiliser un singleton strict
  if (!clientInstance && !isInitializing) {
    isInitializing = true;
    clientInstance = createClientComponentClient<Database>();
    isInitializing = false;
  }

  // Si l'instance n'existe toujours pas (cas de course), créer une nouvelle
  if (!clientInstance) {
    clientInstance = createClientComponentClient<Database>();
  }

  return clientInstance;
};

// Client pour les Server Components et API Routes
export const createSupabaseServerClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
};

// Client par défaut pour usage général
export const supabase = createSupabaseServerClient();

