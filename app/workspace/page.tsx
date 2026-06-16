"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import StatusCard from "@/components/dashboard/StatusCard";
import { getLetters } from "@/lib/letterStore";
import { createClient } from "@/lib/supabase/client";
import { getAllPatients, patientToDraft, updatePatient, type Patient } from "@/lib/supabase/patients";
import { getLetterCounts, duplicateLetter } from "@/lib/supabase/letters";

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

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  "Draft":             { bg: "#EBF3FB", text: "#4A90D9" },
  "Ready for Review":  { bg: "#FEF3C7", text: "#D97706" },
  "Waiting for Anat":  { bg: "#EDE9FE", text: "#7C3AED" },
  "Reviewed":          { bg: "#FFE4E6", text: "#BE123C" },
  "Ready for Patient": { bg: "#CCFBF1", text: "#0D9488" },
  "Sent to Patient":   { bg: "#F0FDF4", text: "#16A34A" },
};

type GmailStatus = "checking" | "connected" | "disconnected";

export default function WorkspacePage() {
  const router = useRouter();

  const [gmailStatus, setGmailStatus] = useState<GmailStatus>("checking");
  const [counts, setCounts] = useState({
    draft: 0, waitingForAnat: 0,
    reviewed: 0, readyForPatient: 0,
  });

  // All patients pre-loaded from Supabase for instant client-side search
  const [patients, setPatients]       = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen,  setSearchOpen]  = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Create Update Letter loading/error state
  const [duplicatingPatientId, setDuplicatingPatientId] = useState<string | null>(null);
  const [duplicateError, setDuplicateError] = useState("");

  // Edit patient modal
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [editFields, setEditFields]         = useState<Partial<Patient>>({});
  const [editSaving, setEditSaving]         = useState(false);
  const [editError,  setEditError]          = useState("");

  useEffect(() => {
    const supabase = createClient();

    // Letter counts from Supabase (primary); fall back to localStorage
    getLetterCounts(supabase).then((sc) => {
      if (Object.keys(sc).length > 0) {
        setCounts({
          draft:           sc["Draft"]             || 0,
          waitingForAnat:  sc["Waiting for Anat"]  || 0,
          reviewed:        sc["Reviewed"]           || 0,
          readyForPatient: sc["Ready for Patient"]  || 0,
        });
      } else {
        const letters = getLetters();
        setCounts({
          draft:           letters.filter((l) => l.status === "Draft").length,
          waitingForAnat:  letters.filter((l) => l.status === "Waiting for Anat").length,
          reviewed:        letters.filter((l) => l.status === "Reviewed").length,
          readyForPatient: letters.filter((l) => l.status === "Ready for Patient").length,
        });
      }
    });

    // Patients from Supabase
    getAllPatients(supabase).then(setPatients);

    // Gmail connection status
    fetch("/api/gmail/status")
      .then(r => r.json())
      .then(d => setGmailStatus(d.connected ? "connected" : "disconnected"))
      .catch(() => setGmailStatus("disconnected"));
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Client-side filter of the pre-loaded patient list
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return patients
      .filter(
        (p) =>
          p.full_name.toLowerCase().includes(q) ||
          p.patient_id_number.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [patients, searchQuery]);

  const handleCreateUpdateLetter = async (p: Patient) => {
    if (duplicatingPatientId) return;
    setDuplicatingPatientId(p.id);
    setDuplicateError("");
    setSearchOpen(false);

    try {
      const supabase = createClient();
      // Find the most recent letter for this patient
      const { data: latestRows } = await supabase
        .from("letters")
        .select("id")
        .eq("patient_id", p.id)
        .order("updated_at", { ascending: false })
        .limit(1);

      const latestId = latestRows?.[0]?.id as string | undefined;

      if (latestId) {
        // Duplicate the latest letter — same flow as All Letters page
        const { id: newId } = await duplicateLetter(supabase, latestId);
        sessionStorage.setItem("letter_supabase_id", newId);
        sessionStorage.setItem("load_from_supabase", "1");
        sessionStorage.setItem("is_update_mode", "1");
        sessionStorage.removeItem("draft_patient");
        sessionStorage.removeItem("letter_draft");
        localStorage.setItem("letter_current_supabase_id", newId);
        router.push("/workspace/letter-editor");
      } else {
        // No existing letters — start a fresh blank letter for this patient
        sessionStorage.setItem("draft_patient", JSON.stringify(patientToDraft(p)));
        sessionStorage.removeItem("letter_draft");
        sessionStorage.removeItem("letter_draft_id");
        sessionStorage.removeItem("letter_supabase_id");
        router.push("/workspace/letter-editor");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create update letter.";
      setDuplicateError(msg);
      setDuplicatingPatientId(null);
      setTimeout(() => setDuplicateError(""), 5000);
    }
  };

  const viewHistory = (p: Patient) => {
    const param = encodeURIComponent(p.patient_id_number || p.full_name);
    router.push(`/workspace/all-letters?q=${param}`);
  };

  const openEdit = (p: Patient) => {
    setEditingPatient(p);
    setEditFields({
      full_name: p.full_name, patient_id_number: p.patient_id_number,
      birthdate_day: p.birthdate_day, birthdate_month: p.birthdate_month, birthdate_year: p.birthdate_year,
      gender: p.gender, email: p.email, phone: p.phone,
      smoking_vaping: p.smoking_vaping, pets: p.pets,
      occupation: p.occupation, referred_by: p.referred_by, location: p.location,
    });
    setEditError("");
    setSearchOpen(false);
  };

  const saveEdit = async () => {
    if (!editingPatient) return;
    setEditSaving(true);
    setEditError("");
    const supabase = createClient();
    const { error } = await updatePatient(supabase, editingPatient.id, editFields);
    if (error) {
      setEditError(error);
      setEditSaving(false);
      return;
    }
    // Refresh the local patients list
    const updated = await getAllPatients(supabase);
    setPatients(updated);
    setEditingPatient(null);
    setEditSaving(false);
  };

  const cards = [
    { status: "Draft",             badgeBg: "#EBF3FB", badgeText: "#4A90D9", title: "To Complete",       count: counts.draft,           buttonLabel: "Continue", buttonHref: "/workspace/drafts" },
    { status: "Waiting for Anat",  badgeBg: "#EDE9FE", badgeText: "#7C3AED", title: "Waiting for Anat",  count: counts.waitingForAnat,   buttonLabel: "View",     buttonHref: "/workspace/review" },
    { status: "Reviewed",          badgeBg: "#FFE4E6", badgeText: "#BE123C", title: "Needs Approval",    count: counts.reviewed,         buttonLabel: "Approve",  buttonHref: "/workspace/review" },
    { status: "Ready for Patient", badgeBg: "#CCFBF1", badgeText: "#0D9488", title: "Ready for Patient", count: counts.readyForPatient,  buttonLabel: "Export",   buttonHref: "/workspace/review" },
  ];

  return (
    <div className="flex-1 pb-10">
      {/* Top bar */}
      <div className="grid grid-cols-3 items-start px-6 sm:px-8 pt-8 pb-4">
        <div />
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: "#1A2B4A" }}>
            Welcome back, Dr. Sumit
          </h1>
          <p className="text-sm mt-1" style={{ color: "#94A3B8" }}>Clinic letter workspace</p>
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <Link href="/workspace/new-patient"
            className="inline-flex items-center text-sm font-semibold px-4 py-2.5 rounded-xl transition-all duration-150 hover:-translate-y-px hover:shadow-md"
            style={{ backgroundColor: "#1A2B4A", color: "#ffffff" }}>
            New Patient
          </Link>
          <Link href="/workspace/new-letter"
            className="inline-flex items-center text-sm font-semibold px-4 py-2.5 rounded-xl transition-all duration-150 hover:-translate-y-px hover:shadow-md"
            style={{ backgroundColor: "#1A2B4A", color: "#ffffff" }}>
            New Letter
          </Link>
        </div>
      </div>

      {/* Gmail status button */}
      <div className="px-6 sm:px-8 mb-4">
        <a
          href="/api/gmail/oauth/start"
          className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl text-sm font-bold transition-all duration-150 hover:-translate-y-px hover:shadow-lg active:scale-95"
          style={{
            backgroundColor:
              gmailStatus === "checking"  ? "#64748B" :
              gmailStatus === "connected" ? "#0D9488" : "#DC2626",
            color: "#ffffff",
          }}
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor"
            strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
            className="w-4 h-4 flex-shrink-0">
            <rect x="2" y="4" width="16" height="12" rx="2"/>
            <path d="M2 6l8 5 8-5"/>
          </svg>
          {gmailStatus === "checking"     && "Gmail — checking…"}
          {gmailStatus === "connected"    && "Gmail Connected ✓ — Click to Reconnect"}
          {gmailStatus === "disconnected" && "⚠ Gmail Disconnected — Click Here to Connect"}
        </a>
      </div>

      {/* Patient Search */}
      <div className="px-6 sm:px-8 mb-5">
        <div ref={searchRef} className="relative">
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white"
            style={{ border: `1px solid ${searchOpen ? "#1A2B4A" : "#E2E8F0"}`, transition: "border-color 0.15s" }}
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="#94A3B8" strokeWidth={1.75}
              strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
              <circle cx="9" cy="9" r="6" /><path d="M17 17l-3.5-3.5" />
            </svg>
            <input
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search patient by name or ID"
              className="flex-1 text-sm bg-transparent focus:outline-none"
              style={{ color: "#1A2B4A" }}
              autoComplete="off"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(""); setSearchOpen(false); }}
                className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full"
                style={{ background: "#E2E8F0" }}
                aria-label="Clear"
              >
                <svg viewBox="0 0 12 12" fill="none" stroke="#64748B" strokeWidth={2}
                  strokeLinecap="round" className="w-2.5 h-2.5">
                  <path d="M2 2l8 8M10 2l-8 8" />
                </svg>
              </button>
            )}
          </div>

          {/* Dropdown */}
          {searchOpen && searchQuery.trim() && (
            <div
              className="absolute left-0 right-0 top-full mt-1.5 rounded-2xl bg-white overflow-hidden z-50"
              style={{ border: "1px solid #E2E8F0", boxShadow: "0 8px 32px rgb(26 43 74/0.12)" }}
            >
              {searchResults.length === 0 ? (
                <div className="px-5 py-5 text-center">
                  <p className="text-sm" style={{ color: "#94A3B8" }}>No patient found.</p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: "#F1F5F9" }}>
                  {searchResults.map((p) => {
                    const age  = calcAge(p.birthdate_day, p.birthdate_month, p.birthdate_year);
                    const dob  = formatDOB(p.birthdate_day, p.birthdate_month, p.birthdate_year);
                    const meta = [age, p.gender].filter(Boolean).join(" · ");

                    // Match latest letter status from localStorage
                    const letters = getLetters().filter(
                      (l) => l.patientId === p.patient_id_number || l.patientName === p.full_name
                    );
                    const latestLetter = letters.sort(
                      (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
                    )[0];
                    const sc = latestLetter
                      ? (STATUS_COLORS[latestLetter.status] ?? { bg: "#F1F5F9", text: "#475569" })
                      : null;

                    return (
                      <div key={p.id} className="px-5 py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold" style={{ color: "#1A2B4A" }}>
                                {p.full_name}
                              </span>
                              {latestLetter && sc && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                  style={{ backgroundColor: sc.bg, color: sc.text }}>
                                  {latestLetter.status}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 mt-1">
                              {p.patient_id_number && (
                                <span className="text-xs" style={{ color: "#64748B" }}>{p.patient_id_number}</span>
                              )}
                              {dob && (
                                <span className="text-xs" style={{ color: "#64748B" }}>DOB: {dob}</span>
                              )}
                              {meta && (
                                <span className="text-xs" style={{ color: "#64748B" }}>{meta}</span>
                              )}
                              {p.phone && (
                                <span className="text-xs" style={{ color: "#94A3B8" }}>{p.phone}</span>
                              )}
                              {p.email && (
                                <span className="text-xs" style={{ color: "#94A3B8" }}>{p.email}</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => openEdit(p)}
                              className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all duration-150 hover:-translate-y-px"
                              style={{ borderColor: "#E2E8F0", color: "#64748B", background: "white" }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => viewHistory(p)}
                              className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all duration-150 hover:-translate-y-px"
                              style={{ borderColor: "#E2E8F0", color: "#64748B", background: "white" }}
                            >
                              History
                            </button>
                            <button
                              onClick={() => handleCreateUpdateLetter(p)}
                              disabled={duplicatingPatientId === p.id}
                              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all duration-150 hover:-translate-y-px hover:shadow-sm"
                              style={{ backgroundColor: "#1A2B4A", color: "#fff", opacity: duplicatingPatientId === p.id ? 0.6 : 1 }}
                            >
                              {duplicatingPatientId === p.id ? "Creating…" : "Create Update Letter"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Duplicate error */}
      {duplicateError && (
        <div className="px-6 sm:px-8 mb-4">
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
            style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA" }}>
            <p className="text-xs font-semibold" style={{ color: "#DC2626" }}>{duplicateError}</p>
          </div>
        </div>
      )}

      {/* Status cards */}
      <div className="px-6 sm:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card) => (
            <StatusCard key={card.title} {...card} />
          ))}
        </div>
      </div>

      {/* Edit patient modal */}
      {editingPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ backgroundColor: "rgba(26,43,74,0.5)" }}
          onClick={() => !editSaving && setEditingPatient(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            style={{ boxShadow: "0 24px 64px rgb(26 43 74 / 0.25)" }}
            onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 flex items-center justify-between"
              style={{ borderBottom: "1px solid #F1F5F9" }}>
              <h2 className="text-base font-bold" style={{ color: "#1A2B4A" }}>Edit Patient</h2>
              <button onClick={() => !editSaving && setEditingPatient(null)}
                className="w-7 h-7 flex items-center justify-center rounded-full"
                style={{ background: "#F1F5F9", color: "#64748B" }}>
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2}
                  strokeLinecap="round" className="w-3 h-3">
                  <path d="M2 2l8 8M10 2l-8 8"/>
                </svg>
              </button>
            </div>
            <div className="px-6 py-4 grid grid-cols-2 gap-4">
              {[
                { label: "Full Name",      key: "full_name",          colSpan: true },
                { label: "Patient ID",     key: "patient_id_number",  colSpan: false },
                { label: "Email",          key: "email",              colSpan: true },
                { label: "Phone",          key: "phone",              colSpan: false },
                { label: "Day (DD)",       key: "birthdate_day",      colSpan: false },
                { label: "Month (MM)",     key: "birthdate_month",    colSpan: false },
                { label: "Year (YYYY)",    key: "birthdate_year",     colSpan: false },
                { label: "Gender",         key: "gender",             colSpan: false },
                { label: "Smoking/Vaping", key: "smoking_vaping",     colSpan: false },
                { label: "Pets",           key: "pets",               colSpan: false },
                { label: "Occupation",     key: "occupation",         colSpan: false },
                { label: "Referred By",    key: "referred_by",        colSpan: false },
                { label: "Location",       key: "location",           colSpan: false },
              ].map(({ label, key, colSpan }) => (
                <div key={key} className={colSpan ? "col-span-2" : ""}>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "#64748B" }}>{label}</label>
                  <input
                    value={(editFields as Record<string, string>)[key] ?? ""}
                    onChange={e => setEditFields(prev => ({ ...prev, [key]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none"
                    style={{ border: "1px solid #E2E8F0", color: "#1A2B4A", backgroundColor: "#FAFBFC" }}
                  />
                </div>
              ))}
            </div>
            {editError && (
              <p className="px-6 pb-2 text-xs" style={{ color: "#DC2626" }}>{editError}</p>
            )}
            <div className="px-6 pb-6 flex gap-2 justify-end">
              <button onClick={() => setEditingPatient(null)} disabled={editSaving}
                className="text-xs font-semibold px-4 py-2 rounded-xl border"
                style={{ borderColor: "#E2E8F0", color: "#64748B", background: "white" }}>
                Cancel
              </button>
              <button onClick={saveEdit} disabled={editSaving}
                className="text-xs font-semibold px-4 py-2 rounded-xl"
                style={{ backgroundColor: editSaving ? "#94A3B8" : "#1A2B4A", color: "#fff" }}>
                {editSaving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
