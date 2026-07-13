import { redirect } from "next/navigation";

export default function DocsPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";
  redirect(`${apiBase}/docs`);
}
