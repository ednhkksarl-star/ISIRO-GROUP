'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createSupabaseClient } from '@/services/supabaseClient';
import {
  Eye, EyeOff, Mail, Lock, ArrowRight,
  CheckCircle2, XCircle, Shield, BarChart3,
  Layers, Globe,
} from 'lucide-react';

const FEATURES = [
  { icon: Shield, label: 'Sécurité avancée' },
  { icon: BarChart3, label: 'Temps réel' },
  { icon: Layers, label: 'Multi-modules' },
  { icon: Globe, label: 'Multi-devises' },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const router = useRouter();
  const supabase = createSupabaseClient();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (status === 'error') {
      const t = setTimeout(() => setStatus('idle'), 4000);
      return () => clearTimeout(t);
    }
  }, [status]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus('loading');
    setErrorMsg('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const { data: profile } = await supabase
        .from('users').select('is_active').eq('id', data.user.id).maybeSingle();

      if (!profile || !(profile as any).is_active) {
        setErrorMsg('Compte introuvable ou désactivé.');
        setStatus('error');
        await supabase.auth.signOut();
        return;
      }

      setStatus('success');
      setTimeout(() => router.push('/dashboard'), 900);
    } catch (err: any) {
      const m = err?.message?.toLowerCase() ?? '';
      setErrorMsg(m.includes('invalid') || m.includes('credentials')
        ? 'Email ou mot de passe incorrect.'
        : 'Connexion impossible. Réessayez.');
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  /* ── shared entry animation ─────────────────────────── */
  const fadeUp = (delay: number) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(28px)',
    transition: `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
  });

  return (
    <div className="relative w-full min-h-screen flex overflow-hidden" style={{ background: '#07111E' }}>

      {/* ══════════════════════════════════════════════════════
          BACKGROUND — common to both halves
      ══════════════════════════════════════════════════════ */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        {/* Soft radial glows */}
        <div className="absolute inset-0" style={{
          background: `
            radial-gradient(ellipse 80% 60% at -5% 50%,  rgba(16,185,129,0.22) 0%, transparent 60%),
            radial-gradient(ellipse 70% 60% at 105% 50%, rgba(6,182,212,0.15)  0%, transparent 60%),
            radial-gradient(ellipse 60% 60% at 50% 50%,  rgba(251,191,36,0.04) 0%, transparent 70%)
          `,
        }} />

        {/* Dot grid */}
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(ellipse 100% 100% at 50% 50%, black 30%, transparent 100%)',
        }} />

        {/* Floating orbs */}
        {[
          { size: 240, top: '5%', left: '5%', color: 'rgba(16,185,129,0.12)', dur: '16s', delay: '0s' },
          { size: 180, top: '60%', left: '2%', color: 'rgba(6,182,212,0.10)', dur: '20s', delay: '3s' },
          { size: 200, top: '10%', right: '3%', color: 'rgba(6,182,212,0.10)', dur: '14s', delay: '1s' },
          { size: 160, top: '65%', right: '4%', color: 'rgba(251,191,36,0.07)', dur: '18s', delay: '5s' },
          { size: 120, top: '40%', left: '47%', color: 'rgba(16,185,129,0.07)', dur: '22s', delay: '2s' },
        ].map((o, i) => (
          <div key={i} className="absolute rounded-full" style={{
            width: o.size, height: o.size,
            top: o.top,
            left: (o as any).left,
            right: (o as any).right,
            background: o.color,
            filter: 'blur(50px)',
            animation: `orbFloat ${o.dur} ease-in-out infinite`,
            animationDelay: o.delay,
          }} />
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
          LEFT HALF — Branding  (hidden on mobile / tablet)
      ══════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex w-1/2 flex-col items-center justify-center relative px-12 xl:px-20">

        {/* Right border separator */}
        <div className="absolute right-0 inset-y-0 w-px" style={{
          background: 'linear-gradient(to bottom, transparent 5%, rgba(16,185,129,0.35) 30%, rgba(16,185,129,0.35) 70%, transparent 95%)',
        }} />

        {/* Content */}
        <div className="w-full max-w-sm flex flex-col gap-10">

          {/* Logo + name */}
          <div style={fadeUp(0)} className="flex flex-col items-start gap-6">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl" style={{
                background: 'rgba(16,185,129,0.25)', filter: 'blur(20px)',
                animation: 'glowPulse 3.5s ease-in-out infinite',
              }} />
              <div className="relative w-20 h-20 rounded-2xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur-sm p-3">
                <Image src="/logo_isiro.png" alt="ISIRO GROUP" fill className="object-contain" priority unoptimized />
              </div>
            </div>

            <div>
              <p className="text-5xl xl:text-6xl font-black text-white tracking-tighter leading-none">ISIRO</p>
              <p className="text-5xl xl:text-6xl font-black tracking-tighter leading-[1.05]" style={{ color: '#10b981' }}>GROUP</p>
            </div>
          </div>

          {/* Divider */}
          <div style={{ ...fadeUp(0.12), height: 1, background: 'linear-gradient(to right, rgba(16,185,129,0.4), transparent)' }} />

          {/* Feature pills — icon + short label only */}
          <div className="grid grid-cols-2 gap-3" style={fadeUp(0.18)}>
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    opacity: mounted ? 1 : 0,
                    transform: mounted ? 'translateY(0)' : 'translateY(16px)',
                    transition: `all 0.6s cubic-bezier(0.16,1,0.3,1) ${0.28 + i * 0.09}s`,
                  }}
                >
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <Icon className="w-3.5 h-3.5" style={{ color: '#10b981' }} strokeWidth={2.5} />
                  </div>
                  <p className="text-white text-[12px] font-bold leading-tight">{f.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          RIGHT HALF — Login form
      ══════════════════════════════════════════════════════ */}
      <div
        className="w-full lg:w-1/2 flex items-center justify-center px-5 sm:px-10"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 2rem)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 2rem)',
          minHeight: '100svh',
        }}
      >
        <div className="w-full max-w-[420px]">

          {/* ── Mobile branding (logo visible only on small screens) */}
          <div className="lg:hidden flex flex-col items-center mb-8" style={fadeUp(0)}>
            <div className="relative mb-4">
              <div className="absolute inset-0 rounded-2xl" style={{ background: 'rgba(16,185,129,0.2)', filter: 'blur(14px)' }} />
              <div className="relative w-16 h-16 rounded-2xl overflow-hidden border border-white/10 bg-white/5 p-3">
                <Image src="/logo_isiro.png" alt="ISIRO" fill className="object-contain" priority unoptimized />
              </div>
            </div>
            <p className="text-2xl font-black text-white tracking-tight">ISIRO GROUP</p>
            <p className="text-sm text-slate-500 mt-1">Plateforme de gestion centralisée</p>
          </div>

          {/* ── Glass card */}
          <div style={{
            ...fadeUp(0.1),
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 28,
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            boxShadow: '0 40px 80px -20px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)',
            padding: '2.25rem',
          }}>

            {/* Card header */}
            <div className="mb-7">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl mb-5" style={{
                background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.18)',
              }}>
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#10b981' }} />
                <span className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: '#10b981' }}>
                  Espace sécurisé
                </span>
              </div>

              <h2 className="text-3xl font-black text-white tracking-tight leading-tight">Bienvenue</h2>
              <p className="text-slate-400 text-sm mt-2 font-medium">Connectez-vous avec vos identifiants ISIRO GROUP</p>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="flex flex-col gap-4">

              {/* Email */}
              <div style={fadeUp(0.22)}>
                <label htmlFor="login-email" className="block text-[10px] font-black uppercase tracking-[0.15em] mb-2 ml-1" style={{ color: '#64748b' }}>
                  Adresse e-mail
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#475569' }} strokeWidth={2} />
                  <input
                    id="login-email"
                    type="email"
                    required
                    autoComplete="email"
                    inputMode="email"
                    placeholder="votre@isirogroup.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full h-[50px] pl-11 pr-4 rounded-2xl text-white placeholder-slate-600 outline-none font-medium transition-all duration-300"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1.5px solid rgba(255,255,255,0.08)',
                      fontSize: 16,
                    }}
                    onFocus={e => Object.assign(e.target.style, { borderColor: 'rgba(16,185,129,0.55)', background: 'rgba(16,185,129,0.06)', boxShadow: '0 0 0 3px rgba(16,185,129,0.1)' })}
                    onBlur={e => Object.assign(e.target.style, { borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.05)', boxShadow: 'none' })}
                  />
                </div>
              </div>

              {/* Password */}
              <div style={fadeUp(0.32)}>
                <label htmlFor="login-password" className="block text-[10px] font-black uppercase tracking-[0.15em] mb-2 ml-1" style={{ color: '#64748b' }}>
                  Mot de passe
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#475569' }} strokeWidth={2} />
                  <input
                    id="login-password"
                    type={showPass ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full h-[50px] pl-11 pr-12 rounded-2xl text-white placeholder-slate-600 outline-none font-medium transition-all duration-300"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1.5px solid rgba(255,255,255,0.08)',
                      fontSize: 16,
                    }}
                    onFocus={e => Object.assign(e.target.style, { borderColor: 'rgba(16,185,129,0.55)', background: 'rgba(16,185,129,0.06)', boxShadow: '0 0 0 3px rgba(16,185,129,0.1)' })}
                    onBlur={e => Object.assign(e.target.style, { borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.05)', boxShadow: 'none' })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors"
                    style={{ color: '#475569' }}
                    aria-label={showPass ? 'Masquer' : 'Afficher'}
                  >
                    {showPass ? <EyeOff className="w-4 h-4" strokeWidth={2} /> : <Eye className="w-4 h-4" strokeWidth={2} />}
                  </button>
                </div>
              </div>

              {/* Feedback — error */}
              <div style={{
                maxHeight: status === 'error' ? 72 : 0,
                opacity: status === 'error' ? 1 : 0,
                overflow: 'hidden',
                transition: 'all 0.4s cubic-bezier(0.16,1,0.3,1)',
              }}>
                <div className="flex items-start gap-3 px-4 py-3 rounded-2xl" style={{
                  background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)',
                }}>
                  <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#f87171' }} strokeWidth={2} />
                  <p className="text-[13px] font-medium leading-snug" style={{ color: '#fca5a5' }}>{errorMsg}</p>
                </div>
              </div>

              {/* Feedback — success */}
              <div style={{
                maxHeight: status === 'success' ? 72 : 0,
                opacity: status === 'success' ? 1 : 0,
                overflow: 'hidden',
                transition: 'all 0.4s cubic-bezier(0.16,1,0.3,1)',
              }}>
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl" style={{
                  background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.18)',
                }}>
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: '#34d399' }} strokeWidth={2} />
                  <p className="text-[13px] font-medium" style={{ color: '#6ee7b7' }}>Connexion réussie ! Redirection…</p>
                </div>
              </div>

              {/* Submit */}
              <div className="mt-1" style={fadeUp(0.42)}>
                <button
                  type="submit"
                  disabled={loading || status === 'success'}
                  className="relative w-full h-[50px] rounded-2xl font-black text-[12px] uppercase tracking-[0.15em] overflow-hidden group transition-all duration-300 active:scale-[0.98] disabled:opacity-60 text-white"
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 60%, #047857 100%)',
                    boxShadow: loading ? 'none' : '0 8px 28px -6px rgba(16,185,129,0.55), inset 0 1px 0 rgba(255,255,255,0.18)',
                  }}
                >
                  {/* hover shine */}
                  {!loading && status !== 'success' && (
                    <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                      style={{ background: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.18) 50%, transparent 65%)', transform: 'skewX(-15deg)' }}
                    />
                  )}
                  <span className="relative flex items-center justify-center gap-2.5">
                    {loading ? (
                      <>
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Connexion en cours…
                      </>
                    ) : status === 'success' ? (
                      <><CheckCircle2 className="w-4 h-4" />Connecté !</>
                    ) : (
                      <>
                        Se connecter
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" strokeWidth={3} />
                      </>
                    )}
                  </span>
                </button>
              </div>
            </form>

            {/* Card footer */}
            <p className="mt-6 text-center text-[11px] font-medium" style={{ color: '#334155' }}>
              Application sécurisée · ISIRO GROUP © {new Date().getFullYear()}
            </p>
          </div>

          {/* Trust row below card */}
          <div className="flex items-center justify-center gap-6 mt-5" style={fadeUp(0.55)}>
            {[
              { icon: Shield, label: 'Chiffré SSL' },
              { icon: Layers, label: 'RLS Supabase' },
              { icon: CheckCircle2, label: 'ISO Conforme' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <Icon className="w-3 h-3" style={{ color: '#1e3a2f' }} strokeWidth={2.5} />
                <span className="text-[10px] font-bold" style={{ color: '#1e3a2f' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          Global keyframes (scoped via style jsx global)
      ══════════════════════════════════════════════════════ */}
      <style jsx global>{`
        @keyframes orbFloat {
          0%,100% { transform: translateY(0px)   scale(1);    opacity:.85; }
          33%      { transform: translateY(-30px) scale(1.06); opacity:.55; }
          66%      { transform: translateY(15px)  scale(0.96); opacity:.70; }
        }
        @keyframes glowPulse {
          0%,100% { opacity:.55; transform:scale(1);    }
          50%      { opacity: 1; transform:scale(1.18); }
        }
      `}</style>
    </div>
  );
}
