"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type JSX, SVGProps } from "react";

function Icon({ id, ...props }: { id: string } & SVGProps<SVGSVGElement>) {
  const base: SVGProps<SVGSVGElement> = {
    viewBox: "0 0 16 16",
    width: 15,
    height: 15,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
  const paths: Record<string, JSX.Element> = {
    dashboard:   <><rect x="2" y="2" width="5" height="5"/><rect x="9" y="2" width="5" height="5"/><rect x="2" y="9" width="5" height="5"/><rect x="9" y="9" width="5" height="5"/></>,
    forecast:    <polyline points="2,13 5,8 8,10 12,5 14,7"/>,
    "board-report":    <><line x1="3" y1="4" x2="13" y2="4"/><line x1="3" y1="8" x2="10" y2="8"/><line x1="3" y1="12" x2="12" y2="12"/></>,
    "financial-health":<polyline points="1,8 4,8 6,4 8,12 10,6 12,9 15,9"/>,
    "burn-rate": <><rect x="3" y="10" width="2" height="4"/><rect x="7" y="7" width="2" height="7"/><rect x="11" y="4" width="2" height="10"/></>,
    "working-capital":  <><path d="M13 8A5 5 0 1 1 8 3"/><polyline points="13,3 13,8 8,8"/></>,
    actuals:     <><rect x="3" y="3" width="10" height="10" rx="1"/><polyline points="6,8 7.5,9.5 10,7"/></>,
    customers:   <><circle cx="8" cy="6" r="2.5"/><path d="M3,14 c0-2.8 2.2-5 5-5s5,2.2 5,5"/></>,
    exim:        <><circle cx="8" cy="8" r="5.5"/><line x1="8" y1="2.5" x2="8" y2="13.5"/><path d="M2.5,8 q2.5,3 5.5,3t5.5-3"/><path d="M2.5,8 q2.5-3 5.5-3t5.5,3"/></>,
    budget:      <><line x1="4" y1="5" x2="13" y2="5"/><line x1="8" y1="5" x2="8" y2="13"/><line x1="4" y1="9" x2="12" y2="9"/><line x1="4" y1="13" x2="12" y2="13"/></>,
    team:        <><circle cx="5.5" cy="6" r="2"/><circle cx="10.5" cy="6" r="2"/><path d="M1,14 c0-2.2 2-3.5 4.5-3.5"/><path d="M15,14 c0-2.2-2-3.5-4.5-3.5"/><path d="M6,10.5 c.5-.3 1.2-.5 2-.5s1.5.2 2,.5"/></>,
    security:    <><rect x="4" y="7" width="8" height="7" rx="1"/><path d="M5,7 V5.5 a3,3 0 0,1 6,0 V7"/></>,
  };
  return <svg {...base} aria-hidden="true">{paths[id] ?? <circle cx="8" cy="8" r="3"/>}</svg>;
}

const NAV_SECTIONS = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard",  icon: "dashboard",  label: "Executive Dashboard" },
      { href: "/forecast",   icon: "forecast",   label: "Forecast App" },
    ],
  },
  {
    label: "Business Intelligence",
    items: [
      { href: "/dashboard/board-report",     icon: "board-report",     label: "Board Report" },
      { href: "/dashboard/financial-health", icon: "financial-health", label: "Financial Health" },
      { href: "/dashboard/burn-rate",        icon: "burn-rate",        label: "Burn Rate & Headcount" },
      { href: "/dashboard/working-capital",  icon: "working-capital",  label: "Working Capital" },
    ],
  },
  {
    label: "Data",
    items: [
      { href: "/actuals",        icon: "actuals",   label: "Actuals & Variance" },
      { href: "/actuals/config", icon: "exim",      label: "ExIm & Config" },
      { href: "/customers",      icon: "customers", label: "Customer MRR" },
      { href: "/budget",         icon: "budget",    label: "Budget" },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/settings/team",          icon: "team",     label: "Team & Organisation" },
      { href: "/settings/notifications", icon: "security", label: "Security & Notifications" },
    ],
  },
];

export default function BizNav() {
  const pathname = usePathname();

  return (
    <nav className="biz-sidenav" aria-label="Main navigation">
      <div className="biz-sidenav-brand">
        <Link href="/" className="biz-sidenav-logo">ClearCash</Link>
      </div>
      {NAV_SECTIONS.map(section => (
        <div key={section.label} className="biz-sidenav-section">
          <div className="biz-sidenav-section-label">{section.label}</div>
          {section.items.map(item => {
            const active = pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`biz-sidenav-item${active ? " biz-sidenav-item--active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <span className="biz-sidenav-icon">
                  <Icon id={item.icon} />
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

