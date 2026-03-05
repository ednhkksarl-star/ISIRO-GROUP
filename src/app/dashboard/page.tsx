'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { useEntity } from '@/hooks/useEntity';
import { createSupabaseClient } from '@/services/supabaseClient';
import { normalizeEntityIds, getEntityUUID } from '@/utils/entityHelpers';
import { formatNumber } from '@/utils/formatNumber';
import {
  TrendingUp, TrendingDown, DollarSign, FileText,
  Calendar, ChevronDown, Globe,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { ENTITIES } from '@/constants/entities';
import type { EntityCode } from '@/types/database.types';

interface DashboardStats {
  totalRevenue: number;
  totalExpenses: number;
  netResult: number;
  invoicesCount: number;
  expensesCount: number;
  revenueByEntity: Array<{ entity: string; revenue: number }>;
  monthlyData: Array<{ month: string; revenue: number; expenses: number }>;
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const { selectedEntityId, isGroupView } = useEntity();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const supabase = createSupabaseClient();

  useEffect(() => { setMounted(true); }, []);

  const getFilterMonths = () => {
    const months = [];
    const date = new Date();
    for (let i = 0; i < 12; i++) {
      const year = date.getFullYear();
      const month = date.getMonth();
      const val = `${year}-${String(month + 1).padStart(2, '0')}`;
      const label = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(date);
      months.push({ value: val, label: label.charAt(0).toUpperCase() + label.slice(1) });
      date.setMonth(date.getMonth() - 1);
    }
    return months;
  };
  const filterMonths = getFilterMonths();

  useEffect(() => {
    if (!profile) { setStats({ totalRevenue: 0, totalExpenses: 0, netResult: 0, invoicesCount: 0, expensesCount: 0, revenueByEntity: [], monthlyData: [] }); setLoading(false); return; }
    let cancelled = false;
    fetchDashboardData().catch(console.error).finally(() => { if (!cancelled) { } });
    return () => { cancelled = true; };
  }, [profile?.id, selectedEntityId, isGroupView, selectedDate]);

  const applyEntityFilter = async (query: any) => {
    const isGroup = isGroupView && (profile?.role === 'SUPER_ADMIN_GROUP' || profile?.role === 'ADMIN_ENTITY');
    if (isGroup) return query;
    if (selectedEntityId && (profile?.role === 'SUPER_ADMIN_GROUP' || profile?.role === 'ADMIN_ENTITY')) {
      const uuid = await getEntityUUID(selectedEntityId);
      return uuid ? query.eq('entity_id', uuid) : query.eq('id', '00000000-0000-0000-0000-000000000000');
    }
    if (profile?.entity_ids && profile.entity_ids.length > 0) {
      const uuids = await normalizeEntityIds(profile.entity_ids);
      return uuids.length > 0 ? query.in('entity_id', uuids) : query.eq('id', '00000000-0000-0000-0000-000000000000');
    }
    if (profile?.entity_id) return query.eq('entity_id', profile.entity_id);
    return query.eq('id', '00000000-0000-0000-0000-000000000000');
  };

  const applyDateFilter = (query: any, field: string) => {
    if (selectedDate === 'all') return query;
    const [y, m] = selectedDate.split('-');
    const start = `${y}-${m}-01`;
    const last = new Date(parseInt(y), parseInt(m), 0).getDate();
    return query.gte(field, start).lte(field, `${y}-${m}-${last}`);
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      if (!profile) return;

      const { data: entData } = await supabase.from('entities').select('id, name');
      const entMap = new Map<string, string>();
      entData?.forEach((e: any) => entMap.set(e.id, e.name));

      let invQ = supabase.from('invoices').select('total, status, entity_id, issue_date');
      invQ = applyDateFilter(invQ, 'issue_date');
      invQ = await applyEntityFilter(invQ);
      const { data: invoices } = await invQ;

      let expQ = supabase.from('expenses').select('amount, entity_id, expense_date');
      expQ = applyDateFilter(expQ, 'expense_date');
      expQ = await applyEntityFilter(expQ);
      const { data: expenses } = await expQ;

      let accQ = supabase.from('accounting_entries').select('entrees, sorties, entity_id, entry_date');
      accQ = applyDateFilter(accQ, 'entry_date');
      accQ = await applyEntityFilter(accQ);
      const { data: accounting } = await accQ;

      const inv = (invoices || []) as any[];
      const exp = (expenses || []) as any[];
      const acc = (accounting || []) as any[];
      const toN = (v: any) => { const n = parseFloat(v) || 0; return isNaN(n) ? 0 : n; };

      const totalRevenue = inv.filter(i => i.status === 'paid').reduce((s, i) => s + toN(i.total), 0)
        + acc.reduce((s, a) => s + toN(a.entrees), 0);
      const totalExpenses = exp.reduce((s, e) => s + toN(e.amount), 0)
        + acc.reduce((s, a) => s + toN(a.sorties), 0);

      const byEnt = new Map<string, number>();
      inv.filter(i => i.status === 'paid').forEach((i: any) => {
        const n = entMap.get(i.entity_id) || 'Inconnue';
        byEnt.set(n, (byEnt.get(n) || 0) + toN(i.total));
      });
      acc.forEach((a: any) => {
        const v = toN(a.entrees);
        if (v > 0) { const n = entMap.get(a.entity_id) || 'Inconnue'; byEnt.set(n, (byEnt.get(n) || 0) + v); }
      });

      const now = new Date();
      const monthlyData = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        const label = d.toLocaleDateString('fr-FR', { month: 'short' });
        const tm = d.getMonth(), ty = d.getFullYear();
        const inM = (s: string) => { try { const dt = new Date(s); return dt.getMonth() === tm && dt.getFullYear() === ty; } catch { return false; } };
        const rev = inv.filter(i => i.status === 'paid' && inM(i.issue_date)).reduce((s, i) => s + toN(i.total), 0)
          + acc.filter(a => inM(a.entry_date)).reduce((s, a) => s + toN(a.entrees), 0);
        const ex = exp.filter(e => inM(e.expense_date)).reduce((s, e) => s + toN(e.amount), 0)
          + acc.filter(a => inM(a.entry_date)).reduce((s, a) => s + toN(a.sorties), 0);
        return { month: label, revenue: rev, expenses: ex };
      });

      setStats({
        totalRevenue, totalExpenses, netResult: totalRevenue - totalExpenses,
        invoicesCount: inv.length, expensesCount: exp.length,
        revenueByEntity: Array.from(byEnt.entries()).map(([entity, revenue]) => ({ entity, revenue })).sort((a, b) => b.revenue - a.revenue),
        monthlyData,
      });
    } catch (err) {
      console.error(err);
      setStats({ totalRevenue: 0, totalExpenses: 0, netResult: 0, invoicesCount: 0, expensesCount: 0, revenueByEntity: [], monthlyData: [] });
    } finally { setLoading(false); }
  };

  const fadeUp = (delay: number) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(16px)',
    transition: `opacity 0.6s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 0.6s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
  });

  const kpis = [
    {
      icon: TrendingUp, label: 'Entrées', tag: 'Revenus',
      value: `${formatNumber(stats?.totalRevenue ?? 0)} $`,
      color: '#059669', bg: 'rgba(5,150,105,0.08)', border: 'rgba(5,150,105,0.15)',
    },
    {
      icon: TrendingDown, label: 'Dépenses', tag: 'Sorties',
      value: `${formatNumber(stats?.totalExpenses ?? 0)} $`,
      color: '#d97706', bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.15)',
    },
    {
      icon: DollarSign, label: 'Résultat Net', tag: 'Solde',
      value: `${formatNumber(stats?.netResult ?? 0)} $`,
      color: (stats?.netResult ?? 0) >= 0 ? '#059669' : '#dc2626',
      bg: (stats?.netResult ?? 0) >= 0 ? 'rgba(5,150,105,0.08)' : 'rgba(220,38,38,0.08)',
      border: (stats?.netResult ?? 0) >= 0 ? 'rgba(5,150,105,0.15)' : 'rgba(220,38,38,0.15)',
    },
    {
      icon: FileText, label: 'Factures', tag: 'Total',
      value: String(stats?.invoicesCount ?? 0),
      color: '#4f46e5', bg: 'rgba(79,70,229,0.08)', border: 'rgba(79,70,229,0.15)',
    },
  ];


  return (
    <AppLayout>
      <div className="space-y-5 pb-8">

        {/* ── Header ── */}
        <div className="bg-white border-2 border-emerald-100 p-6 sm:p-8 rounded-xl relative overflow-hidden group mb-6" style={fadeUp(0)}>
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-50 rounded-full -mr-24 -mt-24 transition-transform duration-500 group-hover:scale-110 opacity-50" />

          <div className="flex flex-col md:flex-row justify-between items-center sm:items-end gap-6 relative z-10">
            <div className="space-y-1">
              <div className="flex items-center gap-3 justify-center md:justify-start">
                <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-emerald-950 uppercase">Dashboard</h1>
                <div className="w-2.5 h-2.5 rounded-full animate-pulse bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
              </div>
              <div className="flex items-center gap-2 justify-center md:justify-start">
                <span className="w-8 h-1 bg-yellow-500 rounded-full" />
                <p className="text-emerald-700/70 font-bold uppercase tracking-[0.2em] text-[10px]">
                  {isGroupView
                    ? 'Vue consolidée ISIRO GROUP'
                    : selectedEntityId
                      ? (ENTITIES[selectedEntityId as EntityCode]?.name ?? selectedEntityId)
                      : "Vue d'ensemble du groupe"}
                </p>
              </div>
            </div>

            {/* Date filter */}
            <div className="relative" style={fadeUp(0.08)}>
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-500 pointer-events-none" />
              <select
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="appearance-none h-12 pl-10 pr-10 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer border-2 border-emerald-100 bg-white text-emerald-950 hover:border-emerald-400 transition-all shadow-sm shadow-emerald-100/50"
              >
                <option value="all">Toutes les dates</option>
                {filterMonths.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* ── Summary strip ── */}
        <div
          className="bg-white border-2 border-emerald-100 p-2 rounded-xl flex flex-wrap items-center gap-x-6 gap-y-2 transition-all hover:border-emerald-200 shadow-sm"
          style={fadeUp(0.1)}
        >
          {[
            { label: 'Période', value: selectedDate === 'all' ? 'Toutes les dates' : filterMonths.find(m => m.value === selectedDate)?.label ?? '—' },
            { label: 'Résultat', value: `${formatNumber(stats?.netResult ?? 0)} $`, colored: true, positive: (stats?.netResult ?? 0) >= 0 },
            { label: 'Dépenses', value: `${stats?.expensesCount ?? 0} enreg.` },
          ].map(({ label, value, colored, positive }) => (
            <div key={label} className="flex items-center gap-2 px-4 py-2 bg-emerald-50/50 rounded-lg">
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-800/40">{label} ·</span>
              <span className={`text-[10px] font-black uppercase tracking-wider ${colored ? (positive ? 'text-emerald-600' : 'text-red-500') : 'text-emerald-900'}`}>
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* ── KPI Grid ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {kpis.map((kpi, i) => {
            const Icon = kpi.icon;
            return (
              <div
                key={kpi.label}
                className="bg-white border-2 border-emerald-100 p-5 sm:p-6 rounded-xl relative overflow-hidden group transition-all duration-300 hover:border-emerald-300 hover:scale-[1.02] shadow-sm shadow-emerald-100/30"
                style={{
                  ...fadeUp(0.14 + i * 0.08),
                }}
              >
                {/* Decorative background circle */}
                <div
                  className="absolute top-0 right-0 w-24 h-24 rounded-full -mr-8 -mt-8 transition-all duration-500 group-hover:scale-110 opacity-10"
                  style={{ background: kpi.color }}
                />

                <div className="flex items-center justify-between mb-5 relative z-10">
                  <div
                    className="p-3.5 rounded-xl shadow-none transition-all duration-300 group-hover:rotate-12 bg-emerald-50"
                  >
                    <Icon className="w-5 h-5" style={{ color: kpi.color }} strokeWidth={2.5} />
                  </div>
                  <div className="flex flex-col items-end">
                    <span
                      className="text-[9px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-lg"
                      style={{ background: kpi.bg, color: kpi.color }}
                    >
                      {kpi.tag}
                    </span>
                  </div>
                </div>

                <div className="relative z-10">
                  <p className="text-[9px] font-black uppercase tracking-widest mb-1 text-emerald-800/40">
                    {kpi.label}
                  </p>
                  {loading
                    ? <div className="h-8 w-28 rounded-xl animate-pulse bg-emerald-50" />
                    : <p className="text-2xl sm:text-3xl font-black text-emerald-950 tracking-tighter leading-none">
                      {kpi.value}
                    </p>}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Charts ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={fadeUp(0.44)}>

          {/* Line chart */}
          <div className="bg-white border-2 border-emerald-100 p-6 sm:p-8 rounded-xl relative overflow-hidden group shadow-sm">
            <div className="flex items-center justify-between mb-6 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-1 h-6 rounded-full bg-emerald-500" />
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-emerald-950">Flux de Trésorerie</h2>
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg text-emerald-700 bg-emerald-50 border-2 border-emerald-100/50">
                6 mois
              </span>
            </div>
            <div style={{ height: 260 }} className="relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats?.monthlyData || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(16,185,129,0.05)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#064E3B', fontWeight: 800, opacity: 0.4 }} axisLine={false} tickLine={false} dy={12} />
                  <YAxis tick={{ fontSize: 10, fill: '#064E3B', fontWeight: 800, opacity: 0.4 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                  <Tooltip
                    contentStyle={{ background: '#fff', borderRadius: 16, border: '2px solid #ecfdf5', boxShadow: '0 10px 30px rgba(6,78,59,0.08)', color: '#064E3B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }}
                    formatter={(v: number) => [`${formatNumber(v)} $`, '']}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: 24, fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#064E3B', opacity: 0.5 }} />
                  <Line type="monotone" dataKey="revenue" name="Entrées" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#fff', stroke: '#10b981', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="expenses" name="Dépenses" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: '#fff', stroke: '#f59e0b', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bar chart */}
          <div className="bg-white border-2 border-emerald-100 p-6 sm:p-8 rounded-xl relative overflow-hidden group shadow-sm">
            <div className="flex items-center justify-between mb-6 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-1 h-6 rounded-full bg-yellow-400" />
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-emerald-950">Répartition Entités</h2>
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg text-yellow-700 bg-yellow-50 border-2 border-yellow-100/50">
                Consolidé
              </span>
            </div>
            {stats?.revenueByEntity && stats.revenueByEntity.length > 0 ? (
              <div style={{ height: 260 }} className="relative z-10">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.revenueByEntity} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(16,185,129,0.05)" />
                    <XAxis dataKey="entity" tick={{ fontSize: 9, fill: '#064E3B', fontWeight: 800, opacity: 0.4 }} axisLine={false} tickLine={false} dy={12} />
                    <YAxis tick={{ fontSize: 10, fill: '#064E3B', fontWeight: 800, opacity: 0.4 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#fff', borderRadius: 16, border: '2px solid #ecfdf5', boxShadow: '0 10px 30px rgba(6,78,59,0.08)', color: '#064E3B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }}
                      formatter={(v: number) => [`${formatNumber(v)} $`, '']}
                    />
                    <Bar dataKey="revenue" name="Revenus" fill="#f59e0b" radius={[6, 6, 0, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 relative z-10" style={{ height: 260 }}>
                <div className="p-6 bg-emerald-50 rounded-full border-2 border-emerald-100 mb-4">
                  <Globe className="w-10 h-10 text-emerald-200" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-800/30">Aucune donnée consolidée</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
