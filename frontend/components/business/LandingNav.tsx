"use client";

import Link from "next/link";

import { BizIcon } from "@/components/business/BizIcon";
import { AuthMenu } from "@/components/AuthMenu";

export function LandingNav() {
  return (
    <header className="lp-nav">
      <Link href="/" className="lp-brand">
        <span className="lp-brand-mark">
          <BizIcon name="wallet" width={18} height={18} />
        </span>
        <span className="lp-brand-name">Cash-Flow Forecaster</span>
      </Link>
      <nav className="lp-nav-links">
        <a href="#features">Features</a>
        <Link href="/forecast">Full forecaster</Link>
        <Link href="/dashboard" className="lp-nav-cta">
          View dashboard
        </Link>
        <AuthMenu onAuthChange={() => undefined} />
      </nav>
    </header>
  );
}
