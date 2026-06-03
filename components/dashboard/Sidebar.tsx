"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  {
    label: "Dashboard",
    href: "/workspace",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
        <rect x="1" y="1" width="6" height="6" rx="1" />
        <rect x="9" y="1" width="6" height="6" rx="1" />
        <rect x="1" y="9" width="6" height="6" rx="1" />
        <rect x="9" y="9" width="6" height="6" rx="1" />
      </svg>
    ),
  },
  {
    label: "Create Letter",
    href: "/workspace/new-letter",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
        <circle cx="8" cy="8" r="7" />
        <path d="M8 5v6M5 8h6" />
      </svg>
    ),
  },
  {
    label: "Drafts",
    href: "/workspace/drafts",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
        <path d="M9 1H3a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6L9 1z" />
        <path d="M9 1v5h5" />
        <path d="M5 9h6M5 12h4" />
      </svg>
    ),
  },
  {
    label: "Review",
    href: "/workspace/review",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
        <path d="M14 10H9l-2 3-2-6-2 3H1" />
      </svg>
    ),
  },
  {
    label: "Anat Review",
    href: "/workspace/anat-review",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
        <circle cx="8" cy="8" r="6.5"/>
        <path d="M8 1.5a10 10 0 0 1 0 13M8 1.5a10 10 0 0 0 0 13M1.5 8h13"/>
        <path d="M4 5.5h4M4 10.5h6"/>
      </svg>
    ),
  },
  {
    label: "All Letters",
    href: "/workspace/all-letters",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
        <rect x="1" y="3" width="14" height="3" rx="1" />
        <path d="M2 6v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6" />
        <path d="M6 10h4" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Clear all locally cached patient/letter data on logout.
    [
      "clinic_letters_v1", "clinic_previewed_v1",
      "letter_preview", "letter_current_id", "letter_current_supabase_id",
      "letter_just_sent", "letter_return_to", "letter_export_mode", "data_reset",
    ].forEach((k) => localStorage.removeItem(k));
    sessionStorage.clear();
    router.push("/login");
    router.refresh();
  };

  return (
    <aside
      className="hidden lg:flex flex-col w-56 flex-shrink-0 min-h-screen bg-white"
      style={{ borderRight: "1px solid #E2E8F0" }}
    >
      {/* Logo / name */}
      <div
        className="flex items-center gap-2.5 px-5 py-5"
        style={{ borderBottom: "1px solid #E2E8F0" }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
          style={{ backgroundColor: "#1A2B4A" }}
        >
          C
        </div>
        <span
          className="text-xs font-semibold"
          style={{ color: "#1A2B4A" }}
        >
          Dr. Sumit Chatterji
        </span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 hover:-translate-y-px"
              style={{
                backgroundColor: active ? "#F4F6F9" : "transparent",
                color: active ? "#1A2B4A" : "#64748B",
                fontWeight: active ? 600 : 400,
              }}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-5">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm w-full transition-colors duration-150 text-left"
          style={{ color: "#94A3B8", background: "none", border: "none", cursor: "pointer" }}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
            <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M10 11l3-3-3-3M13 8H6" />
          </svg>
          Logout
        </button>
      </div>
    </aside>
  );
}
