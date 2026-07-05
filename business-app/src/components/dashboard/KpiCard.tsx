import type { JSX } from "react";

import type { Kpi } from "@/types";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { formatSignedPercent } from "@/lib/format";

interface KpiCardProps {
  kpi: Kpi;
}

/** Decide whether a change is "good" given the metric's polarity. */
function isFavorable(kpi: Kpi): boolean {
  if (kpi.changePct === 0) return true;
  const positive = kpi.changePct > 0;
  return kpi.polarity === "higher-is-better" ? positive : !positive;
}

export function KpiCard({ kpi }: KpiCardProps): JSX.Element {
  const favorable = isFavorable(kpi);
  const changeColor = favorable ? "text-emerald-600" : "text-rose-600";
  const arrow = kpi.trend === "up" ? "▲" : kpi.trend === "down" ? "▼" : "—";

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <Icon name={kpi.icon} width={20} height={20} />
        </span>
        <span className={`text-sm font-semibold num ${changeColor}`}>
          {arrow} {formatSignedPercent(kpi.changePct)}
        </span>
      </div>
      <p className="mt-4 text-sm font-medium text-slate-500">{kpi.label}</p>
      <p className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900 num">
        {kpi.value}
      </p>
      <p className="mt-2 text-xs text-slate-400">{kpi.comparisonLabel}</p>
      <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-500">
        {kpi.hint}
      </p>
    </Card>
  );
}
