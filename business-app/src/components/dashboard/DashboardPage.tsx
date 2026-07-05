import type { JSX } from "react";

import type { DashboardData } from "@/types";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { KpiGrid } from "@/components/dashboard/KpiGrid";
import { BalanceChart } from "@/components/dashboard/BalanceChart";
import { CashFlowBars } from "@/components/dashboard/CashFlowBars";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { KeyTakeaways } from "@/components/dashboard/KeyTakeaways";

interface DashboardPageProps {
  data: DashboardData;
  onBack: () => void;
}

export function DashboardPage({ data, onBack }: DashboardPageProps): JSX.Element {
  return (
    <DashboardLayout
      companyName={data.companyName}
      periodLabel={data.periodLabel}
      generatedAt={data.generatedAt}
      onBack={onBack}
    >
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          Your cash-flow snapshot
        </h1>
        <p className="mt-1 text-slate-600">
          A clear read on where your money stands and where it's heading.
        </p>
      </div>

      <KpiGrid kpis={data.kpis} />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <BalanceChart
            data={data.balanceTrend}
            currency={data.currency}
            confidenceLabel={data.confidenceLabel}
          />
        </div>
        <div>
          <KeyTakeaways takeaways={data.takeaways} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <CashFlowBars data={data.cashFlow} currency={data.currency} />
        <RevenueChart data={data.revenueTrend} currency={data.currency} />
      </div>
    </DashboardLayout>
  );
}
