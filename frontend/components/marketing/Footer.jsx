import React from 'react';
import Link from 'next/link';
import Logo from './Logo';

const cols = [
  {
    title: 'Product',
    links: [
      { label: 'Features', to: '/features' },
      { label: 'Pricing', to: '/pricing' },
      { label: 'ROI Calculator', to: '/roi-calculator' },
      { label: 'Changelog', to: '/blog' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', to: '/about' },
      { label: 'Contact', to: '/contact' },
      { label: 'Case Studies', to: '/case-studies' },
      { label: 'Blog', to: '/blog' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', to: '/' },
      { label: 'Terms', to: '/' },
      { label: 'Security', to: '/features' },
      { label: 'DPA', to: '/' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="hairline-t bg-bg mt-24" data-testid="footer">
      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-16 grid grid-cols-2 md:grid-cols-5 gap-10">
        <div className="col-span-2">
          <Logo />
          <p className="text-[13.5px] text-muted mt-4 max-w-xs leading-relaxed">
            Cash-flow forecasting for founders who prefer signal over spreadsheets.
          </p>
          <p className="overline mt-6">SOC 2 · GDPR · ISO 27001</p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <p className="overline mb-4">{c.title}</p>
            <ul className="space-y-2.5">
              {c.links.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.to}
                    className="text-[13.5px] text-muted hover:text-white transition-colors"
                    data-testid={`footer-link-${l.label.toLowerCase()}`}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="hairline-t">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <p className="text-[12px] text-muted">
            © {new Date().getFullYear()} ClearCash Labs, Inc. All rights reserved.
          </p>
          <p className="text-[12px] text-muted num">v1.0.0 · built in Bangalore</p>
        </div>
      </div>
    </footer>
  );
}
