"use client";

import { ForecastResponse } from "@/lib/api";

function toCsv(data: ForecastResponse): string {
  const lines = ["series,period,p10,p50,p90,unit"];
  for (const s of data.series) {
    for (const p of s.forecast) {
      lines.push(`${s.name},${p.period},${p.p10},${p.p50},${p.p90},${s.unit}`);
    }
  }
  return lines.join("\n") + "\n";
}

export function ExportBar({ data }: { data: ForecastResponse }) {
  const downloadCsv = () => {
    const blob = new Blob([toCsv(data)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `forecast_${data.currency}_${data.horizon_weeks}w.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="export-bar">
      <button className="ghost" onClick={downloadCsv}>
        ↓ CSV
      </button>
      <button className="ghost" onClick={() => window.print()}>
        ↧ PDF / Print
      </button>
    </div>
  );
}
