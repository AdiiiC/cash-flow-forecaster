import React, { useEffect, useState } from 'react';

const KEY = 'clearcash-cookie-consent';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(KEY);
    if (!stored) {
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  if (!visible) return null;

  const decide = (choice) => {
    localStorage.setItem(KEY, choice);
    setVisible(false);
  };

  return (
    <div
      className="fixed bottom-5 right-5 left-5 md:left-auto md:max-w-sm z-50 bg-surface hairline rounded-card p-5 shadow-subtle"
      data-testid="cookie-banner"
    >
      <p className="text-[13px] text-white font-medium mb-1">Cookies</p>
      <p className="text-[12.5px] text-muted leading-relaxed">
        We use minimal analytics cookies to understand how ClearCash is used. No third-party ad tracking.
      </p>
      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={() => decide('accepted')}
          className="text-[12.5px] font-medium text-bg bg-accent hover:bg-[#f0b25c] px-3 py-1.5 rounded-btn transition-colors"
          data-testid="cookie-accept-btn"
        >
          Accept
        </button>
        <button
          onClick={() => decide('rejected')}
          className="text-[12.5px] text-muted hover:text-white px-3 py-1.5 rounded-btn hairline transition-colors"
          data-testid="cookie-reject-btn"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
