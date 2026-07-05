import type { JSX, ReactNode } from "react";

import { Card } from "@/components/ui/Card";

interface ChartCardProps {
  title: string;
  subtitle: string;
  action?: ReactNode;
  children: ReactNode;
}

/** Shared frame for every dashboard chart: title, plain-English subtitle, body. */
export function ChartCard({
  title,
  subtitle,
  action,
  children,
}: ChartCardProps): JSX.Element {
  return (
    <Card className="p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
        </div>
        {action}
      </div>
      <div className="h-72 w-full">{children}</div>
    </Card>
  );
}
