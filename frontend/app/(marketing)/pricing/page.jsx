"use client";
import React, { useEffect, useState } from 'react';
import { Check, Minus, ArrowRight, X } from 'lucide-react';
import Link from 'next/link';
import { Reveal, Stagger, StaggerItem } from '@/components/marketing/Motion';
import Button from '@/components/marketing/Button';
import { useCurrency } from '@/lib/currency';

const rawTiers = [
  {
    key: 'starter',
    name: 'Starter',
    priceM: 0,
    priceA: 0,
    desc: 'Solo founders getting a handle on runway.',
    features: [
      '1 user seat',
      '13-week forecast horizon',
      'CSV upload',
      'Weekly email digest',
      'Community support',
    ],
    cta: { label: 'Start free', to: '/contact' },
  },
  {
    key: 'growth',
    name: 'Growth',
    priceM: 49,
    priceA: 490,
    desc: 'Teams closing books and running scenarios.',
    features: [
      '5 user seats',
      '2-year forecast horizon',
      'XLSX upload',
      'AI-generated takeaways',
      'Multi-currency ExIm',
      'Slack + email alerts',
      'Priority support',
    ],
    cta: { label: 'Start 14-day trial', to: '/contact' },
    featured: true,
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    desc: 'Finance teams with SSO, audit and on-prem needs.',
    features: [
      'Unlimited seats',
      'SSO (SAML / OIDC)',
      'Dedicated CSM',
      'On-prem deployment',
      'Custom SLA & DPA',
      'Audit log export',
    ],
    cta: { label: 'Talk to sales', to: '/contact' },
  },
];

const matrixRows = [
  { label: 'Forecast horizon', s: '13 weeks', g: '2 years', e: 'Unlimited' },
  { label: 'User seats', s: '1', g: '5', e: 'Unlimited' },
  { label: 'CSV upload', s: true, g: true, e: true },
  { label: 'XLSX upload', s: false, g: true, e: true },
  { label: 'Probabilistic bands (P10/P50/P90)', s: true, g: true, e: true },
  { label: 'AI-generated takeaways', s: false, g: true, e: true },
  { label: 'Multi-currency ExIm', s: false, g: true, e: true },
  { label: 'Slack + email alerts', s: false, g: true, e: true },
  { label: 'MFA (TOTP + email OTP)', s: true, g: true, e: true },
  { label: 'SSO (SAML / OIDC)', s: false, g: false, e: true },
  { label: 'Audit log export', s: false, g: false, e: true },
  { label: 'On-prem deployment', s: false, g: false, e: true },
  { label: 'Dedicated CSM', s: false, g: false, e: true },
  { label: 'Custom SLA & DPA', s: false, g: false, e: true },
];

function Cell({ v }) {
  if (v === true) return <Check size={14} className="text-positive" />;
  if (v === false) return <Minus size={14} className="text-muted/60" />;
  return <span className="text-[13px] text-white num">{v}</span>;
}

function formatPrice(tier, annual, currency) {
  if (tier.price) return tier.price;
  if (tier.priceM === 0) return 'Free';
  const usd = annual ? tier.priceA / 12 : tier.priceM;
  const converted = Math.round(usd * currency.rate);
  return `${currency.symbol}${converted}`;
}

function formatPer(tier, annual) {
  if (tier.price) return 'contact us';
  if (tier.priceM === 0) return 'forever';
  if (annual) return '/ mo, billed annually';
  return '/ month';
}

function formatSaving(tier, currency) {
  if (!tier.priceM) return null;
  const annualUSD = tier.priceA;
  const monthlyTotalUSD = tier.priceM * 12;
  const saved = Math.round((monthlyTotalUSD - annualUSD) * currency.rate);
  const billed = Math.round(annualUSD * currency.rate);
  return { billed: `${currency.symbol}${billed}`, saved: `${currency.symbol}${saved}` };
}

export default function Pricing() {
  const [annual, setAnnual] = useState(false);
  const [exitModal, setExitModal] = useState(false);
  const [exitShown, setExitShown] = useState(false);
  const { currency } = useCurrency();

  useEffect(() => {
    const handler = (e) => {
      if (e.clientY <= 0 && !exitShown) {
        setExitModal(true);
        setExitShown(true);
      }
    };
    document.addEventListener('mouseleave', handler);
    return () => document.removeEventListener('mouseleave', handler);
  }, [exitShown]);

  return (
    <div>
      {/* Exit-intent modal */}
      {exitModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          data-testid="pricing-exit-modal"
          onClick={() => setExitModal(false)}
        >
          <div
            className="bg-elevated hairline rounded-card p-8 max-w-md w-full shadow-subtle relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setExitModal(false)}
              className="absolute top-4 right-4 text-muted hover:text-white transition-colors"
              aria-label="Close"
            >
              <X size={16} />
            </button>
            <p className="overline text-accent">Before you go</p>
            <h2 className="mt-3 text-[22px] font-medium text-white leading-snug tracking-tight">
              Talk to a founder for 10&nbsp;min.
            </h2>
            <p className="mt-3 text-[13.5px] text-muted leading-relaxed">
              Not ready to commit? No deck, no pitch. Just a real conversation about your cash-flow problem — book a slot and we&apos;ll call you back within the hour.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Link
                href="/contact"
                onClick={() => setExitModal(false)}
                className="flex items-center justify-center gap-2 bg-accent hover:bg-[#f0b25c] text-bg rounded-btn py-2.5 text-[13.5px] font-medium transition-colors"
                data-testid="pricing-exit-modal-cta"
              >
                Book 10-min chat <ArrowRight size={13} />
              </Link>
              <button
                onClick={() => setExitModal(false)}
                className="text-[12.5px] text-muted hover:text-white transition-colors py-2"
              >
                No thanks, I&apos;ll figure it out myself
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <section className="max-w-7xl mx-auto px-5 lg:px-8 pt-20 pb-14" data-testid="pricing-hero">
        <Reveal>
          <p className="overline">Pricing</p>
          <h1 className="mt-3 text-[38px] sm:text-[52px] lg:text-[60px] font-medium tracking-tightest leading-[1.05] text-white max-w-3xl">
            Simple pricing. No hidden seats.
          </h1>
          <p className="mt-5 text-[15.5px] text-muted max-w-2xl leading-relaxed">
            Start free forever. Grow when you need bands, takeaways and ExIm. Talk to us when you need SSO and on-prem.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="mt-8">
          <div
            className="inline-flex items-center hairline rounded-full p-1 bg-surface"
            data-testid="pricing-toggle"
          >
            <button
              onClick={() => setAnnual(false)}
              className={`text-[12.5px] px-4 py-1.5 rounded-full transition-colors ${
                !annual ? 'bg-elevated text-white' : 'text-muted'
              }`}
              data-testid="pricing-toggle-monthly"
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`text-[12.5px] px-4 py-1.5 rounded-full transition-colors flex items-center gap-2 ${
                annual ? 'bg-elevated text-white' : 'text-muted'
              }`}
              data-testid="pricing-toggle-annual"
            >
              Annual
              <span className="text-[10.5px] px-1.5 py-0.5 rounded-full bg-accent/15 text-accent">
                2 months free
              </span>
            </button>
          </div>
        </Reveal>
      </section>

      {/* Cards */}
      <section className="max-w-7xl mx-auto px-5 lg:px-8 pb-16">
        <Stagger className="grid md:grid-cols-3 gap-4">
          {rawTiers.map((t) => {
            const price = formatPrice(t, annual, currency);
            const per = formatPer(t, annual);
            const saving = t.priceM > 0 && annual ? formatSaving(t, currency) : null;
            return (
              <StaggerItem key={t.key}>
                <div
                  className={`hairline rounded-card p-8 h-full flex flex-col ${
                    t.featured ? 'bg-elevated' : 'bg-surface'
                  }`}
                  style={t.featured ? { borderColor: 'rgba(224,163,74,0.32)' } : undefined}
                  data-testid={`pricing-card-${t.key}`}
                >
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-[17px] font-medium text-white tracking-tight">{t.name}</h3>
                    {t.featured && (
                      <span className="text-[10.5px] uppercase tracking-widest text-accent">
                        Most picked
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-[13px] text-muted min-h-[36px]">{t.desc}</p>
                  <div className="mt-8 flex items-baseline gap-1">
                    <span className="num text-[36px] text-white leading-none">{price}</span>
                    <span className="text-[13px] text-muted">{per}</span>
                  </div>
                  {t.priceM > 0 && annual && saving && (
                    <p className="mt-2 text-[11.5px] num text-muted">
                      {saving.billed} billed once · save {saving.saved}
                    </p>
                  )}
                  <ul className="mt-8 space-y-2.5 flex-1">
                    {t.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-[13px] text-white/85">
                        <Check size={13} className="text-positive mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    to={t.cta.to}
                    variant={t.featured ? 'primary' : 'secondary'}
                    className="mt-8 w-full justify-center"
                    data-testid={`pricing-cta-${t.key}`}
                  >
                    {t.cta.label}
                    <ArrowRight size={13} />
                  </Button>
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>
      </section>

      {/* Comparison table */}
      <section className="hairline-t">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-20">
          <Reveal>
            <p className="overline">Compare</p>
            <h2 className="mt-3 text-[28px] sm:text-[36px] font-medium tracking-tighter text-white">
              Every feature, side by side.
            </h2>
          </Reveal>
          <Reveal delay={0.08} className="mt-10 overflow-x-auto">
            <table
              className="w-full text-[13.5px] hairline rounded-card overflow-hidden bg-surface min-w-[640px]"
              data-testid="pricing-comparison-table"
            >
              <thead>
                <tr className="hairline-b">
                  <th className="text-left px-6 py-4 font-normal overline w-[42%]">Feature</th>
                  <th className="px-6 py-4 font-normal overline">Starter</th>
                  <th className="px-6 py-4 font-normal overline text-accent">Growth</th>
                  <th className="px-6 py-4 font-normal overline">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {matrixRows.map((r, i) => (
                  <tr
                    key={r.label}
                    className={i < matrixRows.length - 1 ? 'hairline-b' : ''}
                  >
                    <td className="px-6 py-3 text-white/90">{r.label}</td>
                    <td className="px-6 py-3 text-center"><span className="inline-flex"><Cell v={r.s} /></span></td>
                    <td className="px-6 py-3 text-center"><span className="inline-flex"><Cell v={r.g} /></span></td>
                    <td className="px-6 py-3 text-center"><span className="inline-flex"><Cell v={r.e} /></span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
        </div>
      </section>

      {/* CTA band */}
      <section className="hairline-t">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-20 text-center">
          <h2 className="text-[28px] sm:text-[36px] font-medium tracking-tighter text-white">
            Not sure which fits? Talk to us.
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button to="/contact" size="lg" data-testid="pricing-cta-demo">
              Book a 20-min demo
              <ArrowRight size={14} />
            </Button>
            <Button to="/features" variant="secondary" size="lg" data-testid="pricing-cta-features">
              Explore features
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
