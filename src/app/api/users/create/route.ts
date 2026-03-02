import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

/**
 * Route API pour créer un utilisateur
 * Nécessite la Service Role Key pour utiliser auth.admin.createUser()
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Vérifier les variables d'environnement
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Log pour debugging (ne pas exposer les clés en production)
    const missingVars = [];
    if (!supabaseUrl) missingVars.push('NEXT_PUBLIC_SUPABASE_URL');
    if (!supabaseServiceKey) missingVars.push('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseAnonKey) missingVars.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');

    if (missingVars.length > 0) {
      console.error('Variables d\'environnement manquantes:', missingVars);
      return NextResponse.json(
        { 
          error: 'Configuration Supabase manquante',
          details: `Variables manquantes: ${missingVars.join(', ')}`,
          hint: 'Vérifiez que SUPABASE_SERVICE_ROLE_KEY est bien configurée dans Vercel'
        },
        { status: 500 }
      );
    }

    // À ce stade, on sait que les variables sont définies (vérifiées ci-dessus)
    // TypeScript assertion pour éviter les erreurs de type
    const supabaseUrlSafe = supabaseUrl!;
    const supabaseAnonKeySafe = supabaseAnonKey!;
    const supabaseServiceKeySafe = supabaseServiceKey!;

    // Créer un client avec la Service Role Key dès le début pour bypass RLS
    const supabaseAdmin = createClient<Database>(supabaseUrlSafe, supabaseServiceKeySafe, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Récupérer les données de la requête AVANT de vérifier le profil (pour éviter les problèmes de double lecture)
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: 'Données JSON invalides' },
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

    // Créer un client avec la clé anonyme pour vérifier l'utilisateur actuel (authentification)
    const supabaseAnon = createClient<Database>(supabaseUrlSafe, supabaseAnonKeySafe, {
      auth: {
        persistSession: false,
      },
    });

    // Vérifier l'utilisateur actuel (celui qui crée)
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

    // Gérer les erreurs de profil de manière gracieuse
    if (profileError) {
      // Si c'est juste que le profil n'existe pas (PGRST116), on autorise quand même
      // pour permettre la création du premier admin ou si l'utilisateur est authentifié
      if (profileError.code === 'PGRST116' || profileError.code === '42P01') {
        console.warn(`Utilisateur ${currentUser.id} (${currentUser.email}) n'a pas de profil dans la table users mais est authentifié. Création d'utilisateur autorisée.`);
        // Autoriser la création si l'utilisateur est authentifié (même sans profil)
      } else {
        // Pour les autres erreurs (problème de connexion, etc.), retourner une erreur
        console.error('Erreur lors de la récupération du profil:', profileError);
        return NextResponse.json(
          { 
            error: 'Erreur lors de la vérification des permissions',
            details: profileError.message 
          },
          { status: 500 }
        );
      }
    } else if (userProfile) {
      // Si le profil existe, vérifier les permissions
      const profile = userProfile as { role: string; is_active: boolean };
      if (!profile.is_active) {
        return NextResponse.json(
          { error: 'Votre compte est désactivé.' },
          { status: 403 }
        );
      }
      if (profile.role !== 'SUPER_ADMIN_GROUP' && profile.role !== 'ADMIN_ENTITY') {
        return NextResponse.json(
          { error: 'Accès refusé. Seuls les super admins et admins peuvent créer des utilisateurs.' },
          { status: 403 }
        );
      }
    }
    // Si pas de profil ET pas d'erreur, on autorise quand même (utilisateur authentifié)

    // Extraire les données du body
    const {
      email,
      password,
      full_name,
      role,
      entity_id,
      entity_ids,
      avatar_url,
      is_active,
    } = body;

    // Validation
    if (!email || !password || !role) {
      return NextResponse.json(
        { error: 'Email, mot de passe et rôle sont requis' },
        { status: 400 }
      );
    }

    // Valider le format de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Format d\'email invalide' },
        { status: 400 }
      );
    }

    // Valider la longueur du mot de passe
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caractères' },
        { status: 400 }
      );
    }

    // Vérifier si l'utilisateur existe déjà dans la table users (plus rapide que listUsers)
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();
    
    if (existingUser) {
      return NextResponse.json(
        { error: 'Un utilisateur avec cet email existe déjà dans le système' },
        { status: 400 }
      );
    }

    // Créer l'utilisateur dans Supabase Auth
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError || !authData.user) {
      console.error('Erreur lors de la création de l\'utilisateur Auth:', createError);
      return NextResponse.json(
        { 
          error: createError?.message || 'Erreur lors de la création de l\'utilisateur',
          details: createError?.status ? `Code: ${createError.status}` : undefined
        },
        { status: 400 }
      );
    }

    // Créer l'entrée dans la table users immédiatement après la création Auth
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        full_name: full_name || null,
        role,
        entity_id: entity_id || null,
        entity_ids: entity_ids && entity_ids.length > 0 ? entity_ids : null,
        avatar_url: avatar_url || null,
        is_active: is_active !== undefined ? is_active : true,
      } as any)
      .select()
      .single();

    if (userError) {
      console.error('Erreur lors de la création du profil utilisateur:', userError);
      // Si l'insertion dans users échoue, supprimer l'utilisateur auth créé
      try {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      } catch (deleteError) {
        console.error('Erreur lors de la suppression de l\'utilisateur Auth après échec:', deleteError);
      }
      return NextResponse.json(
        { 
          error: userError.message || 'Erreur lors de la création du profil utilisateur',
          details: userError.code === '23505' ? 'Un utilisateur avec cet email existe déjà dans la base de données' : undefined
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        user: userData,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Erreur API create user:', error);
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

