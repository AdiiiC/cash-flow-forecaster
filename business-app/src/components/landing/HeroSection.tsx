import type { JSX } from "react";

import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface HeroSectionProps {
  onLaunch: () => void;
}

export function HeroSection({ onLaunch }: HeroSectionProps): JSX.Element {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-brand-100 blur-3xl" />
      </div>
      <div className="mx-auto max-w-6xl px-6 py-20 text-center md:py-28">
        <div className="mb-5 flex justify-center">
          <Badge tone="brand">Built for busy business owners</Badge>
        </div>
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-slate-900 md:text-6xl">
          Know exactly where your{" "}
          <span className="text-brand-600">cash is heading</span>.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 md:text-xl">
          ClearCash turns your numbers into a simple, forward-looking picture:
          how much cash you have, how long it lasts, and the one move that
          strengthens your business this month — no finance degree required.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button size="lg" onClick={onLaunch}>
            View Dashboard
          </Button>
          <Button size="lg" variant="secondary" onClick={onLaunch}>
            See a live example
          </Button>
        </div>
        <p className="mt-4 text-sm text-slate-500">
          No credit card. Sample data loaded and ready to explore.
        </p>
      </div>
    </section>
  );
}
