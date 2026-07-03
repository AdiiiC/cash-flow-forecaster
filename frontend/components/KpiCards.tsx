"use client";

import { ForecastResponse, FxRates } from "@/lib/api";
import { convertAmount, formatCurrency } from "@/lib/format";

interface Props {
  data: ForecastResponse;
  fxTo?: string | null;
  rates?: FxRates | null;
}

export function KpiCards({ data, fxTo, rates }: Props) {
  const { currency } = data;
  const balanceTrend = data.projected_balance_p50 - data.opening_balance;
  const solvent = data.runway_weeks === null;

  const fx =
    fxTo && rates && fxTo !== currency
      ? (v: number) =>
          `≈ ${formatCurrency(convertAmount(v, currency, fxTo, rates.rates), fxTo)}`
      : null;

  return (
    <section className="kpis" aria-label="Key figures">
      <div className="kpi accent">
        <div className="k-label">Cash on hand today</div>
        <div className="k-value num">{formatCurrency(data.opening_balance, currency)}</div>
        <div className="k-note">as of {data.as_of}</div>
        {fx && <div className="k-fx num">{fx(data.opening_balance)}</div>}
      </div>

      <div className={`kpi ${balanceTrend >= 0 ? "good" : "bad"}`}>
        <div className="k-label" title="P50 = the middle outcome: equally likely to be higher or lower.">
          Cash in {data.horizon_weeks} weeks <span className="k-tag">most likely</span>
        </div>
        <div className={`k-value num ${balanceTrend >= 0 ? "pos" : "neg"}`}>
          {formatCurrency(data.projected_balance_p50, currency)}
        </div>
        <div className="k-note num">
          {balanceTrend >= 0 ? "+" : ""}
          {formatCurrency(balanceTrend, currency)} vs today
        </div>
        {fx && <div className="k-fx num">{fx(data.projected_balance_p50)}</div>}
      </div>

      <div className={`kpi ${solvent ? "good" : "bad"}`}>
        <div className="k-label" title="How long until cash is forecast to run out.">Cash runway</div>
        <div className={`k-value num ${solvent ? "pos" : "neg"}`}>
          {solvent ? "13+ weeks" : `${data.runway_weeks} weeks`}
        </div>
        <div className="k-note">
          {solvent
            ? "Stays cash-positive across the forecast"
            : "When cash is projected to hit zero"}
        </div>
      </div>

      <div className="kpi">
        <div className="k-label" title="Money in minus money out over the forecast (middle estimate).">
          Net cash over {data.horizon_weeks} weeks
        </div>
        <NetTotal data={data} fx={fx} />
      </div>
    </section>
  );
}

function NetTotal({ data, fx }: { data: ForecastResponse; fx: ((v: number) => string) | null }) {
  const net = data.series.find((s) => s.name === "net_cash_flow");
  const total = net ? net.forecast.reduce((a, p) => a + p.p50, 0) : 0;
  return (
    <>
      <div className={`k-value num ${total >= 0 ? "pos" : "neg"}`}>
        {formatCurrency(total, data.currency)}
      </div>
      <div className="k-note">Total money in minus money out</div>
      {fx && <div className="k-fx num">{fx(total)}</div>}
    </>
  );
}
