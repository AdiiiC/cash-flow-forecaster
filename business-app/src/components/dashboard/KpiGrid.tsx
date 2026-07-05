import type { JSX } from "react";

import type { Kpi } from "@/types";
import { KpiCard } from "@/components/dashboard/KpiCard";

interface KpiGridProps {
  kpis: Kpi[];
}

export function KpiGrid({ kpis }: KpiGridProps): JSX.Element {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.id} kpi={kpi} />
      ))}
    </div>
  );
}
