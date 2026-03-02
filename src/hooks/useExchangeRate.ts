'use client';

import { useState, useEffect } from 'react';
import { createSupabaseClient } from '@/services/supabaseClient';

/**
 * Hook pour récupérer le taux de change actif USD/CDF
 */
export function useExchangeRate(date?: Date) {
  const [rate, setRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createSupabaseClient();

  useEffect(() => {
    fetchExchangeRate(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const fetchExchangeRate = async (targetDate?: Date) => {
    try {
      setLoading(true);
      const queryDate = targetDate ? targetDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

      // D'abord, chercher le taux pour la date spécifiée
      let { data, error } = await (supabase
        .from('exchange_rates') as any)
        .select('usd_to_cdf')
        .eq('rate_date', queryDate)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Si aucun taux trouvé pour cette date, chercher le dernier taux actif
      if (!data || error) {
        const { data: latestData, error: latestError } = await (supabase
          .from('exchange_rates') as any)
          .select('usd_to_cdf')
          .eq('is_active', true)
          .lte('rate_date', queryDate)
          .order('rate_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestData && !latestError) {
          setRate((latestData as { usd_to_cdf: number }).usd_to_cdf);
        } else {
          // Taux par défaut si aucun trouvé
          setRate(2400);
        }
      } else {
        setRate((data as { usd_to_cdf: number }).usd_to_cdf);
      }
    } catch (error) {
      console.error('Erreur lors de la récupération du taux de change:', error);
      setRate(2400); // Taux par défaut en cas d'erreur
    } finally {
      setLoading(false);
    }
  };

  /**
   * Convertit un montant USD en CDF
   */
  const convertToCDF = (usdAmount: number): number => {
    if (!rate) return usdAmount * 2400; // Taux par défaut
    return usdAmount * rate;
  };

  /**
   * Convertit un montant CDF en USD
   */
  const convertToUSD = (cdfAmount: number): number => {
    if (!rate) return cdfAmount / 2400; // Taux par défaut
    return cdfAmount / rate;
  };

  return {
    rate,
    loading,
    convertToCDF,
    convertToUSD,
    refresh: () => fetchExchangeRate(date),
  };
}

