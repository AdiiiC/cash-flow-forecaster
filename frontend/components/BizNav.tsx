"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_SECTIONS = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard",     icon: "🏠", label: "Executive Dashboard" },
      { href: "/forecast",      icon: "📈", label: "Forecast App" },
    ],
  },
  {
    label: "Business Intelligence",
    items: [
      { href: "/dashboard/board-report",       icon: "📋", label: "Board Report" },
      { href: "/dashboard/financial-health",   icon: "🏥", label: "Financial Health" },
      { href: "/dashboard/burn-rate",          icon: "🔥", label: "Burn Rate & Headcount" },
      { href: "/dashboard/working-capital",    icon: "💰", label: "Working Capital" },
    ],
  },
  {
    label: "Data",
    items: [
      { href: "/actuals",   icon: "📊", label: "Actuals & Variance" },
      { href: "/customers", icon: "👤", label: "Customer MRR" },
      { href: "/budget",    icon: "🎯", label: "Budget" },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/settings/team",          icon: "👥", label: "Team & Organisation" },
      { href: "/settings/notifications", icon: "🔔", label: "Security & Notifications" },
    ],
  },
];

export default function BizNav() {
  const pathname = usePathname();

  return (
    <nav className="biz-sidenav">
      <div className="biz-sidenav-brand">
        <Link href="/" className="biz-sidenav-logo">ClearCash</Link>
      </div>
      {NAV_SECTIONS.map(section => (
        <div key={section.label} className="biz-sidenav-section">
          <div className="biz-sidenav-section-label">{section.label}</div>
          {section.items.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`biz-sidenav-item${pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href)) ? " biz-sidenav-item--active" : ""}`}
            >
              <span className="biz-sidenav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
