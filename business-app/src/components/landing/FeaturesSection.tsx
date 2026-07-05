import type { JSX } from "react";

import type { Feature } from "@/types";
import { FeatureCard } from "@/components/landing/FeatureCard";

interface FeaturesSectionProps {
  features: Feature[];
}

export function FeaturesSection({ features }: FeaturesSectionProps): JSX.Element {
  return (
    <section id="features" className="bg-white py-20 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
            Everything you need, nothing you don't
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            We do the heavy forecasting behind the scenes and hand you clear
            answers you can act on today.
          </p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {features.map((feature) => (
            <FeatureCard key={feature.id} feature={feature} />
          ))}
        </div>
      </div>
    </section>
  );
}
