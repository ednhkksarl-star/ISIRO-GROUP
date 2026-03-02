import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

/**
 * Route API pour supprimer un utilisateur
 * Nécessite la Service Role Key pour utiliser auth.admin.deleteUser()
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function DELETE(request: NextRequest) {
  try {
    // Vérifier les variables d'environnement
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const missingVars = [];
    if (!supabaseUrl) missingVars.push('NEXT_PUBLIC_SUPABASE_URL');
    if (!supabaseServiceKey) missingVars.push('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseAnonKey) missingVars.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');

    if (missingVars.length > 0) {
      console.error('Variables d\'environnement manquantes:', missingVars);
      return NextResponse.json(
        { 
          error: 'Configuration Supabase manquante',
          details: `Variables manquantes: ${missingVars.join(', ')}`
        },
        { status: 500 }
      );
    }

    const supabaseUrlSafe = supabaseUrl!;
    const supabaseAnonKeySafe = supabaseAnonKey!;
    const supabaseServiceKeySafe = supabaseServiceKey!;

    // Créer un client avec la Service Role Key
    const supabaseAdmin = createClient<Database>(supabaseUrlSafe, supabaseServiceKeySafe, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Récupérer l'ID de l'utilisateur à supprimer depuis les query params
    const { searchParams } = new URL(request.url);
    const userIdToDelete = searchParams.get('id');

    if (!userIdToDelete) {
      return NextResponse.json(
        { error: 'ID utilisateur manquant' },
        { status: 400 }
      );
    }

    // Récupérer le token d'authentification depuis les headers
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Non autorisé. Token manquant.' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Créer un client avec la clé anonyme pour vérifier l'utilisateur actuel
    const supabaseAnon = createClient<Database>(supabaseUrlSafe, supabaseAnonKeySafe, {
      auth: {
        persistSession: false,
      },
    });

    // Vérifier l'utilisateur actuel (celui qui supprime)
    const {
      data: { user: currentUser },
      error: authError,
    } = await supabaseAnon.auth.getUser(token);

    if (authError || !currentUser) {
      console.error('Erreur d\'authentification:', authError);
      return NextResponse.json(
        { 
          error: 'Non autorisé',
          details: authError?.message || 'Token invalide ou expiré'
        },
        { status: 401 }
      );
    }

    // Vérifier que l'utilisateur actuel a les permissions (utiliser Service Role Key pour bypass RLS)
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('role, is_active')
      .eq('id', currentUser.id)
      .maybeSingle();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Erreur lors de la récupération du profil:', profileError);
      return NextResponse.json(
        { 
          error: 'Erreur lors de la vérification des permissions',
          details: profileError.message 
        },
        { status: 500 }
      );
    }

    if (userProfile) {
      const profile = userProfile as { role: string; is_active: boolean };
      if (!profile.is_active) {
        return NextResponse.json(
          { error: 'Votre compte est désactivé.' },
          { status: 403 }
        );
      }
      if (profile.role !== 'SUPER_ADMIN_GROUP') {
        return NextResponse.json(
          { error: 'Accès refusé. Seuls les super admins peuvent supprimer des utilisateurs.' },
          { status: 403 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Profil utilisateur non trouvé.' },
        { status: 403 }
      );
    }

    // Empêcher l'auto-suppression
    if (currentUser.id === userIdToDelete) {
      return NextResponse.json(
        { error: 'Vous ne pouvez pas supprimer votre propre compte.' },
        { status: 400 }
      );
    }

    // Vérifier que l'utilisateur à supprimer existe
    const { data: userToDelete, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, role')
      .eq('id', userIdToDelete)
      .maybeSingle();

    if (userError && userError.code !== 'PGRST116') {
      console.error('Erreur lors de la vérification de l\'utilisateur:', userError);
      return NextResponse.json(
        { 
          error: 'Erreur lors de la vérification de l\'utilisateur',
          details: userError.message 
        },
        { status: 500 }
      );
    }

    if (!userToDelete) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé.' },
        { status: 404 }
      );
    }

    // Supprimer l'utilisateur dans auth.users (cela supprimera automatiquement dans users via CASCADE)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userIdToDelete);

    if (deleteError) {
      console.error('Erreur lors de la suppression de l\'utilisateur Auth:', deleteError);
      return NextResponse.json(
        { 
          error: deleteError.message || 'Erreur lors de la suppression de l\'utilisateur',
          details: deleteError.status ? `Code: ${deleteError.status}` : undefined
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Utilisateur supprimé avec succès',
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Erreur API delete user:', error);
    console.error('Stack:', error.stack);
    return NextResponse.json(
      { 
        error: error.message || 'Erreur serveur',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

