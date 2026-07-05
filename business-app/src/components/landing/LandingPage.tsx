import type { JSX } from "react";

import type { Feature } from "@/types";
import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";

interface LandingPageProps {
  features: Feature[];
  onLaunch: () => void;
}

export function LandingPage({ features, onLaunch }: LandingPageProps): JSX.Element {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar onLaunch={onLaunch} />
      <main>
        <HeroSection onLaunch={onLaunch} />
        <FeaturesSection features={features} />
      </main>
      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 text-sm text-slate-500 sm:flex-row">
          <span>© {new Date().getFullYear()} ClearCash. Sample product.</span>
          <span>Powered by the Cash-Flow-Forecaster engine.</span>
        </div>
      </footer>
    </div>
  );
}
