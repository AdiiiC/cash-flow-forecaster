"use client";
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Reveal } from '@/components/marketing/Motion';
import Button from '@/components/marketing/Button';

export default function Post2() {
  return (
    <div>
      <article className="max-w-3xl mx-auto px-5 lg:px-8 pt-16 pb-24">
        <Link href="/blog" className="inline-flex items-center gap-1.5 overline text-muted hover:text-white transition-colors mb-8">
          <ArrowLeft size={12} /> All posts
        </Link>
        <Reveal>
          <div className="flex items-center gap-2 mb-6">
            <span className="overline text-accent">ExIm</span>
            <span className="text-muted/40">·</span>
            <span className="overline text-muted">5 min read</span>
            <span className="text-muted/40">·</span>
            <span className="overline text-muted">June 17, 2026</span>
          </div>
          <h1 className="text-[32px] sm:text-[42px] font-medium tracking-tightest leading-[1.08] text-white">
            The hidden FX cost killing your cross-border margins
          </h1>
          <p className="mt-5 text-[16px] text-muted leading-relaxed">
            If you invoice in USD or EUR but settle in INR, SGD, or GBP, you're absorbing FX risk you probably aren't measuring.
          </p>
        </Reveal>

        <div className="mt-10 space-y-6 text-[15px] text-muted leading-relaxed">
          <Reveal>
            <h2 className="text-[22px] font-medium text-white mt-10 mb-3">The spot-rate trap</h2>
            <p>Most finance teams record FX exposure using the spot rate on invoice date. A $100k USD invoice issued on June 1 gets booked at the June 1 USD/INR rate — say, 83.40. Simple, consistent, auditable.</p>
            <p className="mt-4">The problem: you don't receive the money on June 1. You receive it 30, 45, or 60 days later. By then, the rate has moved. Over the last two years, USD/INR has drifted by an average of 1.6% over any 45-day window. On a $500k book of USD receivables, that's $8k per quarter disappearing silently.</p>
          </Reveal>

          <Reveal>
            <h2 className="text-[22px] font-medium text-white mt-10 mb-3">Forecasting at payment date</h2>
            <p>ClearCash's ExIm module models the expected FX rate at the payment <em>due</em> date, not the invoice date. We fit a rolling 90-day ARIMA model on the relevant currency pair and produce a P10/P50/P90 band for what the rate will be when the payment lands.</p>
            <p className="mt-4">For a USD→INR invoice due in 45 days, the model typically produces:</p>
            <ul className="mt-3 space-y-2 ml-4 list-disc">
              <li><strong className="text-white">P50:</strong> 83.8 (central estimate)</li>
              <li><strong className="text-white">P10:</strong> 82.1 (adverse rate — you receive less)</li>
              <li><strong className="text-white">P90:</strong> 85.4 (favourable rate — you receive more)</li>
            </ul>
            <p className="mt-4">This means you can see your worst-case INR receipt before you need to make spending decisions against it.</p>
          </Reveal>

          <Reveal>
            <h2 className="text-[22px] font-medium text-white mt-10 mb-3">What to do with this</h2>
            <p>Nimbus Logistics, one of our customers, ships goods across India, UAE, and Singapore. Before ClearCash, their CFO estimated FX exposure manually using spot rates. After switching to payment-date forecasting, they recovered 1.8% average margin on their USD receivables — by timing one large payment drawdown to hit during a favourable window flagged by the P90 band.</p>
            <p className="mt-4">You don't need a treasury team to act on this. ClearCash's AI takeaway highlights every invoice where the P10/P90 spread is wide enough to warrant attention. The rest is automated.</p>
          </Reveal>
        </div>

        <div className="mt-16 hairline-t pt-10 flex flex-wrap items-center justify-between gap-4">
          <Link href="/blog" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-white transition-colors">
            <ArrowLeft size={13} /> All posts
          </Link>
          <Button href="/contact" size="md">
            See your ExIm exposure <ArrowRight size={13} />
          </Button>
        </div>
      </article>
    </div>
  );
}
