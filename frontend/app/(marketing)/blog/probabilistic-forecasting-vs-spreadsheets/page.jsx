"use client";
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Reveal } from '@/components/marketing/Motion';
import Button from '@/components/marketing/Button';

export default function Post1() {
  return (
    <div>
      <article className="max-w-3xl mx-auto px-5 lg:px-8 pt-16 pb-24">
        <Link href="/blog" className="inline-flex items-center gap-1.5 overline text-muted hover:text-white transition-colors mb-8">
          <ArrowLeft size={12} /> All posts
        </Link>
        <Reveal>
          <div className="flex items-center gap-2 mb-6">
            <span className="overline text-accent">Methodology</span>
            <span className="text-muted/40">·</span>
            <span className="overline text-muted">7 min read</span>
            <span className="text-muted/40">·</span>
            <span className="overline text-muted">July 1, 2026</span>
          </div>
          <h1 className="text-[32px] sm:text-[42px] font-medium tracking-tightest leading-[1.08] text-white">
            Why your spreadsheet forecast is wrong — and how probabilistic models fix it
          </h1>
          <p className="mt-5 text-[16px] text-muted leading-relaxed">
            Every spreadsheet cash forecast tells you one number. But the future isn't a single number. It's a distribution.
          </p>
        </Reveal>

        <div className="mt-10 space-y-6 text-[15px] text-muted leading-relaxed">
          <Reveal>
            <h2 className="text-[22px] font-medium text-white mt-10 mb-3">The single-line problem</h2>
            <p>A typical cash-flow spreadsheet says: "We have $420k. We burn $52k/mo. We have 8.1 months." That feels precise. It isn't.</p>
            <p className="mt-4">That calculation assumes every assumption holds — that all invoices pay on time, that no unexpected cost appears, that revenue doesn't slip. In practice, 94% of forecasts are wrong by at least one of those assumptions within the first six weeks.</p>
            <p className="mt-4">The single number gives you false confidence. It tells you <em>when</em> you run out of cash, but it can't tell you <em>how likely</em> different outcomes are.</p>
          </Reveal>

          <Reveal>
            <h2 className="text-[22px] font-medium text-white mt-10 mb-3">What P10 / P50 / P90 means</h2>
            <p>A probabilistic forecast runs thousands of simulations of your cash flow — varying payment timing, FX rates, and expense shocks — and produces a distribution of outcomes.</p>
            <ul className="mt-4 space-y-2 ml-4 list-disc">
              <li><strong className="text-white">P10:</strong> Only 10% of simulations end worse than this. Your worst likely case.</li>
              <li><strong className="text-white">P50:</strong> The median. More likely to be right than a point estimate.</li>
              <li><strong className="text-white">P90:</strong> Only 10% of simulations end better than this. Your best likely case.</li>
            </ul>
            <p className="mt-4">When you see the P10 runway at 6.4 months and the P90 at 10.1 months, you have real information: the risk of a short runway is quantified, not hidden.</p>
          </Reveal>

          <Reveal>
            <h2 className="text-[22px] font-medium text-white mt-10 mb-3">How ClearCash builds the distribution</h2>
            <p>ClearCash fits a model to your last 90 days of transactions. For each cashflow category — payroll, SaaS subscriptions, enterprise invoices, FX receipts — it estimates both the expected value and the uncertainty.</p>
            <p className="mt-4">The model uses quantile regression with conformal calibration, which means the P10 and P90 bands are empirically validated against held-out data — not theoretical. Our target: P10/P90 bands that contain 85% of actual outcomes.</p>
            <p className="mt-4">Across 340+ customers over the last 12 months, we've measured 94% of 13-week P50 forecasts landing within ±10% of actuals.</p>
          </Reveal>

          <Reveal>
            <h2 className="text-[22px] font-medium text-white mt-10 mb-3">What to do with the information</h2>
            <p>The chart alone isn't enough. ClearCash generates an AI takeaway after each forecast — a two-line note written like a good CFO would write it.</p>
            <p className="mt-4">Example: <em>"P10 scenario shows a cash trough in weeks 11–14 driven by two delayed enterprise invoices and a quarterly payroll spike. Consider accelerating one invoice or drawing on your credit line before week 10."</em></p>
            <p className="mt-4">That's the point. Probabilistic forecasting doesn't just tell you what might happen — it tells you when you need to act and by how much.</p>
          </Reveal>
        </div>

        <div className="mt-16 hairline-t pt-10 flex flex-wrap items-center justify-between gap-4">
          <Link href="/blog" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-white transition-colors">
            <ArrowLeft size={13} /> All posts
          </Link>
          <Button href="/contact" size="md">
            See your forecast <ArrowRight size={13} />
          </Button>
        </div>
      </article>
    </div>
  );
}
