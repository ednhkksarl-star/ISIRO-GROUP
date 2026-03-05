'use client';

import { useState, useEffect, useCallback } from 'react';
import { createSupabaseClient } from '@/services/supabaseClient';

/**
 * Hook pour récupérer le taux de change actif USD/CDF.
 * Stratégie de fallback en 3 niveaux :
 *  1. Taux actif pour la date exacte
 *  2. Dernier taux actif disponible (≤ date)
 *  3. Tout dernier taux (actif ou non), pour éviter le hardcode 2400
 */
export function useExchangeRate(date?: Date) {
  const [rate, setRate] = useState<number | null>(null);
  const [rateDate, setRateDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createSupabaseClient();

  const fetchExchangeRate = useCallback(async (targetDate?: Date) => {
    try {
      setLoading(true);
      const queryDate = targetDate
        ? targetDate.toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      // Niveau 1: Taux actif pour la date exacte
      const { data: exactData } = await (supabase
        .from('exchange_rates') as any)
        .select('usd_to_cdf, rate_date')
        .eq('rate_date', queryDate)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (exactData) {
        setRate((exactData as { usd_to_cdf: number; rate_date: string }).usd_to_cdf);
        setRateDate((exactData as { usd_to_cdf: number; rate_date: string }).rate_date);
        return;
      }

      // Niveau 2: Dernier taux actif ≤ date demandée
      const { data: recentActive } = await (supabase
        .from('exchange_rates') as any)
        .select('usd_to_cdf, rate_date')
        .eq('is_active', true)
        .lte('rate_date', queryDate)
        .order('rate_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentActive) {
        setRate((recentActive as { usd_to_cdf: number; rate_date: string }).usd_to_cdf);
        setRateDate((recentActive as { usd_to_cdf: number; rate_date: string }).rate_date);
        return;
      }

      // Niveau 3: Tout dernier taux (actif ou non) — pas de fallback hardcodé
      const { data: anyRate } = await (supabase
        .from('exchange_rates') as any)
        .select('usd_to_cdf, rate_date')
        .order('rate_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (anyRate) {
        setRate((anyRate as { usd_to_cdf: number; rate_date: string }).usd_to_cdf);
        setRateDate((anyRate as { usd_to_cdf: number; rate_date: string }).rate_date);
        return;
      }

      // Aucun taux en base: utiliser 2400 comme valeur par défaut absolue
      setRate(2400);
      setRateDate(null);
    } catch (error) {
      console.error('Erreur lors de la récupération du taux de change:', error);
      setRate(2400); // Taux par défaut en cas d'erreur réseau
      setRateDate(null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchExchangeRate(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date?.toISOString()]);

  /**
   * Convertit un montant USD en CDF
   */
  const convertToCDF = (usdAmount: number): number => {
    const appliedRate = rate ?? 2400;
    return usdAmount * appliedRate;
  };

  /**
   * Convertit un montant CDF en USD
   */
  const convertToUSD = (cdfAmount: number): number => {
    const appliedRate = rate ?? 2400;
    return cdfAmount / appliedRate;
  };

  return {
    rate,
    rateDate,
    loading,
    convertToCDF,
    convertToUSD,
    refresh: () => fetchExchangeRate(date),
  };
}
