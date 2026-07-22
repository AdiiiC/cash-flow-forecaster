'use client';
import { createContext, useContext, useEffect, useState } from 'react';

export const CURRENCIES = [
  { code: 'USD', symbol: '$',   name: 'USD', rate: 1.00 },
  { code: 'EUR', symbol: '€',   name: 'EUR', rate: 0.92 },
  { code: 'GBP', symbol: '£',   name: 'GBP', rate: 0.79 },
  { code: 'INR', symbol: '₹',   name: 'INR', rate: 83.5 },
  { code: 'SGD', symbol: 'S$',  name: 'SGD', rate: 1.34 },
  { code: 'AED', symbol: 'AED', name: 'AED', rate: 3.67 },
];

export function fmtCurrency(usdAmount, currency) {
  const { symbol, rate } = currency;
  const n = usdAmount * rate;
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${symbol}${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${symbol}${(n / 1_000).toFixed(1)}K`;
  return `${symbol}${Math.round(n).toLocaleString()}`;
}

const CurrencyCtx = createContext({
  currency: CURRENCIES[0],
  setCurrency: () => {},
  fetchedAt: null,   // UTC ISO string of last live rate fetch
  liveRates: null,   // full rates dict from /api/fx/live
});

export function CurrencyProvider({ children }) {
  const [currency, setCurrencyState] = useState(CURRENCIES[0]);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [liveRates, setLiveRates] = useState(null);

  // Restore persisted selection
  useEffect(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('cc_currency') : null;
    if (saved) {
      const found = CURRENCIES.find((c) => c.code === saved);
      if (found) setCurrencyState(found);
    }
  }, []);

  // Fetch live rates from backend on mount and every 15 min
  useEffect(() => {
    const fetchRates = async () => {
      try {
        const base = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000';
        const res = await fetch(`${base}/api/fx/live`);
        if (!res.ok) return;
        const data = await res.json();
        setFetchedAt(data.fetched_at || data.as_of);
        setLiveRates(data.rates);

        // Patch CURRENCIES rates in-place so fmtCurrency stays accurate
        if (data.rates) {
          CURRENCIES.forEach((c) => {
            if (data.rates[c.code] !== undefined) c.rate = data.rates[c.code];
          });
        }
        // Update the active currency's rate too
        setCurrencyState((prev) => {
          if (data.rates?.[prev.code]) {
            return { ...prev, rate: data.rates[prev.code] };
          }
          return prev;
        });
      } catch {
        // Silently fall back to static rates — don't break the UI
      }
    };

    fetchRates();
    const id = setInterval(fetchRates, 15 * 60 * 1000); // every 15 min
    return () => clearInterval(id);
  }, []);

  const setCurrency = (c) => {
    // Apply live rate if we have it
    const patched = liveRates?.[c.code]
      ? { ...c, rate: liveRates[c.code] }
      : c;
    setCurrencyState(patched);
    if (typeof localStorage !== 'undefined') localStorage.setItem('cc_currency', c.code);
  };

  return (
    <CurrencyCtx.Provider value={{ currency, setCurrency, fetchedAt, liveRates }}>
      {children}
    </CurrencyCtx.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyCtx);
}

