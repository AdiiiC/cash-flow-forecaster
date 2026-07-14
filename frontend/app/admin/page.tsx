"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";

export default function AdminPage() {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const token = document.cookie.split(";").find(c => c.trim().startsWith("cf_dev_access="))?.split("=")[1];
      const base = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
      // Admin uses the regular JWT stored in localStorage
      const jwt = typeof localStorage !== "undefined" ? localStorage.getItem("cf_token") : "";
      const res = await fetch(`${base}/api/admin/contact-submissions`, {
        headers: { Authorization: `Bearer ${jwt || ""}` },
      });
      if (res.status === 403) { setError("Admin access required. Log in as an admin user."); return; }
      if (!res.ok) { setError(`Error ${res.status}`); return; }
      setRows(await res.json());
    } catch (e) {
      setError("Could not reach backend.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface-0, #090b0f)", color: "#fff", padding: "40px 32px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
            <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#a1a1aa", marginBottom: 12 }}>
              <ArrowLeft size={12} /> Home
            </Link>
            <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>Contact submissions</h1>
          </div>
          <button
            onClick={load}
            disabled={loading}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "7px 14px", color: "#fff", fontSize: 13, cursor: "pointer" }}
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {error && <p style={{ color: "#e0644f", marginBottom: 24 }}>{error}</p>}

        {loading && <p style={{ color: "#a1a1aa" }}>Loading…</p>}

        {!loading && !error && rows.length === 0 && (
          <p style={{ color: "#a1a1aa" }}>No submissions yet.</p>
        )}

        {!loading && rows.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  {["Date", "Name", "Email", "Company", "Team size", "Message", "Context"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 12px", color: "#a1a1aa", fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <td style={{ padding: "10px 12px", color: "#a1a1aa", whiteSpace: "nowrap" }}>{r.created_at?.slice(0, 10)}</td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{r.name}</td>
                    <td style={{ padding: "10px 12px" }}><a href={`mailto:${r.email}`} style={{ color: "#e0a34a" }}>{r.email}</a></td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{r.company}</td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{r.team_size}</td>
                    <td style={{ padding: "10px 12px", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#a1a1aa" }}>{r.message}</td>
                    <td style={{ padding: "10px 12px", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#a1a1aa", fontSize: 11 }}>{r.context}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ color: "#a1a1aa", fontSize: 12, marginTop: 16 }}>{rows.length} submission{rows.length !== 1 ? "s" : ""}</p>
          </div>
        )}
      </div>
    </div>
  );
}
