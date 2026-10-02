"use client";
import { useState } from "react";

const field = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 8,
  border: "1px solid #422d4a",
  background: "#130a18",
  color: "#f5f0f6",
  fontSize: 14,
} as const;

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not sign in.");
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 14, textAlign: "left" }}>
      <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#beb0c5" }}>
        Email
        <input
          type="email"
          autoComplete="username"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={field}
        />
      </label>
      <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#beb0c5" }}>
        Password
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={field}
        />
      </label>
      {error && (
        <p role="alert" style={{ margin: 0, fontSize: 13, color: "#ff8fa8" }}>
          {error}
        </p>
      )}
      <button
        disabled={busy}
        style={{
          padding: "12px 16px",
          borderRadius: 8,
          border: 0,
          background: "#dd1c49",
          color: "#fff",
          fontWeight: 600,
          cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
