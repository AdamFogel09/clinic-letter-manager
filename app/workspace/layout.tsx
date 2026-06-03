"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/dashboard/Sidebar";

const RESET_VERSION = "v1";

function clearDemoData() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem("data_reset") === RESET_VERSION) return;
  const keysToRemove = [
    "clinic_letters_v1",
    "clinic_previewed_v1",
    "letter_preview",
    "letter_current_id",
    "letter_current_supabase_id",
    "letter_just_sent",
    "draft_patient",
  ];
  keysToRemove.forEach((k) => localStorage.removeItem(k));
  sessionStorage.clear();
  localStorage.setItem("data_reset", RESET_VERSION);
}

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { clearDemoData(); }, []);

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#F4F6F9" }}>
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ backgroundColor: "rgb(0 0 0 / 0.3)" }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      {mobileOpen && (
        <div
          className="fixed top-0 left-0 bottom-0 z-50 w-56 bg-white lg:hidden"
          style={{ borderRight: "1px solid #E2E8F0" }}
        >
          <Sidebar />
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div
          className="flex lg:hidden items-center justify-between px-5 py-4 bg-white"
          style={{ borderBottom: "1px solid #E2E8F0" }}
        >
          <span className="text-sm font-semibold" style={{ color: "#1A2B4A" }}>
            Dr. Sumit Chatterji
          </span>
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg"
            aria-label="Open menu"
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="#1A2B4A"
              strokeWidth={1.75}
              strokeLinecap="round"
              className="w-5 h-5"
            >
              <path d="M3 5h14M3 10h14M3 15h14" />
            </svg>
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
