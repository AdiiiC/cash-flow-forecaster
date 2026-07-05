import Link from "next/link";
import type { Metadata } from "next";

import { LandingNav } from "@/components/business/LandingNav";
import { HeroSection } from "@/components/business/HeroSection";
import { FeaturesSection } from "@/components/business/FeaturesSection";

export const metadata: Metadata = {
  title: "Cash-Flow Forecaster — know where your cash is heading",
  description:
    "Turn your numbers into clear, executive-ready insights: cash on hand, runway, and the next move that matters — in plain English.",
};

export default function LandingPage() {
  return (
    <div className="lp">
      <LandingNav />
      <main>
        <HeroSection />
        <FeaturesSection />
        <section className="lp-cta">
          <h2>See your cash story in one screen</h2>
          <p>Open the executive dashboard, or dive into the full technical forecaster.</p>
          <div className="lp-cta-actions">
            <Link href="/dashboard" className="lp-btn lp-btn-primary">
              View dashboard
            </Link>
            <Link href="/forecast" className="lp-btn lp-btn-secondary">
              Full forecaster
            </Link>
          </div>
        </section>
      </main>
      <footer className="lp-footer">
        <span>Cash-Flow Forecaster</span>
        <span className="dot-sep">·</span>
        <Link href="/privacy">Data &amp; security</Link>
      </footer>
    </div>
  );
}
