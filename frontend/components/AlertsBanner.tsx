"use client";

import { Alert } from "@/lib/api";

const ICON: Record<string, string> = {
  critical: "▲",
  warning: "◆",
  info: "●",
};

export function AlertsBanner({ alerts }: { alerts: Alert[] }) {
  if (!alerts.length) return null;
  // Show the most severe first; hide the "ok" info line if any real alert exists.
  const hasReal = alerts.some((a) => a.level !== "info");
  const shown = hasReal ? alerts.filter((a) => a.level !== "info") : alerts;

  return (
    <div className="alerts" role="status" aria-label="Alerts">
      {shown.map((a, i) => (
        <div key={`${a.code}-${i}`} className={`alert ${a.level}`}>
          <span className="alert-icon" aria-hidden>
            {ICON[a.level] ?? "●"}
          </span>
          <span className="alert-msg">{a.message}</span>
        </div>
      ))}
    </div>
  );
}
