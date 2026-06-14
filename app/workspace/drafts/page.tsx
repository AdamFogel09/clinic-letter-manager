"use client";

// Supabase is now the source of truth for patients and letters.
// Temporary storage should only be used as a fallback during development.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getLettersByStatus } from "@/lib/supabase/letters";
import { type StoredLetter } from "@/lib/letterStore";

function openInEditor(letter: StoredLetter, router: ReturnType<typeof useRouter>) {
  // Tell the editor to fetch fresh data from Supabase for this letter
  sessionStorage.setItem("letter_supabase_id", letter.id);
  sessionStorage.setItem("load_from_supabase", "1");
  sessionStorage.removeItem("draft_patient");
  sessionStorage.removeItem("letter_draft");
  sessionStorage.removeItem("letter_draft_id");
  localStorage.setItem("letter_current_id", letter.id);
  localStorage.setItem("letter_current_supabase_id", letter.id);
  router.push("/workspace/letter-editor");
}

export default function DraftsPage() {
  const router = useRouter();
  const [drafts,  setDrafts]  = useState<StoredLetter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const supabaseDrafts = await getLettersByStatus(supabase, ["Draft"]);
      setDrafts(supabaseDrafts);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div className="flex-1 pb-10">
      {/* Header */}
      <div className="grid grid-cols-3 items-start px-6 sm:px-8 pt-8 pb-6">
        <div />
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: "#1A2B4A" }}>Drafts</h1>
          <p className="text-sm mt-1" style={{ color: "#94A3B8" }}>Letters in progress</p>
        </div>
        <div className="flex items-center justify-end pt-1">
          <Link href="/workspace/new-letter"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl transition-all duration-150 hover:-translate-y-px"
            style={{ backgroundColor: "#1A2B4A", color: "#ffffff" }}>
            New Letter
          </Link>
        </div>
      </div>

      <div className="px-6 sm:px-8">
        <div className="flex items-center gap-2.5 mb-3">
          <h2 className="text-sm font-bold" style={{ color: "#1A2B4A" }}>Draft Letters</h2>
          {!loading && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full tabular-nums"
              style={{ backgroundColor: "#EBF3FB", color: "#4A90D9" }}>
              {drafts.length}
            </span>
          )}
        </div>

        {loading && (
          <div className="flex flex-col gap-2.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border animate-pulse"
                style={{ borderColor: "#E2E8F0", height: 72 }} />
            ))}
          </div>
        )}

        {!loading && drafts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 rounded-2xl"
            style={{ border: "1px dashed #E2E8F0" }}>
            <svg viewBox="0 0 48 48" fill="none" stroke="#CBD5E1" strokeWidth={1.5}
              strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12 mb-3">
              <path d="M28 4H12a4 4 0 0 0-4 4v32a4 4 0 0 0 4 4h24a4 4 0 0 0 4-4V20L28 4z"/>
              <path d="M28 4v16h16M16 28h16M16 36h10"/>
            </svg>
            <p className="text-sm font-semibold mb-1" style={{ color: "#94A3B8" }}>
              No draft letters yet
            </p>
            <p className="text-xs mb-4" style={{ color: "#CBD5E1" }}>
              Letters in progress will appear here
            </p>
            <Link href="/workspace/new-letter"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all duration-150 hover:-translate-y-px"
              style={{ backgroundColor: "#1A2B4A", color: "#ffffff" }}>
              Create New Letter
            </Link>
          </div>
        )}

        {!loading && drafts.length > 0 && (
          <div className="flex flex-col gap-2.5">
            {drafts.map((letter) => (
              <div key={letter.id}
                className="bg-white rounded-2xl border flex items-center justify-between gap-4 px-5 py-4"
                style={{
                  borderColor: "#E2E8F0",
                  boxShadow: "0 1px 3px 0 rgb(0 0 0/0.05), 0 4px 16px 0 rgb(26 43 74/0.04)",
                }}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "#1A2B4A" }}>
                    {letter.patientName || "Unnamed Patient"}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {letter.patientId && (
                      <span className="text-xs" style={{ color: "#94A3B8" }}>{letter.patientId}</span>
                    )}
                    {letter.patientId && letter.letterDate && <span style={{ color: "#E2E8F0" }}>·</span>}
                    {letter.letterDate && (
                      <span className="text-xs" style={{ color: "#94A3B8" }}>{letter.letterDate}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full hidden sm:inline-flex"
                    style={{ backgroundColor: "#EBF3FB", color: "#4A90D9" }}>
                    Draft
                  </span>
                  <button
                    onClick={() => openInEditor(letter, router)}
                    className="text-xs font-semibold px-4 py-2 rounded-xl border transition-all duration-150 hover:-translate-y-px"
                    style={{ backgroundColor: "#1A2B4A", color: "#fff", borderColor: "#1A2B4A" }}>
                    Create Update Letter
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
