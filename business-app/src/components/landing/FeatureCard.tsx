import type { JSX } from "react";

import type { Feature } from "@/types";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";

interface FeatureCardProps {
  feature: Feature;
}

export function FeatureCard({ feature }: FeatureCardProps): JSX.Element {
  return (
    <Card className="p-7 transition-shadow hover:shadow-lg">
      <span className="mb-5 grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-600">
        <Icon name={feature.icon} width={24} height={24} />
      </span>
      <h3 className="text-lg font-bold text-slate-900">{feature.title}</h3>
      <p className="mt-2 text-slate-600">{feature.description}</p>
    </Card>
  );
}
