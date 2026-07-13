"use client";
import { useState } from "react";

interface Props {
  onClose: () => void;
  authHeaders: () => Record<string, string>;
}

export default function TotpSetup({ onClose, authHeaders }: Props) {
  const [step, setStep] = useState<"setup" | "verify" | "done">("setup");
  const [qrBase64, setQrBase64] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_BASE ?? "";

  async function startSetup() {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API}/api/auth/mfa/totp/setup`, {
        method: "POST", headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail ?? "Setup failed."); return; }
      setQrBase64(data.qr_code_base64);
      setSecret(data.secret);
      setStep("verify");
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }

  async function enableTotp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API}/api/auth/mfa/totp/enable`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail ?? "Invalid code."); return; }
      setBackupCodes(data.backup_codes);
      setStep("done");
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }

  return (
    <div className="totp-overlay">
      <div className="totp-card" role="dialog" aria-modal="true">
        <button className="otp-close" onClick={onClose} aria-label="Close">✕</button>

        {step === "setup" && (
          <>
            <h3 className="totp-title">Set up two-factor authentication</h3>
            <p className="totp-sub">
              Two-factor authentication adds a second layer of security. You will need
              an authenticator app (Google Authenticator, Authy, 1Password, etc.).
            </p>
            {error && <p className="otp-error">{error}</p>}
            <button className="otp-submit" onClick={startSetup} disabled={loading}>
              {loading ? "Generating…" : "Get started"}
            </button>
          </>
        )}

        {step === "verify" && (
          <>
            <h3 className="totp-title">Scan this QR code</h3>
            <p className="totp-sub">
              Open your authenticator app and scan the QR code below, or enter the
              setup key manually.
            </p>
            {qrBase64 && (
              <img
                src={`data:image/png;base64,${qrBase64}`}
                alt="TOTP QR code"
                className="totp-qr"
              />
            )}
            <details className="totp-manual">
              <summary>Can't scan? Enter setup key manually</summary>
              <code className="totp-secret">{secret}</code>
            </details>
            <form onSubmit={enableTotp} className="otp-form" style={{ marginTop: "20px" }}>
              <label className="totp-label">
                Enter the 6-digit code from your app to confirm
              </label>
              <input
                className="otp-input"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
                autoFocus
                disabled={loading}
              />
              {error && <p className="otp-error">{error}</p>}
              <button className="otp-submit" type="submit" disabled={loading || code.length < 6}>
                {loading ? "Enabling…" : "Enable 2FA"}
              </button>
            </form>
          </>
        )}

        {step === "done" && (
          <>
            <div className="totp-success-icon">✅</div>
            <h3 className="totp-title">Two-factor authentication enabled</h3>
            <p className="totp-sub">
              Save these backup codes somewhere safe. Each can be used once if
              you lose access to your authenticator app.
            </p>
            <div className="totp-backup-grid">
              {backupCodes.map(c => (
                <code key={c} className="totp-backup-code">{c}</code>
              ))}
            </div>
            <button className="otp-submit" onClick={onClose}>Done</button>
          </>
        )}
      </div>
    </div>
  );
}
