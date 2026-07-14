import React from 'react';

// ClearCash wordmark logo — a thin square containing a compact rising bar mark, 
// followed by "clearcash" lowercase for that Linear/Vercel precision feel.
export default function Logo({ className = '' }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`} data-testid="brand-logo">
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <rect x="0.5" y="0.5" width="21" height="21" rx="4" stroke="rgba(255,255,255,0.18)" />
        <rect x="4" y="12" width="2" height="6" fill="#e0a34a" />
        <rect x="8" y="8" width="2" height="10" fill="#e0a34a" />
        <rect x="12" y="4" width="2" height="14" fill="#2fb8a0" />
        <rect x="16" y="10" width="2" height="8" fill="#a1a1aa" />
      </svg>
      <span className="text-[15px] tracking-tight font-medium text-white">
        clearcash
      </span>
    </div>
  );
}
