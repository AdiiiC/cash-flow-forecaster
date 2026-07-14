import React from 'react';
import { Github, Linkedin, Twitter } from 'lucide-react';
import { Reveal, Stagger, StaggerItem } from '../components/Motion';
import Button from '../components/Button';

const team = [
  {
    name: 'Arjun Mehta',
    role: 'Co-founder & CEO',
    bio: 'Previously PM at Razorpay. IIT Bombay. Believes finance software should feel like a code editor.',
    init: 'AM',
    color: '#e0a34a',
  },
  {
    name: 'Priya Nair',
    role: 'Co-founder & CTO',
    bio: 'Ex-backend engineer at Zerodha. Loves FastAPI and distributed systems.',
    init: 'PN',
    color: '#2fb8a0',
  },
  {
    name: 'Daniel Osei',
    role: 'Head of Growth',
    bio: 'Former fintech consultant at Deloitte. Speaks CFO and founder fluently.',
    init: 'DO',
    color: '#e0644f',
  },
];

const stack = ['FastAPI', 'Next.js', 'PostgreSQL', 'OpenAI', 'Redis', 'Docker', 'MongoDB', 'Kubernetes'];

const values = [
  {
    n: '01',
    t: 'Signal, not noise',
    b: 'Every metric you see must change a decision. No vanity dashboards.',
  },
  {
    n: '02',
    t: 'Own the math',
    b: 'We publish our forecasting methodology. No black boxes.',
  },
  {
    n: '03',
    t: 'Respect the data',
    b: 'Your books are yours. Read-only OAuth, encrypted at rest, exportable always.',
  },
];

export default function About() {
  return (
    <div>
      {/* Mission */}
      <section className="max-w-4xl mx-auto px-5 lg:px-8 pt-24 pb-16" data-testid="about-mission">
        <Reveal>
          <p className="overline">Our mission</p>
        </Reveal>
        <Reveal delay={0.05}>
          <h1 className="mt-3 text-[36px] sm:text-[52px] lg:text-[60px] font-medium tracking-tightest leading-[1.05] text-white">
            Give every founder the cash-flow clarity a Series&nbsp;B CFO has.
          </h1>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-6 text-[16px] text-muted leading-relaxed max-w-2xl">
            ClearCash was started in 2024 by three engineers who kept watching great companies stumble on cash-flow mistakes their accountant caught six weeks too late. We think finance software should feel like a code editor: fast, opinionated, correct.
          </p>
        </Reveal>
      </section>

      {/* Values */}
      <section className="hairline-t" data-testid="about-values">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-20">
          <Reveal>
            <p className="overline">What we believe</p>
          </Reveal>
          <Stagger className="mt-8 grid md:grid-cols-3 gap-0 hairline rounded-card bg-surface overflow-hidden">
            {values.map((v, i) => (
              <StaggerItem
                key={v.n}
                className={`p-8 ${i > 0 ? 'md:border-l md:border-[rgba(255,255,255,0.06)]' : ''}`}
              >
                <p className="overline num">{v.n}</p>
                <h3 className="mt-4 text-[19px] font-medium text-white tracking-tight">{v.t}</h3>
                <p className="mt-2 text-[13.5px] text-muted leading-relaxed">{v.b}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Team */}
      <section className="hairline-t" data-testid="about-team">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-20">
          <Reveal>
            <p className="overline">Team</p>
            <h2 className="mt-3 text-[28px] sm:text-[36px] font-medium tracking-tighter text-white">
              Three engineers. One thesis.
            </h2>
          </Reveal>
          <Stagger className="mt-10 grid md:grid-cols-3 gap-4">
            {team.map((m) => (
              <StaggerItem key={m.name}>
                <div className="bg-surface hairline rounded-card p-7 h-full">
                  {/* Abstract avatar: initial square */}
                  <div
                    className="w-14 h-14 rounded-card flex items-center justify-center hairline"
                    style={{ backgroundColor: `${m.color}14` }}
                  >
                    <span className="num text-[16px]" style={{ color: m.color }}>
                      {m.init}
                    </span>
                  </div>
                  <p className="mt-6 text-[16px] text-white">{m.name}</p>
                  <p className="mt-0.5 text-[12.5px] text-muted">{m.role}</p>
                  <p className="mt-4 text-[13px] text-muted leading-relaxed">{m.bio}</p>
                  <div className="mt-6 flex items-center gap-3 text-muted">
                    <button type="button" aria-label="LinkedIn" className="hover:text-white transition-colors cursor-pointer bg-transparent border-0 p-0" data-testid={`team-linkedin-${m.init.toLowerCase()}`}>
                      <Linkedin size={14} />
                    </button>
                    <button type="button" aria-label="Twitter" className="hover:text-white transition-colors cursor-pointer bg-transparent border-0 p-0" data-testid={`team-twitter-${m.init.toLowerCase()}`}>
                      <Twitter size={14} />
                    </button>
                    <button type="button" aria-label="GitHub" className="hover:text-white transition-colors cursor-pointer bg-transparent border-0 p-0" data-testid={`team-github-${m.init.toLowerCase()}`}>
                      <Github size={14} />
                    </button>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Tech stack */}
      <section className="hairline-t" data-testid="about-stack">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-20">
          <Reveal>
            <p className="overline">Built with</p>
            <h2 className="mt-3 text-[24px] sm:text-[30px] font-medium tracking-tighter text-white max-w-xl">
              A small, boring, dependable stack.
            </h2>
          </Reveal>
          <Reveal delay={0.08} className="mt-8 flex flex-wrap gap-2">
            {stack.map((s) => (
              <span
                key={s}
                className="text-[12.5px] num px-3.5 py-1.5 rounded-full hairline bg-surface text-white"
              >
                {s}
              </span>
            ))}
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="hairline-t">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-20 text-center">
          <h2 className="text-[28px] sm:text-[36px] font-medium tracking-tighter text-white">
            Want to build with us?
          </h2>
          <p className="mt-4 text-[14.5px] text-muted">
            We&apos;re hiring engineers who like precision.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button to="/contact" size="lg" data-testid="about-cta-contact">
              Get in touch
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
