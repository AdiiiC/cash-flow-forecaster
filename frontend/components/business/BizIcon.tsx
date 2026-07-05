import type { SVGProps } from "react";

import type { BizIconName } from "@/lib/businessView";

type Props = SVGProps<SVGSVGElement> & { name: BizIconName | "clarity" | "foresight" | "action" };

const paths: Record<string, JSX.Element> = {
  wallet: (
    <>
      <path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1" />
      <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5a2 2 0 0 1-2-2Z" />
      <circle cx="16.5" cy="13.5" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  runway: (
    <>
      <path d="M3 20h18" />
      <path d="M6 20l3-11 4 1 2-6" />
      <path d="M17 4l2 2-2 2" />
    </>
  ),
  revenue: (
    <>
      <path d="M4 19V5" />
      <path d="M4 15l4-4 4 3 7-8" />
      <path d="M16 6h5v5" />
    </>
  ),
  netflow: (
    <>
      <path d="M7 7h10" />
      <path d="M14 4l3 3-3 3" />
      <path d="M17 17H7" />
      <path d="M10 14l-3 3 3 3" />
    </>
  ),
  clarity: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  foresight: (
    <>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  action: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />,
};

export function BizIcon({ name, ...props }: Props) {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
