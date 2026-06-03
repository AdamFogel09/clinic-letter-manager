"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function UnauthorizedPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.signOut();
  }, []);

  return (
    <main
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: "#F4F6F9" }}
    >
      <div
        className="bg-white rounded-2xl border p-10 w-full max-w-sm text-center"
        style={{
          borderColor: "#E2E8F0",
          boxShadow:
            "0 1px 3px 0 rgb(0 0 0 / 0.07), 0 4px 16px 0 rgb(26 43 74 / 0.06)",
        }}
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold mx-auto mb-6"
          style={{ backgroundColor: "#BE123C" }}
        >
          ✕
        </div>

        <h1 className="text-xl font-bold mb-2" style={{ color: "#1A2B4A" }}>
          Access denied
        </h1>
        <p className="text-sm mb-8" style={{ color: "#64748B", lineHeight: "1.6" }}>
          This private workspace is only available to approved users.
        </p>

        <button
          onClick={() => router.push("/login")}
          className="w-full py-3 text-sm font-semibold rounded-xl transition-all duration-150 hover:-translate-y-px hover:shadow-md"
          style={{ backgroundColor: "#1A2B4A", color: "#ffffff" }}
        >
          Back to Login
        </button>
      </div>
    </main>
  );
}
