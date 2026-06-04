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

      {/* Mobile overlay — fades in/out */}
      <div
        className={`fixed inset-0 z-40 lg:hidden transition-opacity duration-300 ${
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
        onClick={() => setMobileOpen(false)}
      />

      {/* Mobile sidebar drawer — slides in from left */}
      <div
        className={`fixed top-0 left-0 h-full z-50 w-72 flex flex-col lg:hidden transition-transform duration-300 ease-in-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ boxShadow: "4px 0 32px rgba(0,0,0,0.14)" }}
      >
        <Sidebar mobile onClose={() => setMobileOpen(false)} />
      </div>

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
            className="p-2 rounded-lg transition-colors duration-150 hover:bg-slate-100 active:bg-slate-200"
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
