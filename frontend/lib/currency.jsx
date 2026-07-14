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

const CurrencyCtx = createContext({ currency: CURRENCIES[0], setCurrency: () => {} });

export function CurrencyProvider({ children }) {
  const [currency, setCurrencyState] = useState(CURRENCIES[0]);

  // Persist to localStorage
  useEffect(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('cc_currency') : null;
    if (saved) {
      const found = CURRENCIES.find((c) => c.code === saved);
      if (found) setCurrencyState(found);
    }
  }, []);

  const setCurrency = (c) => {
    setCurrencyState(c);
    if (typeof localStorage !== 'undefined') localStorage.setItem('cc_currency', c.code);
  };

  return (
    <CurrencyCtx.Provider value={{ currency, setCurrency }}>
      {children}
    </CurrencyCtx.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyCtx);
}
