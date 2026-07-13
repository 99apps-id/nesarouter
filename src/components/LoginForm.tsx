"use client";

import { LogIn } from "lucide-react";
import { useState } from "react";
import type { OAuthProviderInfo } from "@/core/oauth";

type LoginLock = {
  locked?: boolean;
  lockedUntil?: string;
  remainingMs?: number;
  failedAttempts?: number;
};

function minutesLeft(ms = 0) {
  return Math.max(1, Math.ceil(ms / 60_000));
}

export default function LoginForm({
  defaultPassword,
  passwordHint,
  initialLock,
  oauthProviders,
  oauthError
}: {
  /** Only set while still on the temporary local bootstrap password. */
  defaultPassword?: string;
  /** default = show nesa123456; env = point at .env without revealing the value */
  passwordHint?: "default" | "env";
  initialLock?: LoginLock;
  oauthProviders: OAuthProviderInfo[];
  oauthError?: string;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    initialLock?.locked ? `Login locked. Try again in ${minutesLeft(initialLock.remainingMs)} minutes.` : (oauthError ?? "")
  );
  const [locked, setLocked] = useState(Boolean(initialLock?.locked));
  const [loading, setLoading] = useState(false);

  async function login() {
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ password })
    });

    const result = await response.json().catch(() => ({}));
    if (response.ok) {
      window.location.href = result.mustChangePassword ? "/routing" : "/";
      return;
    }

    if (response.status === 423) {
      setLocked(true);
      setError(`Login locked. Try again in ${minutesLeft(result.remainingMs)} minutes.`);
    } else {
      const remainingAttempts = Math.max(0, 3 - Number(result.failedAttempts ?? 0));
      setError(remainingAttempts ? `${result.error ?? "Login failed."} ${remainingAttempts} tries left.` : (result.error ?? "Login failed."));
    }
    setLoading(false);
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="brand-mark">
          <div className="brand-icon">
            <span className="brand-letter">N</span>
          </div>
          <div>
            <strong>NesaRouter</strong>
            <span>Admin access</span>
          </div>
        </div>
        {passwordHint === "default" && defaultPassword ? (
          <div className="default-password-box">
            <span>Temporary default password</span>
            <code>{defaultPassword}</code>
            <small>Shown only until you change it under Routing → Password.</small>
          </div>
        ) : null}
        {passwordHint === "env" ? (
          <div className="default-password-box">
            <span>Bootstrap password from server .env</span>
            <small>
              Use the value of <code>NESA_ADMIN_PASSWORD</code> set during install (production cannot use{" "}
              <code>nesa123456</code>). Ask your installer if you do not have it, then change it under Routing →
              Password after login.
            </small>
          </div>
        ) : null}
        <label>
          Password
          <input
            autoFocus
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") login();
            }}
            placeholder="Admin password"
            disabled={locked}
          />
        </label>
        <button className="button primary" type="button" onClick={login} disabled={loading || locked}>
          <LogIn size={16} />
          {loading ? "Checking" : "Login"}
        </button>
        {oauthProviders.some((provider) => provider.enabled) ? (
          <div className="oauth-stack">
            <span>OAuth</span>
            {oauthProviders
              .filter((provider) => provider.enabled)
              .map((provider) => (
                <a className="button" href={`/api/auth/oauth/${provider.id}/start`} key={provider.id}>
                  Login with {provider.label}
                </a>
              ))}
          </div>
        ) : null}
        {error ? <p className="test-message error">{error}</p> : null}
      </section>
    </main>
  );
}
