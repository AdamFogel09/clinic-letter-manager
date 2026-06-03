"use client";

// Patients are now stored in Supabase.
// Letters are still temporary (localStorage) and will be migrated next.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getAllPatients, patientToDraft, type Patient } from "@/lib/supabase/patients";

function calcAge(day: string, month: string, year: string): string {
  const dy = parseInt(day), mo = parseInt(month), yr = parseInt(year);
  if (!dy || !mo || !yr || yr < 1900 || yr > new Date().getFullYear()) return "";
  const birth = new Date(yr, mo - 1, dy);
  if (isNaN(birth.getTime()) || birth.getMonth() !== mo - 1) return "";
  const now = new Date();
  let yrs = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < mo - 1 || (now.getMonth() === mo - 1 && now.getDate() < dy)) yrs--;
  if (yrs < 0) return "";
  return `${yrs}y`;
}

function formatDOB(day: string, month: string, year: string): string {
  if (!day || !month || !year) return "";
  return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
}

function fmtPhone(p: string): string {
  const c = (p || "").replace(/\D/g, "");
  if (c.length === 10) return `${c.slice(0, 3)}-${c.slice(3)}`;
  return p;
}

export default function NewLetterPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [query,    setQuery]    = useState("");

  useEffect(() => {
    const supabase = createClient();
    getAllPatients(supabase).then((data) => {
      setPatients(data);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) =>
        p.full_name.toLowerCase().includes(q) ||
        p.patient_id_number.toLowerCase().includes(q)
    );
  }, [patients, query]);

  const handleBack = () => {
    if (window.history.length > 1) router.back();
    else router.push("/workspace");
  };

  const startNewLetter = (p: Patient) => {
    sessionStorage.setItem("draft_patient", JSON.stringify(patientToDraft(p)));
    sessionStorage.removeItem("letter_draft");
    sessionStorage.removeItem("letter_draft_id");
    sessionStorage.removeItem("letter_supabase_id");
    router.push("/workspace/letter-editor");
  };

  const hasPatients = patients.length > 0;
  const noResults   = !loading && query.trim() !== "" && filtered.length === 0;

  return (
    <div className="flex-1 pb-12">
      {/* Header */}
      <div className="px-6 sm:px-8 pt-8 pb-6">
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 text-xs font-medium mb-5"
          style={{ color: "#94A3B8", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2}
            strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
            <path d="M10 12L6 8l4-4" />
          </svg>
          Back
        </button>
        <h1 className="text-xl sm:text-2xl font-bold" style={{ color: "#1A2B4A" }}>
          New Letter
        </h1>
        <p className="text-sm mt-1" style={{ color: "#94A3B8" }}>
          Search for an existing patient to add a new clinic letter.
        </p>
      </div>

      <div className="px-6 sm:px-8">
        {/* Search bar */}
        <div className="relative mb-4">
          <svg viewBox="0 0 20 20" fill="none" stroke="#CBD5E1" strokeWidth={1.75}
            strokeLinecap="round" strokeLinejoin="round"
            className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none">
            <circle cx="9" cy="9" r="6" /><path d="M17 17l-3.5-3.5" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by patient name or ID"
            className="w-full pl-11 pr-10 py-3 rounded-xl border bg-white text-sm focus:outline-none transition-colors duration-150"
            style={{ borderColor: "#E2E8F0", color: "#1A2B4A" }}
            autoComplete="off"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full"
              style={{ background: "#E2E8F0" }}
              aria-label="Clear search"
            >
              <svg viewBox="0 0 12 12" fill="none" stroke="#64748B" strokeWidth={2}
                strokeLinecap="round" className="w-2.5 h-2.5">
                <path d="M2 2l8 8M10 2l-8 8" />
              </svg>
            </button>
          )}
        </div>

        {/* Status label */}
        <p className="text-xs mb-4" style={{ color: "#94A3B8" }}>
          {loading
            ? "Loading patients…"
            : noResults
              ? "No patients found."
              : query.trim()
                ? `${filtered.length} patient${filtered.length !== 1 ? "s" : ""} found`
                : !hasPatients
                  ? "No patients yet."
                  : `${patients.length} patient${patients.length !== 1 ? "s" : ""}`}
        </p>

        {/* Loading skeleton */}
        {loading && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border px-6 py-5 animate-pulse"
                style={{ borderColor: "#E2E8F0", height: 88 }} />
            ))}
          </div>
        )}

        {/* Empty state — no patients in DB */}
        {!loading && !hasPatients && (
          <div className="flex flex-col items-center justify-center py-16 rounded-2xl"
            style={{ border: "1px dashed #E2E8F0" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth={1.5}
              strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 mb-3">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <p className="text-sm font-medium" style={{ color: "#CBD5E1" }}>No patients found.</p>
            <p className="text-xs mt-1" style={{ color: "#CBD5E1" }}>
              Create a patient first to add letters.
            </p>
          </div>
        )}

        {/* No search results */}
        {!loading && hasPatients && noResults && (
          <div className="flex items-center justify-center py-12 rounded-2xl"
            style={{ border: "1px dashed #E2E8F0" }}>
            <p className="text-sm font-medium" style={{ color: "#CBD5E1" }}>No patients found.</p>
          </div>
        )}

        {/* Patient list */}
        {!loading && filtered.length > 0 && (
          <div className="flex flex-col gap-3">
            {filtered.map((p) => {
              const age     = calcAge(p.birthdate_day, p.birthdate_month, p.birthdate_year);
              const dob     = formatDOB(p.birthdate_day, p.birthdate_month, p.birthdate_year);
              const ageLine = [age, p.gender].filter(Boolean).join(" · ");

              return (
                <div
                  key={p.id}
                  className="bg-white rounded-2xl border px-5 py-4 sm:px-6 sm:py-5"
                  style={{
                    borderColor: "#E2E8F0",
                    boxShadow: "0 1px 3px 0 rgb(0 0 0/0.06), 0 4px 16px 0 rgb(26 43 74/0.05)",
                  }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold" style={{ color: "#1A2B4A" }}>
                        {p.full_name}
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                        {p.patient_id_number && (
                          <span className="text-xs" style={{ color: "#64748B" }}>
                            ID: {p.patient_id_number}
                          </span>
                        )}
                        {dob && (
                          <span className="text-xs" style={{ color: "#64748B" }}>
                            DOB: {dob}
                          </span>
                        )}
                        {ageLine && (
                          <span className="text-xs" style={{ color: "#64748B" }}>{ageLine}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                        {p.phone && (
                          <span className="text-xs" style={{ color: "#94A3B8" }}>
                            {fmtPhone(p.phone)}
                          </span>
                        )}
                        {p.email && (
                          <span className="text-xs" style={{ color: "#94A3B8" }}>{p.email}</span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => startNewLetter(p)}
                      className="w-full sm:w-auto inline-flex items-center justify-center text-sm font-semibold px-5 py-2.5 rounded-xl transition-all duration-150 hover:-translate-y-px hover:shadow-md active:scale-95"
                      style={{ backgroundColor: "#1A2B4A", color: "#ffffff" }}
                    >
                      Start New Letter
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
