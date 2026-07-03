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
        <h2>CFO briefing</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <span className={`badge ${isLLM ? "ok" : ""}`}>
            {isLLM && narrative.model ? `${label} · ${narrative.model}` : label}
          </span>
          <span className={`badge ${narrative.grounded ? "ok" : "warn"}`}>
            {narrative.grounded ? "Grounded" : "Unverified"}
          </span>
        </div>
      </div>
      <p>{narrative.text}</p>
      <p style={{ marginTop: 10, fontSize: 12, color: "var(--text-faint)" }}>
        Every figure above is verified against the model output. If the language
        model emits a number absent from the forecast, the briefing falls back to
        the deterministic template — no unverifiable figure reaches this panel.
      </p>
    </div>
  );
}
