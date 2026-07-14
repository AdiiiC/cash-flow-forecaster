"use client";
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Reveal, Stagger, StaggerItem } from '@/components/marketing/Motion';

const POSTS = [
  { slug: 'probabilistic-forecasting-vs-spreadsheets', date: 'July 1, 2026',
    tag: 'Methodology', readTime: '7 min',
    title: 'Why your spreadsheet forecast is wrong — and how probabilistic models fix it',
    excerpt: 'Every spreadsheet cash forecast tells you one number. But the future isn\'t a single number. It\'s a distribution. Here\'s how P10/P50/P90 forecasting changes what you see — and what you can do about it.' },
  { slug: 'fx-risk-for-founders', date: 'June 17, 2026',
    tag: 'ExIm', readTime: '5 min',
    title: 'The hidden FX cost killing your cross-border margins (and how to see it)',
    excerpt: 'If you invoice in USD or EUR but settle in INR, SGD, or GBP, you\'re absorbing FX risk you probably aren\'t measuring. Here\'s the maths — and why forecasting at payment date, not invoice date, matters.' },
];

export default function BlogIndex() {
  return (
    <div>
      <section className="max-w-7xl mx-auto px-5 lg:px-8 pt-20 pb-14">
        <Reveal>
          <p className="overline">Blog</p>
          <h1 className="mt-3 text-[38px] sm:text-[52px] font-medium tracking-tightest leading-[1.05] text-white max-w-3xl">
            The ClearCash methodology.
          </h1>
          <p className="mt-5 text-[15.5px] text-muted max-w-2xl leading-relaxed">
            Long-form posts on probabilistic forecasting, FX risk, and how we think about building the right signal for founders.
          </p>
        </Reveal>
      </section>

      <section className="max-w-7xl mx-auto px-5 lg:px-8 pb-24">
        <Stagger className="grid md:grid-cols-2 gap-4 max-w-4xl">
          {POSTS.map((p) => (
            <StaggerItem key={p.slug}>
              <Link
                href={`/blog/${p.slug}`}
                className="group block bg-surface hairline rounded-card p-7 hover:border-accent/30 transition-colors h-full"
                data-testid={`blog-card-${p.slug}`}
              >
                <div className="flex items-center gap-2 mb-5">
                  <span className="overline text-accent">{p.tag}</span>
                  <span className="text-muted/40">·</span>
                  <span className="overline text-muted">{p.readTime} read</span>
                  <span className="text-muted/40">·</span>
                  <span className="overline text-muted">{p.date}</span>
                </div>
                <h2 className="text-[17px] font-medium text-white leading-snug tracking-tight">{p.title}</h2>
                <p className="mt-3 text-[13.5px] text-muted leading-relaxed">{p.excerpt}</p>
                <div className="mt-5 flex items-center gap-1.5 text-[12.5px] text-accent group-hover:gap-2 transition-all">
                  Read post <ArrowRight size={12} />
                </div>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </section>
    </div>
  );
}
