import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cash-Flow-Forecaster",
  description:
    "Probabilistic 13-week cash-flow and MRR forecasting with calibrated intervals and grounded narratives.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
