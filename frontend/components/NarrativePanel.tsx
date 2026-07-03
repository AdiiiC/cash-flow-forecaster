"use client";

import { Narrative } from "@/lib/api";

export function NarrativePanel({ narrative }: { narrative: Narrative }) {
  const isLLM = narrative.source !== "template";
  const providerLabel: Record<string, string> = {
    gemini: "Gemini",
    openai: "OpenAI",
    anthropic: "Claude",
    template: "Template",
  };
  const label = providerLabel[narrative.source] ?? narrative.source;
  return (
    <div className="panel narrative">
      <div className="panel-head">
        <h2>Plain-English summary</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <span className={`badge ${isLLM ? "ok" : ""}`} title="Which AI model wrote this summary.">
            {isLLM && narrative.model ? `${label} · ${narrative.model}` : label}
          </span>
          <span
            className={`badge ${narrative.grounded ? "ok" : "warn"}`}
            title="Every figure in this summary is checked against the forecast before it is shown."
          >
            {narrative.grounded ? "Fact-checked" : "Unverified"}
          </span>
        </div>
      </div>
      <p>{narrative.text}</p>
      <p style={{ marginTop: 10, fontSize: 12, color: "var(--text-faint)" }}>
        Every figure here is checked against the forecast. If the AI ever writes a
        number the model didn&apos;t produce, the summary automatically falls back
        to a safe, template version — so you never see an invented figure.
      </p>
    </div>
  );
}
