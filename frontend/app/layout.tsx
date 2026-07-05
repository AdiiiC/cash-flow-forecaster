import type { Metadata, Viewport } from "next";
import "./globals.css";
import { DevUnlock } from "@/components/DevUnlock";

export const metadata: Metadata = {
  title: "Cash-Flow Forecaster — see where your cash is heading",
  description:
    "A 13-week cash-flow forecast in plain English: an honest best estimate, a realistic range, and a fact-checked summary. Built by a Senior AI Engineer.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <DevUnlock />
        {children}
      </body>
    </html>
  );
}
