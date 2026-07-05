"use client";

import { useEffect } from "react";

/*
 * Hidden dev unlock: press Ctrl+Alt+D on any page to reveal a prompt for the
 * dev access key. The key is sent to the server-side /unlock endpoint, which
 * validates it and sets the httpOnly dev cookie. The secret is never stored in
 * this bundle — the developer types it in.
 */
export function DevUnlock() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Use e.code (physical key) rather than e.key: on macOS, holding Option
      // rewrites e.key (Option+D -> "∂"), which would break the shortcut.
      if (e.ctrlKey && e.altKey && e.code === "KeyD") {
        e.preventDefault();
        const key = window.prompt("Dev access key");
        if (key) {
          window.location.href = `/unlock?key=${encodeURIComponent(key)}`;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return null;
}
