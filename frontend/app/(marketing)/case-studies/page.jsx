"use client";
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Reveal, Stagger, StaggerItem } from '@/components/marketing/Motion';

const CASES = [
  { slug: 'stackline', company: 'Stackline', industry: 'SaaS · 12 employees', logo: 'S',
    headline: 'Caught a runway crisis 6 weeks early', result: '+8.4 months runway',
    quote: 'ClearCash flagged it before our accountant did.' },
  { slug: 'nimbus', company: 'Nimbus Logistics', industry: 'Cross-border · 48 employees', logo: 'N',
    headline: '₹4L saved on a single USD invoice', result: '1.8% FX margin recovered',
    quote: 'The ExIm FX prediction paid for a year of the plan in one quarter.' },
  { slug: 'volt-health', company: 'Volt Health', industry: 'Health-tech · 30 employees', logo: 'V',
    headline: 'Board meetings shifted from burn to strategy', result: '60% less time on finance prep',
    quote: "We stopped asking 'what's our burn?' and started asking 'what do we build next?'" },
];

export default function CaseStudiesIndex() {
  return (
    <div>
      <section className="max-w-7xl mx-auto px-5 lg:px-8 pt-20 pb-14">
        <Reveal>
          <p className="overline">Case studies</p>
          <h1 className="mt-3 text-[38px] sm:text-[52px] font-medium tracking-tightest leading-[1.05] text-white max-w-3xl">
            Real results from real founders.
          </h1>
          <p className="mt-5 text-[15.5px] text-muted max-w-2xl leading-relaxed">
            How teams across SaaS, logistics, and health-tech use ClearCash to see further and move faster.
          </p>
        </Reveal>
      </section>

      <section className="max-w-7xl mx-auto px-5 lg:px-8 pb-24">
        <Stagger className="grid md:grid-cols-3 gap-4">
          {CASES.map((c) => (
            <StaggerItem key={c.slug}>
              <Link
                href={`/case-studies/${c.slug}`}
                className="group block bg-surface hairline rounded-card p-7 hover:border-accent/30 transition-colors"
                data-testid={`case-study-card-${c.slug}`}
              >
                <div className="w-10 h-10 rounded-btn bg-elevated hairline flex items-center justify-center text-[17px] font-bold text-accent">
                  {c.logo}
                </div>
                <p className="mt-5 text-[12.5px] text-muted">{c.industry}</p>
                <h2 className="mt-1 text-[17px] font-medium text-white leading-snug tracking-tight">{c.company}</h2>
                <p className="mt-3 text-[13.5px] text-white/80 leading-relaxed">{c.headline}</p>
                <p className="mt-4 num text-[22px] text-positive">{c.result}</p>
                <p className="mt-3 text-[13px] text-muted italic">"{c.quote}"</p>
                <div className="mt-5 flex items-center gap-1.5 text-[12.5px] text-accent group-hover:gap-2 transition-all">
                  Read case study <ArrowRight size={12} />
                </div>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </section>
    </div>
  );
}
