"use client";
import dynamic from "next/dynamic";

// Skip SSR: axios config touches node-only objects during static generation
const ContactContent = dynamic(
  () => import("./ContactContent"),
  { ssr: false }
);

export default function ContactPage() {
  return <ContactContent />;
}
