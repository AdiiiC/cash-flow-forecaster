"use client";

import { FormEvent, useEffect, useState } from "react";

import { ApiError, fetchMe, login, logout, register, UserPublic } from "@/lib/api";

interface Props {
  /** Called after a successful login/register/logout so the page can refresh user-scoped data. */
  onAuthChange: () => void;
}

type Mode = "login" | "register";

export function AuthMenu({ onAuthChange }: Props) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Restore the session on mount (token may be in localStorage from a prior visit).
  useEffect(() => {
    fetchMe()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  const closeModal = () => {
    setOpen(false);
    setError("");
    setPassword("");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const fn = mode === "login" ? login : register;
      const { user: u } = await fn(email.trim(), password);
      setUser(u);
      closeModal();
      setEmail("");
      onAuthChange();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    onAuthChange();
  };

  if (user) {
    return (
      <div className="auth-menu">
        <span className="auth-email" title={user.email}>
          {user.email}
        </span>
        <button className="mini-btn" onClick={handleLogout}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="auth-menu">
      <button
        className="mini-btn wide"
        onClick={() => {
          setMode("login");
          setOpen(true);
        }}
      >
        Sign in
      </button>

      {open && (
        <div className="auth-overlay" role="dialog" aria-modal="true" onClick={closeModal}>
          <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
            <div className="auth-tabs">
              <button
                className={`auth-tab ${mode === "login" ? "active" : ""}`}
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
              >
                Sign in
              </button>
              <button
                className={`auth-tab ${mode === "register" ? "active" : ""}`}
                onClick={() => {
                  setMode("register");
                  setError("");
                }}
              >
                Create account
              </button>
            </div>

            <form className="auth-form" onSubmit={submit}>
              <label>
                Email
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              {mode === "register" && (
                <div className="auth-hint">At least 8 characters. Your history stays private to this account.</div>
              )}
              {error && <div className="auth-error">{error}</div>}
              <button className="auth-submit" type="submit" disabled={busy}>
                {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
              </button>
            </form>

            <button className="auth-close" onClick={closeModal} aria-label="Close">
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
