import { useCallback, useState } from "react";
import type { JSX } from "react";

import type { View } from "@/types";
import { LandingPage } from "@/components/landing/LandingPage";
import { DashboardPage } from "@/components/dashboard/DashboardPage";
import { dashboardData, features } from "@/data/mockData";

export default function App(): JSX.Element {
  const [view, setView] = useState<View>("landing");

  const goToDashboard = useCallback(() => {
    setView("dashboard");
    window.scrollTo({ top: 0 });
  }, []);

  const goToLanding = useCallback(() => {
    setView("landing");
    window.scrollTo({ top: 0 });
  }, []);

  if (view === "dashboard") {
    return <DashboardPage data={dashboardData} onBack={goToLanding} />;
  }

  return <LandingPage features={features} onLaunch={goToDashboard} />;
}
