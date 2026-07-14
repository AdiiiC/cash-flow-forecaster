import React from 'react';
import {
  BarChart3,
  Activity,
  FileSpreadsheet,
  Globe2,
  Shield,
  KeyRound,
  Mail,
  Lock,
  ArrowUpRight,
} from 'lucide-react';
import { Reveal, Stagger, StaggerItem } from '../components/Motion';
import Button from '../components/Button';
import Dropzone from '../components/Dropzone';

function PageHeader({ overline, title, subtitle }) {
  return (
    <section className="max-w-7xl mx-auto px-5 lg:px-8 pt-20 pb-14" data-testid="features-hero">
      <Reveal>
        <p className="overline">{overline}</p>
        <h1 className="mt-3 text-[38px] sm:text-[52px] lg:text-[60px] font-medium tracking-tightest leading-[1.05] text-white max-w-3xl">
          {title}
        </h1>
        <p className="mt-5 text-[15.5px] text-muted max-w-2xl leading-relaxed">{subtitle}</p>
      </Reveal>
    </section>
  );
}

// ---- Section 1: Executive Dashboard ----
function ExecDashboard() {
  const kpis = [
    { l: 'Cash', v: '$246K', d: '+18.4%', pos: true },
    { l: 'Burn', v: '$41.2K', d: '−4.1%', pos: true },
    { l: 'Runway', v: '21.4 mo', d: '+2.3', pos: true },
    { l: 'MRR', v: '$62.9K', d: '+9.2%', pos: true },
  ];
  return (
    <div className="grid lg:grid-cols-5 gap-4">
      <div className="lg:col-span-3 bg-surface hairline rounded-card p-7">
        <p className="overline">Cash balance · 90 days</p>
        <div className="mt-4 h-40 relative">
          <svg viewBox="0 0 400 140" className="w-full h-full" preserveAspectRatio="none">
            <path
              d="M0,110 L40,102 L80,96 L120,88 L160,74 L200,62 L240,66 L280,50 L320,42 L360,30 L400,22"
              fill="none"
              stroke="#2fb8a0"
              strokeWidth="1.8"
            />
            <path
              d="M0,110 L40,102 L80,96 L120,88 L160,74 L200,62 L240,66 L280,50 L320,42 L360,30 L400,22 L400,140 L0,140 Z"
              fill="#2fb8a0"
              fillOpacity="0.06"
            />
          </svg>
        </div>
        <div className="grid grid-cols-4 mt-4 hairline-t pt-4">
          {kpis.map((k) => (
            <div key={k.l}>
              <p className="overline text-[10px]">{k.l}</p>
              <p className="num text-[15px] text-white mt-1">{k.v}</p>
              <p className="num text-[10.5px] text-positive">{k.d}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="lg:col-span-2 bg-surface hairline rounded-card p-7">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-btn bg-elevated hairline flex items-center justify-center">
            <BarChart3 size={13} className="text-accent" />
          </div>
          <p className="overline">AI takeaway · nov 24</p>
        </div>
        <ul className="mt-5 space-y-3.5 text-[13px] text-white/85 leading-relaxed">
          <li className="flex gap-2"><span className="text-accent">·</span> Runway extends by <span className="num text-positive">+2.3 mo</span> under P50.</li>
          <li className="flex gap-2"><span className="text-accent">·</span> Two USD invoices (<span className="num">$48,200</span>) land Nov 14.</li>
          <li className="flex gap-2"><span className="text-accent">·</span> Payroll variance <span className="num text-negative">−3.4%</span> vs plan.</li>
          <li className="flex gap-2"><span className="text-accent">·</span> Consider deferring AWS commit by 21 days.</li>
        </ul>
      </div>
    </div>
  );
}

// ---- Section 2: BI widgets ----
function BusinessIntel() {
  const items = [
    { icon: Activity, label: 'Burn rate', v: '$41,220', d: '−4.1% vs 30d', pos: true },
    { icon: BarChart3, label: 'Working capital', v: '$312K', d: '+$18K', pos: true },
    { icon: ArrowUpRight, label: 'Current ratio', v: '2.14', d: '+0.06', pos: true },
    { icon: ArrowUpRight, label: 'Quick ratio', v: '1.72', d: '+0.03', pos: true },
    { icon: ArrowUpRight, label: 'Gross margin', v: '78.4%', d: '+1.2pp', pos: true },
    { icon: ArrowUpRight, label: 'ARR', v: '$754,800', d: '+9.2%', pos: true },
  ];
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((i) => (
        <div key={i.label} className="bg-surface hairline rounded-card p-6">
          <div className="flex items-center justify-between">
            <p className="overline">{i.label}</p>
            <i.icon size={13} className="text-muted" />
          </div>
          <p className="num text-[24px] text-white mt-3">{i.v}</p>
          <p className={`num text-[11.5px] mt-1 ${i.pos ? 'text-positive' : 'text-negative'}`}>{i.d}</p>
        </div>
      ))}
    </div>
  );
}

// ---- Section 3: Actuals & Variance ----
function Variance() {
  const rows = [
    { m: 'Revenue', p: 62000, a: 64100 },
    { m: 'COGS', p: -13400, a: -12980 },
    { m: 'Payroll', p: -28000, a: -28950 },
    { m: 'AWS', p: -4200, a: -4380 },
    { m: 'Marketing', p: -6500, a: -5100 },
  ];
  const fmt = (n) => (n < 0 ? `−$${Math.abs(n).toLocaleString()}` : `$${n.toLocaleString()}`);
  return (
    <div className="grid lg:grid-cols-5 gap-4">
      <div className="lg:col-span-2 bg-surface hairline rounded-card p-7">
        <p className="overline">Upload actuals</p>
        <Dropzone />
        <p className="mt-4 text-[11.5px] text-muted">
          We auto-map columns from QuickBooks, Xero, Zoho Books, Netsuite.
        </p>
      </div>
      <div className="lg:col-span-3 bg-surface hairline rounded-card overflow-hidden">
        <div className="px-6 py-4 hairline-b flex items-center justify-between">
          <p className="overline">Actuals vs forecast · Oct 2025</p>
          <p className="num text-[11.5px] text-positive">+$4,510 net</p>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-muted hairline-b">
              <th className="px-6 py-3 font-normal overline">Line</th>
              <th className="px-4 py-3 font-normal overline text-right">Plan</th>
              <th className="px-4 py-3 font-normal overline text-right">Actual</th>
              <th className="px-6 py-3 font-normal overline text-right">Δ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const delta = r.a - r.p;
              return (
                <tr key={r.m} className="hairline-b last:border-0">
                  <td className="px-6 py-3 text-white">{r.m}</td>
                  <td className="px-4 py-3 num text-right text-muted">{fmt(r.p)}</td>
                  <td className="px-4 py-3 num text-right text-white">{fmt(r.a)}</td>
                  <td className={`px-6 py-3 num text-right ${delta >= 0 ? 'text-positive' : 'text-negative'}`}>
                    {delta >= 0 ? '+' : '−'}${Math.abs(delta).toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- Section 4: ExIm & Config ----
function ExImConfig() {
  const fx = [
    { p: 'USD', t: 'INR', r: '83.42', d: '+0.14%' },
    { p: 'EUR', t: 'USD', r: '1.087', d: '−0.08%' },
    { p: 'GBP', t: 'EUR', r: '1.163', d: '+0.21%' },
    { p: 'SGD', t: 'USD', r: '0.744', d: '+0.05%' },
    { p: 'JPY', t: 'USD', r: '0.0067', d: '−0.11%' },
  ];
  const invoices = [
    { id: 'INV-2841', c: 'Acme Berlin', amt: '€24,500', due: 'Nov 14', fx: '1.087 → 1.093' },
    { id: 'INV-2853', c: 'Nimbus SG', amt: 'S$18,200', due: 'Nov 22', fx: '0.744 → 0.749' },
    { id: 'INV-2860', c: 'Stackline UK', amt: '£9,800', due: 'Dec 04', fx: '1.267 → 1.271' },
  ];
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="bg-surface hairline rounded-card p-7">
        <div className="flex items-center gap-2">
          <Globe2 size={14} className="text-accent" />
          <p className="overline">Live FX · 12 currencies</p>
        </div>
        <table className="w-full mt-5 text-[13px]">
          <thead>
            <tr className="text-left text-muted hairline-b">
              <th className="py-2 font-normal overline">Pair</th>
              <th className="py-2 font-normal overline text-right">Rate</th>
              <th className="py-2 font-normal overline text-right">24h</th>
            </tr>
          </thead>
          <tbody>
            {fx.map((f) => (
              <tr key={f.p + f.t} className="hairline-b last:border-0">
                <td className="py-2.5 num text-white">{f.p} / {f.t}</td>
                <td className="py-2.5 num text-white text-right">{f.r}</td>
                <td className={`py-2.5 num text-right ${f.d.startsWith('+') ? 'text-positive' : 'text-negative'}`}>{f.d}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-5 text-[12px] text-muted leading-relaxed">
          Cross-border invoices are priced at <span className="text-white">predicted FX on payment date</span> — not spot — using a rolling 90-day volatility model.
        </p>
      </div>
      <div className="bg-surface hairline rounded-card overflow-hidden">
        <div className="px-6 py-4 hairline-b flex items-center justify-between">
          <p className="overline">Cross-border invoices · open</p>
          <p className="num text-[11.5px] text-accent">3 pending</p>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-muted hairline-b">
              <th className="px-5 py-2.5 font-normal overline">Invoice</th>
              <th className="px-3 py-2.5 font-normal overline text-right">Amount</th>
              <th className="px-3 py-2.5 font-normal overline text-right">Due</th>
              <th className="px-5 py-2.5 font-normal overline text-right">FX (spot→pay)</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((i) => (
              <tr key={i.id} className="hairline-b last:border-0">
                <td className="px-5 py-3">
                  <p className="num text-white text-[12.5px]">{i.id}</p>
                  <p className="text-[11px] text-muted mt-0.5">{i.c}</p>
                </td>
                <td className="px-3 py-3 num text-white text-right">{i.amt}</td>
                <td className="px-3 py-3 num text-muted text-right">{i.due}</td>
                <td className="px-5 py-3 num text-positive text-right text-[11.5px]">{i.fx}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- Section 5: Security ----
function Security() {
  const sec = [
    { icon: KeyRound, l: 'MFA · TOTP', d: 'Authenticator app enrollment (RFC 6238)' },
    { icon: Mail, l: 'Email OTP', d: 'Rate-limited 6-digit codes as MFA backup' },
    { icon: Lock, l: 'JWT auth', d: 'Short-lived access + rotating refresh tokens' },
    { icon: Shield, l: 'Bcrypt', d: 'Passwords hashed at cost factor 12' },
  ];
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="bg-surface hairline rounded-card p-7">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-accent" />
          <p className="overline">Authentication</p>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          {sec.map((s) => (
            <div key={s.l} className="hairline rounded-card p-4 bg-elevated">
              <s.icon size={14} className="text-accent" />
              <p className="text-[13px] text-white mt-3">{s.l}</p>
              <p className="text-[11.5px] text-muted mt-1 leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-surface hairline rounded-card p-7">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-accent" />
          <p className="overline">Compliance & infrastructure</p>
        </div>
        <ul className="mt-5 space-y-3 text-[13px]">
          <li className="flex items-start gap-2.5">
            <div className="w-1 h-1 rounded-full bg-positive mt-2 shrink-0" />
            <span className="text-white/90">SOC 2 Type II — audited annually by an independent CPA firm</span>
          </li>
          <li className="flex items-start gap-2.5">
            <div className="w-1 h-1 rounded-full bg-positive mt-2 shrink-0" />
            <span className="text-white/90">ISO 27001 certified · GDPR-compliant · CCPA-ready</span>
          </li>
          <li className="flex items-start gap-2.5">
            <div className="w-1 h-1 rounded-full bg-positive mt-2 shrink-0" />
            <span className="text-white/90">Data encrypted at rest with <span className="num">AES-256</span>, in transit with <span className="num">TLS 1.3</span></span>
          </li>
          <li className="flex items-start gap-2.5">
            <div className="w-1 h-1 rounded-full bg-positive mt-2 shrink-0" />
            <span className="text-white/90">Read-only OAuth to your books · we never hold or move funds</span>
          </li>
        </ul>
        <div className="mt-6 flex flex-wrap gap-1.5">
          {['SOC 2 Type II', 'ISO 27001', 'GDPR', 'AES-256', 'TLS 1.3', 'PCI-DSS SAQ-A'].map((b) => (
            <span key={b} className="text-[11px] px-2.5 py-1 rounded-full hairline text-muted num">{b}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

const capabilities = [
  { key: 'exec', icon: BarChart3, title: 'Executive Dashboard', tag: '01 · Overview', body: 'One glance. Cash balance, burn, runway, MRR — all with confidence bands and AI takeaways written like a good CFO would.' },
  { key: 'bi', icon: Activity, title: 'Business Intelligence', tag: '02 · Depth', body: 'Burn rate, working capital, current & quick ratios, gross margin, ARR waterfall. Every metric is exportable.' },
  { key: 'act', icon: FileSpreadsheet, title: 'Actuals & Variance', tag: '03 · Truth', body: 'Upload CSV or XLSX. We auto-map columns, compare against plan, and colour variance line by line.' },
  { key: 'ex', icon: Globe2, title: 'ExIm & Config', tag: '04 · Global', body: 'Cross-border invoices priced at predicted FX on payment date. 12 currencies, one clean view.' },
  { key: 'sec', icon: Shield, title: 'Security', tag: '05 · Trust', body: 'MFA (TOTP + email OTP), JWT, bcrypt, SOC 2 Type II, ISO 27001, GDPR. Read-only OAuth to your books.' },
];

export default function Features() {
  return (
    <div>
      <PageHeader
        overline="Product · Features"
        title="Everything a finance team needs. Nothing they don't."
        subtitle="ClearCash is built by engineers who got tired of copying numbers between tabs. Five modules. Zero fluff."
      />

      {/* Capability strip */}
      <section className="max-w-7xl mx-auto px-5 lg:px-8 pb-16">
        <Stagger className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {capabilities.map((c) => (
            <StaggerItem key={c.key}>
              <a
                href={`#${c.key}`}
                className="block bg-surface hairline rounded-card p-5 hover:bg-elevated transition-colors h-full"
                data-testid={`features-nav-${c.key}`}
              >
                <span className="overline">{c.tag}</span>
                <div className="mt-4 flex items-center gap-2">
                  <c.icon size={15} className="text-accent" />
                  <p className="text-[13.5px] text-white">{c.title}</p>
                </div>
              </a>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* Section blocks */}
      {capabilities.map((c) => (
        <section key={c.key} id={c.key} className="hairline-t scroll-mt-24">
          <div className="max-w-7xl mx-auto px-5 lg:px-8 py-20">
            <Reveal>
              <div className="grid lg:grid-cols-12 gap-8 mb-10">
                <div className="lg:col-span-5">
                  <p className="overline">{c.tag}</p>
                  <h2 className="mt-3 text-[28px] sm:text-[36px] font-medium tracking-tighter text-white">
                    {c.title}
                  </h2>
                </div>
                <div className="lg:col-span-6 lg:col-start-7">
                  <p className="text-[14.5px] text-muted leading-relaxed">{c.body}</p>
                </div>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              {c.key === 'exec' && <ExecDashboard />}
              {c.key === 'bi' && <BusinessIntel />}
              {c.key === 'act' && <Variance />}
              {c.key === 'ex' && <ExImConfig />}
              {c.key === 'sec' && <Security />}
            </Reveal>
          </div>
        </section>
      ))}

      {/* CTA */}
      <section className="hairline-t">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-20 text-center">
          <h2 className="text-[28px] sm:text-[36px] font-medium tracking-tighter text-white">
            See it running on your own numbers.
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button to="/contact" size="lg" data-testid="features-cta-demo">
              Book a 20-min demo
            </Button>
            <Button to="/pricing" variant="secondary" size="lg" data-testid="features-cta-pricing">
              See pricing
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
