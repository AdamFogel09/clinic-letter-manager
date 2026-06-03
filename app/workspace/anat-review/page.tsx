"use client";

// Supabase is now the source of truth for patients and letters.
// Temporary storage should only be used as a fallback during development.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getLettersByStatus } from "@/lib/supabase/letters";
import { type StoredLetter } from "@/lib/letterStore";

export default function AnatReviewPage() {
  const router  = useRouter();
  const [letters,  setLetters]  = useState<StoredLetter[]>([]);
  const [justSent, setJustSent] = useState(false);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const supabaseLetters = await getLettersByStatus(supabase, ["Waiting for Anat"]);

      setLetters(supabaseLetters);
    };

    load();

    if (localStorage.getItem("letter_just_sent") === "1") {
      localStorage.removeItem("letter_just_sent");
      setJustSent(true);
      const t = setTimeout(() => setJustSent(false), 4000);
      return () => clearTimeout(t);
    }
  }, []);

  return (
    <div className="flex-1 pb-10">
      {/* Header */}
      <div className="px-6 sm:px-8 pt-8 pb-6">
        <button
          onClick={() => window.history.length > 1 ? router.back() : router.push("/workspace")}
          className="inline-flex items-center gap-1.5 text-xs font-medium mb-4"
          style={{ color: "#94A3B8", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2}
            strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
            <path d="M10 12L6 8l4-4"/>
          </svg>
          Back
        </button>
        <h1 className="text-xl sm:text-2xl font-bold" style={{ color: "#1A2B4A" }}>
          Anat Review Workspace
        </h1>
        <p className="text-sm mt-1" style={{ color: "#94A3B8" }}>
          Review translated Hebrew sections before doctor approval
        </p>
      </div>

      {justSent && (
        <div className="px-6 sm:px-8 mb-5">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{ backgroundColor: "#CCFBF1", border: "1px solid #99F6E4" }}>
            <svg viewBox="0 0 16 16" fill="none" stroke="#0D9488" strokeWidth={2.5}
              strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
              <path d="M3 8l4 4 6-7"/>
            </svg>
            <p className="text-sm font-semibold" style={{ color: "#0D9488" }}>Letter sent to Anat for review.</p>
          </div>
        </div>
      )}

      <div className="px-6 sm:px-8">
        <div className="flex items-center gap-2.5 mb-3">
          <h2 className="text-sm font-bold" style={{ color: "#1A2B4A" }}>Waiting for Review</h2>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full tabular-nums"
            style={{ backgroundColor: "#EDE9FE", color: "#7C3AED" }}>
            {letters.length}
          </span>
        </div>

        {letters.length === 0 ? (
          <div className="flex items-center justify-center py-12 rounded-xl"
            style={{ border: "1px dashed #E2E8F0" }}>
            <p className="text-sm" style={{ color: "#CBD5E1" }}>No letters waiting for review.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {letters.map((letter) => (
              <div key={letter.id}
                className="bg-white rounded-2xl border px-5 py-4"
                style={{ borderColor: "#E2E8F0",
                  boxShadow: "0 1px 3px 0 rgb(0 0 0/0.05), 0 4px 16px 0 rgb(26 43 74/0.04)" }}>
                {/* Top row: patient info */}
                <div className="mb-3">
                  <p className="text-sm font-semibold" style={{ color: "#1A2B4A" }}>
                    {letter.patientName}
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
                {/* Bottom row: badge + action */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: "#EDE9FE", color: "#7C3AED" }}>
                    Waiting for Anat
                  </span>
                  <Link href={`/workspace/anat-review/${letter.id}`}
                    className="flex-1 sm:flex-none text-center text-sm font-semibold px-5 py-2.5 rounded-xl border transition-all duration-150 hover:-translate-y-px active:scale-95"
                    style={{ backgroundColor: "#7C3AED", color: "#fff", borderColor: "#7C3AED" }}>
                    Review Translation
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
