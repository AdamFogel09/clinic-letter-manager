"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("Invalid email or password. Please try again.");
      setLoading(false);
      return;
    }

    // Refresh the router so middleware picks up the new session cookie.
    router.push("/workspace");
    router.refresh();
  };

  return (
    <main
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: "#F4F6F9" }}
    >
      <div
        className="bg-white rounded-2xl border p-10 w-full max-w-sm"
        style={{
          borderColor: "#E2E8F0",
          boxShadow:
            "0 1px 3px 0 rgb(0 0 0 / 0.07), 0 4px 16px 0 rgb(26 43 74 / 0.06)",
        }}
      >
        {/* Logo */}
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold mx-auto mb-6"
          style={{ backgroundColor: "#1A2B4A" }}
        >
          C
        </div>

        <h1 className="text-xl font-bold text-center mb-1" style={{ color: "#1A2B4A" }}>
          Doctor Login
        </h1>
        <p className="text-xs text-center mb-8" style={{ color: "#94A3B8" }}>
          Authorised users only
        </p>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          {/* Email */}
          <div>
            <label
              className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
              style={{ color: "#64748B" }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="doctor@clinic.com"
              className="w-full px-4 py-2.5 rounded-xl border bg-white text-sm focus:outline-none transition-colors duration-150"
              style={{ borderColor: "#E2E8F0", color: "#1A2B4A" }}
            />
          </div>

          {/* Password */}
          <div>
            <label
              className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
              style={{ color: "#64748B" }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-xl border bg-white text-sm focus:outline-none transition-colors duration-150"
              style={{ borderColor: "#E2E8F0", color: "#1A2B4A" }}
            />
          </div>

          {/* Error message */}
          {error && (
            <div
              className="px-4 py-3 rounded-xl text-sm"
              style={{ backgroundColor: "#FFF1F2", color: "#BE123C", border: "1px solid #FECDD3" }}
            >
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 text-sm font-semibold rounded-xl transition-all duration-150 hover:-translate-y-px hover:shadow-md"
            style={{
              backgroundColor: "#1A2B4A",
              color: "#ffffff",
              opacity: loading ? 0.7 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </main>
  );
}
