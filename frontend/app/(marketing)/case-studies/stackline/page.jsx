"use client";
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Reveal } from '@/components/marketing/Motion';
import Button from '@/components/marketing/Button';

const METRICS = [
  { label: 'Runway extension', value: '+8.4 mo' },
  { label: 'Time to first forecast', value: '18 min' },
  { label: 'Forecast accuracy', value: '96%' },
];

export default function StacklineCaseStudy() {
  return (
    <div>
      <section className="max-w-3xl mx-auto px-5 lg:px-8 pt-16 pb-10">
        <Link href="/case-studies" className="inline-flex items-center gap-1.5 overline text-muted hover:text-white transition-colors mb-8">
          <ArrowLeft size={12} /> All case studies
        </Link>
        <Reveal>
          <p className="overline text-accent">Stackline · SaaS · 12 employees</p>
          <h1 className="mt-3 text-[36px] sm:text-[48px] font-medium tracking-tightest leading-[1.05] text-white">
            Caught a runway crisis 6 weeks before it would have been a crisis.
          </h1>
        </Reveal>

        <div className="mt-10 grid grid-cols-3 gap-3">
          {METRICS.map((m) => (
            <div key={m.label} className="bg-surface hairline rounded-card p-5">
              <p className="num text-[26px] text-positive">{m.value}</p>
              <p className="text-[12px] text-muted mt-1">{m.label}</p>
            </div>
          ))}
        </div>
      </section>

      <article className="max-w-3xl mx-auto px-5 lg:px-8 pb-24 prose-cc">
        <Reveal>
          <h2 className="text-[22px] font-medium text-white mt-10 mb-4">The situation</h2>
          <p className="text-[15px] text-muted leading-relaxed mb-5">
            Rohan Verma was six months into leading Stackline — a 12-person SaaS team building workflow automation for finance teams. The company had $420k in the bank and a burn rate of roughly $52k/mo. On paper, eight months of runway. More than enough to close the Series A that was supposed to land in Q3.
          </p>
          <p className="text-[15px] text-muted leading-relaxed mb-5">
            The problem: two of Stackline's largest enterprise customers had stretched their payment cycles from 30 to 60 days, and one had moved to quarterly invoicing. None of this showed up in the traditional cash-flow spreadsheet Rohan's CFO maintained. It only showed disbursements, not timing uncertainty.
          </p>

          <h2 className="text-[22px] font-medium text-white mt-10 mb-4">What ClearCash found</h2>
          <p className="text-[15px] text-muted leading-relaxed mb-5">
            Within twenty minutes of uploading three months of bank transactions, ClearCash's probabilistic model flagged a P10 scenario where the company would dip below $80k by week 14 — six weeks earlier than any spreadsheet projection suggested. The P50 runway was 7.2 months, not the 8+ that the static model showed.
          </p>
          <p className="text-[15px] text-muted leading-relaxed mb-5">
            The AI takeaway was blunt: <em>"Two of your top three customers have shifted to 60-day payment cycles. Combined with a $38k payroll spike in October, this creates a cash trough in weeks 11–14 that isn't visible in your current model. Consider accelerating one invoice or drawing on your credit line before week 10."</em>
          </p>

          <h2 className="text-[22px] font-medium text-white mt-10 mb-4">What they did</h2>
          <ul className="space-y-3 mb-8">
            {[
              'Offered a 2% early-payment discount to one large customer — the invoice landed in week 8',
              'Delayed one $18k vendor payment by three weeks (within contract terms)',
              'Pre-drew $50k on the existing credit facility as insurance',
            ].map((a) => (
              <li key={a} className="flex items-start gap-2.5 text-[14.5px] text-white/80">
                <CheckCircle2 size={15} className="text-positive shrink-0 mt-0.5" />
                {a}
              </li>
            ))}
          </ul>

          <blockquote className="hairline-l pl-5 border-l-2 border-accent my-8">
            <p className="text-[16px] text-white italic leading-relaxed">
              "ClearCash flagged it before our accountant did. We had six weeks to act instead of two weeks to panic. That's the difference between a controlled adjustment and an emergency fundraise."
            </p>
            <footer className="mt-3 text-[13px] text-muted">— Rohan Verma, Founder, Stackline</footer>
          </blockquote>

          <h2 className="text-[22px] font-medium text-white mt-10 mb-4">The outcome</h2>
          <p className="text-[15px] text-muted leading-relaxed mb-5">
            The cash trough that the P10 scenario had flagged never materialised as a crisis. Runway extended from a forecast 7.2 months to an actual 8.4 months — enough time to close the Series A at a better valuation and without desperate terms.
          </p>
          <p className="text-[15px] text-muted leading-relaxed">
            Stackline now runs ClearCash as a board-meeting standard. Every four weeks, the CFO pastes the P10/P50/P90 chart directly into the board deck. "It's the first slide now," Rohan says.
          </p>
        </Reveal>

        <div className="mt-16 hairline-t pt-10 flex flex-wrap items-center justify-between gap-4">
          <Link href="/case-studies" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-white transition-colors">
            <ArrowLeft size={13} /> All case studies
          </Link>
          <Button href="/contact" size="md">
            Get results like this <ArrowRight size={13} />
          </Button>
        </div>
      </article>
    </div>
  );
}
