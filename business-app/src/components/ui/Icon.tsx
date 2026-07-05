import type { JSX, SVGProps } from "react";

import type { IconName } from "@/types";

type IconProps = SVGProps<SVGSVGElement>;

const base = (props: IconProps): IconProps => ({
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...props,
});

const icons: Record<IconName, (props: IconProps) => JSX.Element> = {
  wallet: (p) => (
    <svg {...base(p)}>
      <path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1" />
      <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5a2 2 0 0 1-2-2Z" />
      <circle cx="16.5" cy="13.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  ),
  runway: (p) => (
    <svg {...base(p)}>
      <path d="M3 20h18" />
      <path d="M6 20l3-11 4 1 2-6" />
      <path d="M17 4l2 2-2 2" />
    </svg>
  ),
  revenue: (p) => (
    <svg {...base(p)}>
      <path d="M4 19V5" />
      <path d="M4 15l4-4 4 3 7-8" />
      <path d="M16 6h5v5" />
    </svg>
  ),
  netflow: (p) => (
    <svg {...base(p)}>
      <path d="M7 7h10" />
      <path d="M14 4l3 3-3 3" />
      <path d="M17 17H7" />
      <path d="M10 14l-3 3 3 3" />
    </svg>
  ),
  confidence: (p) => (
    <svg {...base(p)}>
      <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  clarity: (p) => (
    <svg {...base(p)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  ),
  foresight: (p) => (
    <svg {...base(p)}>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  ),
  action: (p) => (
    <svg {...base(p)}>
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    </svg>
  ),
};

export function Icon({ name, ...props }: { name: IconName } & IconProps): JSX.Element {
  const Cmp = icons[name];
  return <Cmp {...props} />;
}
