"use client";
import dynamic from "next/dynamic";

// Skip SSR: recharts touches browser-only APIs during static generation
const RoiCalculatorContent = dynamic(
  () => import("./RoiCalculatorContent"),
  { ssr: false }
);

export default function RoiCalculatorPage() {
  return <RoiCalculatorContent />;
}
