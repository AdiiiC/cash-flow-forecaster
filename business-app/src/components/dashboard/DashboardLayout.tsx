import type { JSX, ReactNode } from "react";

import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";

interface DashboardLayoutProps {
  companyName: string;
  periodLabel: string;
  generatedAt: string;
  onBack: () => void;
  children: ReactNode;
}

export function DashboardLayout({
  companyName,
  periodLabel,
  generatedAt,
  onBack,
  children,
}: DashboardLayoutProps): JSX.Element {
  const generated = new Date(generatedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white">
              <Icon name="wallet" width={18} height={18} />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">{companyName}</p>
              <p className="text-xs text-slate-500">
                Forecast • {periodLabel} • Updated {generated}
              </p>
            </div>
          </div>
          <Button variant="ghost" onClick={onBack}>
            ← Back to home
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
