"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function AccessPage() {
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res  = await fetch("/api/access/verify", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok) {
        router.replace("/login");
      } else {
        setError(data.error || "Incorrect access password.");
        setPassword("");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: "#F4F6F9" }}
    >
      <div
        className="w-full max-w-sm bg-white rounded-2xl px-8 py-10"
        style={{
          boxShadow: "0 2px 8px 0 rgb(0 0 0/0.06), 0 8px 32px 0 rgb(26 43 74/0.08)",
          border: "1px solid #E2E8F0",
        }}
      >
        {/* Logo badge */}
        <div className="flex justify-center mb-7">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-base font-bold"
            style={{ backgroundColor: "#1A2B4A" }}
          >
            C
          </div>
        </div>

        <h1
          className="text-xl font-bold text-center mb-2"
          style={{ color: "#1A2B4A" }}
        >
          Private Clinic Workspace
        </h1>
        <p
          className="text-sm text-center mb-8 leading-relaxed"
          style={{ color: "#64748B" }}
        >
          This system is restricted to approved users only.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="access-password"
              className="block text-xs font-semibold mb-1.5"
              style={{ color: "#475569" }}
            >
              Access Password
            </label>
            <input
              id="access-password"
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter access password"
              required
              className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors duration-150"
              style={{
                borderColor: error ? "#FECACA" : "#E2E8F0",
                backgroundColor: error ? "#FFF5F5" : "#FFFFFF",
                color: "#1A2B4A",
              }}
            />
          </div>

          {error && (
            <p
              className="text-xs font-medium text-center px-3 py-2.5 rounded-lg"
              style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-150 hover:-translate-y-px active:scale-95"
            style={{
              backgroundColor: loading || !password ? "#94A3B8" : "#1A2B4A",
              color: "#ffffff",
              cursor: loading || !password ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Verifying…" : "Continue"}
          </button>
        </form>

        <p
          className="text-xs text-center mt-7"
          style={{ color: "#CBD5E1" }}
        >
          Authorized access only.
        </p>
      </div>
    </div>
  );
}
