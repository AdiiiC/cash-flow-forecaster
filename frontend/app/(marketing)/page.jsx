"use client";
import React from 'react';
import Link from 'next/link';

import * as Accordion from '@radix-ui/react-accordion';
import {
  ArrowRight,
  Play,
  BarChart3,
  Sparkles,
  Globe2,
  Star,
  Plug,
  LineChart,
  Zap,
  Check,
  ChevronDown,
} from 'lucide-react';
import Button from '@/components/marketing/Button';
import { Reveal, Stagger, StaggerItem } from '@/components/marketing/Motion';
import DashboardMock from '@/components/marketing/DashboardMock';

const features = [
  {
    icon: BarChart3,
    title: 'Probabilistic forecasting',
    body: 'Every projection ships with P10, P50 and P90 bands — so you know the shape of the risk, not just a single number.',
    tag: 'Monte Carlo',
  },
  {
    icon: Sparkles,
    title: 'AI-generated takeaways',
    body: 'A short, human-written bullet summary of what changed, what to watch, and what to do — refreshed on every close.',
    tag: 'GPT-powered',
  },
  {
    icon: Globe2,
    title: 'Multi-currency ExIm',
    body: 'Track cross-border invoices with predicted FX at payment date — not spot. Built for founders who bill in three currencies.',
    tag: '12 currencies',
  },
];

const stats = [
  { k: '340+', label: 'Companies onboarded' },
  { k: '$2.1B', label: 'Cash-flow tracked' },
  { k: '94%', label: 'Forecast accuracy ±10%' },
  { k: '12', label: 'Supported currencies' },
];

const steps = [
  {
    icon: Plug,
    n: '01',
    title: 'Connect',
    body: 'Bank feeds, accounting, invoicing. 60-second read-only OAuth.',
  },
  {
    icon: LineChart,
    n: '02',
    title: 'Forecast',
    body: 'Probabilistic model rebuilds every hour. FX priced at payment date.',
  },
  {
    icon: Zap,
    n: '03',
    title: 'Act',
    body: 'AI flags variance, suggests moves, and drops takeaways into Slack.',
  },
];

const testimonials = [
  {
    quote:
      'We caught a runway crisis 6 weeks early because ClearCash flagged it before our accountant did.',
    name: 'Rohan Verma',
    role: 'Founder, Stackline',
    meta: 'SaaS · 12 employees',
    init: 'RV',
  },
  {
    quote:
      'The ExIm FX prediction alone saved us ₹4L on a USD invoice last quarter.',
    name: 'Mei Lin',
    role: 'CFO, Nimbus Logistics',
    meta: 'Cross-border · 48 employees',
    init: 'ML',
  },
  {
    quote:
      "Our board meetings went from 'what's our burn?' to actually discussing strategy.",
    name: 'Carlos Reyes',
    role: 'CEO, Volt Health',
    meta: 'Health-tech · 30 employees',
    init: 'CR',
  },
];

const tiers = [
  {
    name: 'Starter',
    price: 'Free',
    per: 'forever',
    desc: 'For solo founders getting a handle on runway.',
    features: ['1 user seat', '13-week forecast horizon', 'CSV upload', 'Weekly email digest'],
    cta: { label: 'Start free', to: '/contact' },
  },
  {
    name: 'Growth',
    price: '$49',
    per: '/ month',
    desc: 'For teams closing the books and running scenarios.',
    features: [
      '5 user seats',
      '2-year forecast horizon',
      'XLSX upload',
      'AI-generated takeaways',
      'Multi-currency ExIm',
    ],
    cta: { label: 'Start 14-day trial', to: '/contact' },
    featured: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    per: 'contact us',
    desc: 'For finance teams with SSO, audit and on-prem needs.',
    features: [
      'Unlimited seats',
      'SSO (SAML / OIDC)',
      'Dedicated support',
      'On-prem deployment',
      'Custom SLA',
    ],
    cta: { label: 'Talk to sales', to: '/contact' },
  },
];

const faqs = [
  {
    q: 'How is ClearCash different from a spreadsheet forecast?',
    a: 'Spreadsheets give you a single line. ClearCash gives you a distribution — P10 / P50 / P90 — driven by your real transaction history, updated hourly, with FX modelled at payment date rather than spot.',
  },
  {
    q: 'Which accounting and banking integrations do you support?',
    a: 'QuickBooks, Xero, Zoho Books, Netsuite, and 40+ banks in the US, UK, EU, India and Singapore. Everything is read-only OAuth — we never touch your money.',
  },
  {
    q: 'Do I need a finance team to use it?',
    a: 'No. Starter is designed for solo founders. The AI takeaways read like a two-line note from a good CFO — no jargon, no formulas.',
  },
  {
    q: 'How accurate are the forecasts?',
    a: '94% of our 13-week forecasts land within ±10% of actuals, averaged across 340+ customers over the last 12 months. Every forecast ships with its own confidence band.',
  },
  {
    q: 'Is my financial data secure?',
    a: 'Yes. SOC 2 Type II, ISO 27001, and GDPR-compliant. Data is encrypted at rest with AES-256 and in transit with TLS 1.3. MFA is on by default.',
  },
  {
    q: 'Can I export my data?',
    a: 'Always. One-click export to CSV, XLSX, or a scheduled S3 drop. You own your data — there is no lock-in.',
  },
];

export default function Landing() {
  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden" data-testid="hero-section">
        <div className="absolute inset-0 grid-pattern opacity-40 pointer-events-none" aria-hidden />
        <div className="max-w-7xl mx-auto px-5 lg:px-8 pt-20 pb-24 lg:pt-28 lg:pb-32 relative">
          <Reveal>
            <div className="inline-flex items-center gap-2 hairline rounded-full px-3 py-1 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-positive" />
              <span className="overline">New · AI takeaways in Slack</span>
            </div>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="text-[42px] sm:text-[56px] lg:text-[72px] font-medium tracking-tightest leading-[1.02] text-white max-w-4xl">
              Know where your cash is heading —
              <span className="text-muted"> before it&apos;s too late.</span>
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 text-[16px] sm:text-[17px] text-muted leading-relaxed max-w-2xl">
              ClearCash is an AI-powered cash-flow forecasting platform for SMBs and startups.
              Probabilistic bands, multi-currency ExIm, and takeaways written like a good CFO would.
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button to="/contact" size="lg" data-testid="hero-cta-primary">
                Start free
                <ArrowRight size={15} />
              </Button>
              <Button
                to="/features"
                variant="secondary"
                size="lg"
                data-testid="hero-cta-secondary"
              >
                <Play size={13} />
                See a live demo
              </Button>
            </div>
            <div className="mt-4">
              <Link
                href="/roi-calculator"
                className="inline-flex items-center gap-1.5 text-[12.5px] text-muted hover:text-white transition-colors"
                data-testid="hero-roi-link"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                Calculate your runway extension in 30 seconds
                <ArrowRight size={12} />
              </Link>
            </div>
          </Reveal>
          <div className="mt-14 lg:mt-16">
            <DashboardMock />
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="hairline-t hairline-b bg-surface" data-testid="social-proof-section">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-10 grid grid-cols-2 md:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`px-3 py-3 ${
                i > 0 ? 'md:border-l md:border-[rgba(255,255,255,0.06)]' : ''
              }`}
            >
              <p className="num text-[26px] sm:text-[30px] text-white leading-none">{s.k}</p>
              <p className="text-[12.5px] text-muted mt-2">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="hairline-t">
          <div className="max-w-7xl mx-auto px-5 lg:px-8 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <p className="overline">Trusted by 340+ founders</p>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={13} className="text-accent fill-accent" />
              ))}
              <span className="num text-[12px] text-muted ml-2">4.9 · 128 reviews</span>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="max-w-7xl mx-auto px-5 lg:px-8 py-24" data-testid="features-section">
        <Reveal>
          <p className="overline">Why teams switch</p>
          <h2 className="mt-3 text-[30px] sm:text-[40px] font-medium tracking-tighter text-white max-w-2xl">
            Forecasts that admit they might be wrong.
          </h2>
        </Reveal>
        <Stagger className="mt-12 grid md:grid-cols-3 gap-4">
          {features.map((f) => (
            <StaggerItem key={f.title}>
              <div className="bg-surface hairline rounded-card p-7 h-full hover:bg-elevated transition-colors">
                <div className="flex items-start justify-between mb-6">
                  <div className="w-10 h-10 rounded-btn bg-elevated hairline flex items-center justify-center">
                    <f.icon size={17} className="text-accent" />
                  </div>
                  <span className="overline">{f.tag}</span>
                </div>
                <h3 className="text-[19px] font-medium text-white tracking-tight">{f.title}</h3>
                <p className="mt-2.5 text-[13.5px] leading-relaxed text-muted">{f.body}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* HOW IT WORKS */}
      <section className="hairline-t" data-testid="how-it-works-section">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-24">
          <Reveal>
            <p className="overline">How it works</p>
            <h2 className="mt-3 text-[30px] sm:text-[40px] font-medium tracking-tighter text-white max-w-2xl">
              Three steps. Twenty minutes. No spreadsheet migration.
            </h2>
          </Reveal>
          <Stagger className="mt-12 grid md:grid-cols-3 gap-0 hairline rounded-card overflow-hidden bg-surface">
            {steps.map((s, i) => (
              <StaggerItem
                key={s.n}
                className={`p-8 ${i > 0 ? 'md:border-l md:border-[rgba(255,255,255,0.06)]' : ''} ${
                  i < steps.length - 1 ? 'border-b md:border-b-0 border-[rgba(255,255,255,0.06)]' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-btn bg-elevated hairline flex items-center justify-center">
                    <s.icon size={16} className="text-accent" />
                  </div>
                  <span className="num overline">{s.n}</span>
                </div>
                <h3 className="mt-6 text-[19px] font-medium text-white tracking-tight">{s.title}</h3>
                <p className="mt-2 text-[13.5px] text-muted leading-relaxed">{s.body}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="hairline-t" data-testid="testimonials-section">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-24">
          <Reveal>
            <p className="overline">Founders on ClearCash</p>
            <h2 className="mt-3 text-[30px] sm:text-[40px] font-medium tracking-tighter text-white max-w-2xl">
              Signal, not spreadsheets.
            </h2>
          </Reveal>
          <Stagger className="mt-12 grid md:grid-cols-3 gap-4">
            {testimonials.map((t) => (
              <StaggerItem key={t.name}>
                <div className="bg-surface hairline rounded-card p-7 h-full flex flex-col">
                  <div className="flex items-center gap-1 mb-5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={12} className="text-accent fill-accent" />
                    ))}
                  </div>
                  <p className="text-[14.5px] text-white leading-relaxed flex-1">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div className="mt-6 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-btn hairline bg-elevated flex items-center justify-center">
                      <span className="num text-[11px] text-accent">{t.init}</span>
                    </div>
                    <div>
                      <p className="text-[13px] text-white">{t.name}</p>
                      <p className="text-[11.5px] text-muted">{t.role} · {t.meta}</p>
                    </div>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* PRICING */}
      <section className="hairline-t" data-testid="pricing-section">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-24">
          <Reveal>
            <p className="overline">Pricing</p>
            <h2 className="mt-3 text-[30px] sm:text-[40px] font-medium tracking-tighter text-white max-w-2xl">
              Simple pricing. No hidden seats.
            </h2>
          </Reveal>
          <Stagger className="mt-12 grid md:grid-cols-3 gap-4">
            {tiers.map((t) => (
              <StaggerItem key={t.name}>
                <div
                  className={`hairline rounded-card p-8 h-full flex flex-col ${
                    t.featured ? 'bg-elevated border-accent/40' : 'bg-surface'
                  }`}
                  style={t.featured ? { borderColor: 'rgba(224,163,74,0.3)' } : undefined}
                >
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-[17px] font-medium text-white tracking-tight">{t.name}</h3>
                    {t.featured && (
                      <span className="text-[10.5px] uppercase tracking-widest text-accent">
                        Most picked
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-[13px] text-muted">{t.desc}</p>
                  <div className="mt-8 flex items-baseline gap-1">
                    <span className="num text-[36px] text-white leading-none">{t.price}</span>
                    <span className="text-[13px] text-muted">{t.per}</span>
                  </div>
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
                    data-testid={`landing-pricing-cta-${t.name.toLowerCase()}`}
                  >
                    {t.cta.label}
                  </Button>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
          <div className="mt-8 text-center">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-white transition-colors"
              data-testid="landing-compare-plans-link"
            >
              Compare every feature
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="hairline-t" data-testid="faq-section">
        <div className="max-w-3xl mx-auto px-5 lg:px-8 py-24">
          <Reveal>
            <p className="overline">FAQ</p>
            <h2 className="mt-3 text-[30px] sm:text-[40px] font-medium tracking-tighter text-white">
              Answers, before you ask.
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="mt-10">
            <Accordion.Root type="single" collapsible className="hairline rounded-card bg-surface overflow-hidden">
              {faqs.map((f, i) => (
                <Accordion.Item
                  key={f.q}
                  value={`item-${i}`}
                  className={i < faqs.length - 1 ? 'hairline-b' : ''}
                >
                  <Accordion.Header>
                    <Accordion.Trigger
                      className="group w-full flex items-center justify-between text-left px-6 py-5 text-[14.5px] text-white hover:bg-elevated transition-colors"
                      data-testid={`faq-trigger-${i}`}
                    >
                      <span>{f.q}</span>
                      <ChevronDown
                        size={16}
                        className="text-muted transition-transform group-data-[state=open]:rotate-180"
                      />
                    </Accordion.Trigger>
                  </Accordion.Header>
                  <Accordion.Content className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                    <div className="px-6 pb-5 text-[13.5px] text-muted leading-relaxed">{f.a}</div>
                  </Accordion.Content>
                </Accordion.Item>
              ))}
            </Accordion.Root>
          </Reveal>
        </div>
      </section>

      {/* CTA BAND */}
      <section className="hairline-t">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-20 text-center">
          <Reveal>
            <h2 className="text-[30px] sm:text-[40px] font-medium tracking-tighter text-white max-w-2xl mx-auto">
              Stop forecasting like it&apos;s 2014.
            </h2>
            <p className="mt-4 text-[15px] text-muted max-w-xl mx-auto">
              Twenty-minute setup. No spreadsheet migration. Free forever on Starter.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button to="/contact" size="lg" data-testid="cta-band-primary">
                Start free
                <ArrowRight size={14} />
              </Button>
              <Button to="/pricing" variant="secondary" size="lg" data-testid="cta-band-secondary">
                See pricing
              </Button>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
