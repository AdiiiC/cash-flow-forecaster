import { BizIcon } from "@/components/business/BizIcon";
import type { BizKpi } from "@/lib/businessView";

function favorable(kpi: BizKpi): boolean {
  if (kpi.changePct === null) return true;
  if (kpi.changePct === 0) return true;
  const positive = kpi.changePct > 0;
  return kpi.polarity === "higher-is-better" ? positive : !positive;
}

function KpiCard({ kpi }: { kpi: BizKpi }) {
  const good = favorable(kpi);
  const arrow = kpi.trend === "up" ? "▲" : kpi.trend === "down" ? "▼" : "—";

  return (
    <div className="bz-kpi">
      <div className="bz-kpi-top">
        <span className="bz-kpi-icon">
          <BizIcon name={kpi.icon} width={20} height={20} />
        </span>
        {kpi.changePct !== null && (
          <span className={`bz-kpi-change num ${good ? "pos" : "neg"}`}>
            {arrow} {kpi.changePct >= 0 ? "+" : ""}
            {kpi.changePct.toFixed(1)}%
          </span>
        )}
      </div>
      <div className="bz-kpi-label">{kpi.label}</div>
      <div className="bz-kpi-value num">{kpi.value}</div>
      <div className="bz-kpi-comp">{kpi.comparisonLabel}</div>
      <div className="bz-kpi-hint">{kpi.hint}</div>
    </div>
  );
}

export function BizKpiGrid({ kpis }: { kpis: BizKpi[] }) {
  return (
    <section className="bz-kpis" aria-label="Key figures">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.id} kpi={kpi} />
      ))}
    </section>
  );
}
