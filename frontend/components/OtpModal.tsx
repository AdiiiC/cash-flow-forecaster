"use client";
import { useState, useRef } from "react";

interface Props {
  mfaToken: string;
  method: "totp" | "email_otp";
  onSuccess: (accessToken: string) => void;
  onCancel: () => void;
}

export default function OtpModal({ mfaToken, method, onSuccess, onCancel }: Props) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (code.trim().length < 6) { setError("Enter the 6-digit code."); return; }
    setLoading(true);
    setError("");
    try {
      const API = process.env.NEXT_PUBLIC_API_BASE ?? "";
      const res = await fetch(`${API}/api/auth/mfa/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfa_token: mfaToken, code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? "Invalid code. Try again.");
        setCode("");
        inputRef.current?.focus();
      } else {
        onSuccess(data.access_token);
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="otp-overlay">
      <div className="otp-card" role="dialog" aria-modal="true" aria-labelledby="otp-title">
        <button className="otp-close" onClick={onCancel} aria-label="Cancel">✕</button>

        <div className="otp-icon">{method === "totp" ? "🔐" : "📧"}</div>
        <h2 id="otp-title" className="otp-title">
          {method === "totp" ? "Authenticator code" : "Check your email"}
        </h2>
        <p className="otp-sub">
          {method === "totp"
            ? "Enter the 6-digit code from your authenticator app."
            : "We sent a 6-digit code to your email address. It expires in 10 minutes."}
        </p>

        <form onSubmit={submit} className="otp-form">
          <input
            ref={inputRef}
            className="otp-input"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            placeholder="000000"
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
            autoFocus
            disabled={loading}
          />
          {error && <p className="otp-error">{error}</p>}
          <button className="otp-submit" type="submit" disabled={loading || code.length < 6}>
            {loading ? "Verifying…" : "Verify"}
          </button>
        </form>

        <p className="otp-backup">
          Lost access?{" "}
          <button className="otp-link" onClick={() => {
            const c = prompt("Enter a backup code:");
            if (c) setCode(c.toUpperCase().replace(/[^A-Z0-9-]/g, ""));
          }}>
            Use backup code
          </button>
        </p>
      </div>
    </div>
  );
}
