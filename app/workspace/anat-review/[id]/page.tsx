"use client";

// Supabase is now the source of truth for patients and letters.
// Temporary storage should only be used as a fallback during development.

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  getLetterById,
  updateLetterHebrew,
  updateLetterStatus,
} from "@/lib/supabase/letters";
import {
  getLetter,
  updateLetterData,
  updateStatus,
} from "@/lib/letterStore";

// ─── Section card: editable Hebrew + inline English reference ─────────────────

function EditSection({
  title, titleHe, refContent, children,
}: {
  title: string; titleHe: string;
  refContent?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border p-5 mb-4"
      style={{ borderColor: "#E2E8F0", boxShadow: "0 1px 3px 0 rgb(0 0 0/0.05)" }}>
      <div className="flex items-baseline justify-between pb-3 mb-4"
        style={{ borderBottom: "2px solid #1A2B4A" }}>
        <h3 className="text-base font-bold" style={{ color: "#1A2B4A" }}>{title}</h3>
        <span className="text-base font-semibold" style={{ color: "#1A2B4A" }}>{titleHe}</span>
      </div>
      {refContent && (
        <div className="rounded-xl px-4 py-3 mb-4"
          style={{ backgroundColor: "#F8FAFC", border: "1px solid #F1F5F9" }}>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2"
            style={{ color: "#94A3B8", letterSpacing: "0.1em" }}>
            English Reference
          </p>
          {refContent}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnatReviewLetterPage() {
  const router = useRouter();
  const params = useParams();
  const id     = params.id as string;

  const [notFound,  setNotFound]  = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [diagHE,    setDiagHE]    = useState("");
  const [sumHE,     setSumHE]     = useState("");
  const [planHE,    setPlanHE]    = useState<string[]>([""]);
  const [diagEN,    setDiagEN]    = useState("");
  const [sumEN,     setSumEN]     = useState("");
  const [planEN,    setPlanEN]    = useState<string[]>([]);
  const [gender,    setGender]    = useState("");
  const [patName,   setPatName]   = useState("");
  const [patId,     setPatId]     = useState("");
  const [letterDate, setLetterDate] = useState("");

  const [saving,    setSaving]    = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [savedMsg,  setSavedMsg]  = useState(false);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const letter   = await getLetterById(supabase, id);

      if (letter) {
        // Loaded from Supabase
        const p = letter.patients;
        setPatName(p?.full_name          || "");
        setPatId(p?.patient_id_number    || "");
        setLetterDate(letter.letter_date || "");
        setGender(p?.gender              || "");
        setDiagEN(letter.diagnosis_english || "");
        setSumEN(letter.summary_english  || "");
        setPlanEN((letter.plan_english || []).filter(Boolean));
        setDiagHE(letter.diagnosis_hebrew || "");
        setSumHE(letter.summary_hebrew   || "");
        const steps = (letter.plan_hebrew || []).filter((s) => typeof s === "string");
        setPlanHE(steps.length > 0 ? steps : [""]);
      } else {
        // Fallback to localStorage
        const local = getLetter(id);
        if (!local) { setNotFound(true); setLoading(false); return; }
        const d = (local.data ?? {}) as Record<string, unknown>;
        setPatName(local.patientName || "");
        setPatId(local.patientId     || "");
        setLetterDate(local.letterDate || "");
        setGender((d.gender  as string) || "");
        setDiagEN((d.diagEN  as string) || "");
        setSumEN ((d.sumEN   as string) || "");
        setPlanEN(Array.isArray(d.planStepsEN)
          ? (d.planStepsEN as string[]).filter(Boolean) : []);
        setDiagHE((d.diagHE  as string) || "");
        setSumHE ((d.sumHE   as string) || "");
        const steps = Array.isArray(d.planStepsHE)
          ? (d.planStepsHE as string[]).filter((s) => typeof s === "string") : [];
        setPlanHE(steps.length > 0 ? steps : [""]);
      }
      setLoading(false);
    };
    load();
  }, [id]);

  const collect = () => ({ diagHE, sumHE, planHE });

  const handleSaveDraft = async () => {
    setSaving(true);
    const supabase = createClient();
    // Save Hebrew to Supabase (primary)
    await updateLetterHebrew(supabase, id, { diagHE, sumHE, planHE });
    // localStorage fallback
    updateLetterData(id, { diagHE, sumHE, planStepsHE: planHE });
    setSaving(false);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2500);
  };

  const handleFinishReview = async () => {
    setFinishing(true);
    const supabase = createClient();
    // Save Hebrew + update status in Supabase
    await updateLetterHebrew(supabase, id, { diagHE, sumHE, planHE });
    await updateLetterStatus(supabase, id, "Reviewed", {
      reviewedAt: new Date().toISOString(),
    });
    // localStorage fallback
    updateLetterData(id, collect());
    updateStatus(id, "Reviewed");
    // Set up preview using Supabase data (re-fetch to get latest)
    const updated = await getLetterById(supabase, id);
    if (updated) {
      const d = {
        name: updated.patients?.full_name || patName,
        patId: updated.patients?.patient_id_number || patId,
        bDay: updated.patients?.birthdate_day || "",
        bMonth: updated.patients?.birthdate_month || "",
        bYear: updated.patients?.birthdate_year || "",
        gender: updated.patients?.gender || gender,
        email: updated.patients?.email || "",
        phone: updated.patients?.phone || "",
        smoking: updated.patients?.smoking_vaping || "",
        pets: updated.patients?.pets || "",
        occupation: updated.patients?.occupation || "",
        referredBy: updated.patients?.referred_by || "",
        location: updated.patients?.location || "",
        dateDay: (updated.letter_date || "").split("/")[0] || "",
        dateMonth: (updated.letter_date || "").split("/")[1] || "",
        dateYear: (updated.letter_date || "").split("/")[2] || "",
        diagEN: updated.diagnosis_english || "",
        diagHE: updated.diagnosis_hebrew  || "",
        sumEN:  updated.summary_english   || "",
        sumHE:  updated.summary_hebrew    || "",
        planStepsEN: updated.plan_english || [],
        planStepsHE: updated.plan_hebrew  || [],
        medHistory:  updated.medical_history || "",
        famHistory:  updated.family_history  || "",
        medications: updated.medications  || [],
        allergies:   updated.allergies    || [],
        vaccinations: updated.vaccinations || [],
        ...(updated.examination as object || {}),
        testResults: updated.test_results || {},
        lungRows:    updated.lung_function_tests || [],
        pictures:    updated.pictures || [],
        inhalerName:     (updated.inhaler as Record<string, string>)?.name      || "",
        inhalerLink:     (updated.inhaler as Record<string, string>)?.link      || "",
        inhalerImageUrl: (updated.inhaler as Record<string, string>)?.image_url || "",
      };
      localStorage.setItem("letter_preview",           JSON.stringify(d));
      localStorage.setItem("letter_current_supabase_id", id);
    }
    setFinishing(false);
    router.push("/workspace/review");
  };

  const setStep    = (i: number, val: string) => setPlanHE((p) => p.map((s, idx) => idx === i ? val : s));
  const addStep    = () => setPlanHE((p) => [...p, ""]);
  const removeStep = (i: number) => setPlanHE((p) => p.length > 1 ? p.filter((_, idx) => idx !== i) : p);

  // ─── Not found / loading ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-sm" style={{ color: "#94A3B8" }}>Loading…</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-base font-semibold mb-3" style={{ color: "#1A2B4A" }}>Letter not found</p>
          <Link href="/workspace/anat-review" className="text-sm font-medium" style={{ color: "#7C3AED" }}>
            ← Back to Anat Review
          </Link>
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 bg-white flex-shrink-0"
        style={{ borderBottom: "1px solid #E2E8F0" }}>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => window.history.length > 1 ? router.back() : router.push("/workspace/anat-review")}
            className="inline-flex items-center gap-1.5 text-sm font-medium flex-shrink-0"
            style={{ color: "#94A3B8", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2}
              strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M10 12L6 8l4-4"/>
            </svg>
            Back
          </button>
          <span style={{ color: "#E2E8F0" }}>›</span>
          <h1 className="text-sm font-bold truncate" style={{ color: "#1A2B4A" }}>{patName}</h1>
        </div>
        <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
          {savedMsg && <span className="text-xs font-semibold" style={{ color: "#0D9488" }}>Draft saved ✓</span>}
          <button onClick={handleSaveDraft} disabled={saving}
            className="text-xs font-semibold px-4 py-2 rounded-xl border transition-all duration-150 hover:-translate-y-px"
            style={{ backgroundColor: "white", color: "#1A2B4A", borderColor: "#E2E8F0", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving…" : "Save Draft"}
          </button>
          <button onClick={handleFinishReview} disabled={finishing}
            className="text-xs font-semibold px-4 py-2 rounded-xl border transition-all duration-150 hover:-translate-y-px"
            style={{ backgroundColor: "#7C3AED", color: "#fff", borderColor: "#7C3AED", opacity: finishing ? 0.7 : 1 }}>
            {finishing ? "Finishing…" : "Finish Review"}
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pt-5 pb-36 lg:pb-8"
        style={{ backgroundColor: "#F4F6F9" }}>

        {/* Patient info card */}
        <div className="bg-white rounded-2xl border p-4 sm:p-5 mb-5"
          style={{ borderColor: "#E2E8F0", boxShadow: "0 1px 3px 0 rgb(0 0 0/0.05)" }}>
          <p className="text-base sm:text-lg font-bold mb-3" style={{ color: "#1A2B4A" }}>{patName}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2.5">
            {patId && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "#94A3B8" }}>ID</p>
                <p className="text-sm font-medium" style={{ color: "#1A2B4A" }}>{patId}</p>
              </div>
            )}
            {gender && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "#94A3B8" }}>Gender</p>
                <p className="text-sm font-medium" style={{ color: "#1A2B4A" }}>{gender}</p>
              </div>
            )}
            {letterDate && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "#94A3B8" }}>Date</p>
                <p className="text-sm font-medium" style={{ color: "#1A2B4A" }}>{letterDate}</p>
              </div>
            )}
          </div>
          {gender && (
            <div className="mt-3 px-3 py-2 rounded-xl flex items-center gap-2"
              style={{ backgroundColor: "#EDE9FE", border: "1px solid #DDD6FE" }}>
              <svg viewBox="0 0 16 16" fill="none" stroke="#7C3AED" strokeWidth={1.75}
                strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 flex-shrink-0">
                <circle cx="8" cy="8" r="7"/><path d="M8 5v4M8 11h.01"/>
              </svg>
              <p className="text-xs" style={{ color: "#7C3AED" }}>
                Patient is <strong>{gender}</strong> — use correct Hebrew grammatical forms
              </p>
            </div>
          )}
        </div>

        <p className="text-xs font-bold uppercase tracking-widest mb-4"
          style={{ color: "#7C3AED", letterSpacing: "0.12em" }}>
          Edit Hebrew Translation
        </p>

        {/* Hebrew Diagnosis */}
        <EditSection title="Diagnosis" titleHe="אבחנה"
          refContent={diagEN
            ? <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#475569" }}>{diagEN}</p>
            : <p className="text-sm italic" style={{ color: "#CBD5E1" }}>No English diagnosis entered.</p>}>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#64748B" }}>
            Hebrew Diagnosis / אבחנה
          </label>
          <textarea dir="rtl" rows={5} value={diagHE} onChange={(e) => setDiagHE(e.target.value)}
            placeholder="הכנס אבחנה בעברית"
            className="w-full px-4 py-3 rounded-xl border bg-white focus:outline-none resize-none transition-colors duration-150"
            style={{ borderColor: "#E2E8F0", color: "#1A2B4A", direction: "rtl", textAlign: "right",
              fontSize: 16, lineHeight: 1.7 }} />
        </EditSection>

        {/* Hebrew Summary */}
        <EditSection title="Summary" titleHe="סיכום"
          refContent={sumEN
            ? <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#475569" }}>{sumEN}</p>
            : <p className="text-sm italic" style={{ color: "#CBD5E1" }}>No English summary entered.</p>}>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#64748B" }}>
            Hebrew Summary / סיכום
          </label>
          <textarea dir="rtl" rows={7} value={sumHE} onChange={(e) => setSumHE(e.target.value)}
            placeholder="הכנס סיכום בעברית"
            className="w-full px-4 py-3 rounded-xl border bg-white focus:outline-none resize-none transition-colors duration-150"
            style={{ borderColor: "#E2E8F0", color: "#1A2B4A", direction: "rtl", textAlign: "right",
              fontSize: 16, lineHeight: 1.7 }} />
        </EditSection>

        {/* Hebrew Plan */}
        <EditSection title="Plan" titleHe="תכנית"
          refContent={planEN.length > 0
            ? <ol className="list-decimal pl-5 space-y-1.5">
                {planEN.map((step, i) => (
                  <li key={i} className="text-sm leading-relaxed" style={{ color: "#475569" }}>{step}</li>
                ))}
              </ol>
            : <p className="text-sm italic" style={{ color: "#CBD5E1" }}>No English plan steps entered.</p>}>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#64748B" }}>
            Hebrew Plan Steps / תכנית
          </label>
          <div className="flex flex-col gap-3">
            {planHE.map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mt-1"
                  style={{ backgroundColor: "#EDE9FE", color: "#7C3AED" }}>
                  {i + 1}
                </span>
                <textarea dir="rtl" rows={4} value={step} onChange={(e) => setStep(i, e.target.value)}
                  placeholder={`שלב ${i + 1}`}
                  className="flex-1 px-4 py-3 rounded-xl border bg-white focus:outline-none resize-none transition-colors duration-150"
                  style={{ borderColor: "#E2E8F0", color: "#1A2B4A", direction: "rtl", textAlign: "right",
                    fontSize: 16, lineHeight: 1.7 }} />
                {planHE.length > 1 && (
                  <button type="button" onClick={() => removeStep(i)}
                    className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center mt-1 transition-colors duration-150"
                    style={{ backgroundColor: "#FFF1F2", color: "#BE123C" }}
                    aria-label={`Remove step ${i + 1}`}>
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2}
                      strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10"/>
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={addStep}
            className="mt-4 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 sm:py-2 rounded-xl border text-sm font-semibold transition-all duration-150"
            style={{ color: "#7C3AED", borderColor: "#DDD6FE", backgroundColor: "#EDE9FE" }}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2}
              strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <circle cx="8" cy="8" r="7"/><path d="M8 5v6M5 8h6"/>
            </svg>
            Add Hebrew Step
          </button>
        </EditSection>

        <div className="rounded-2xl px-4 py-3 mb-4"
          style={{ backgroundColor: "#EDE9FE", border: "1px solid #DDD6FE" }}>
          <p className="text-sm" style={{ color: "#7C3AED" }}>
            Only the Hebrew sections above can be edited. English text is shown for reference only.
          </p>
        </div>
      </div>

      {/* Sticky bottom bar — mobile only */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white px-4 pt-3"
        style={{ borderTop: "1px solid #E2E8F0", boxShadow: "0 -4px 24px rgb(0 0 0/0.08)",
          paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}>
        {savedMsg && (
          <p className="text-sm font-semibold text-center mb-2.5" style={{ color: "#0D9488" }}>
            Draft saved ✓
          </p>
        )}
        <div className="flex gap-3">
          <button onClick={handleSaveDraft} disabled={saving}
            className="flex-1 py-3.5 rounded-xl text-sm font-semibold border transition-all duration-150 active:scale-95"
            style={{ backgroundColor: "white", color: "#1A2B4A", borderColor: "#E2E8F0",
              opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving…" : "Save Draft"}
          </button>
          <button onClick={handleFinishReview} disabled={finishing}
            className="flex-[2] py-3.5 rounded-xl text-sm font-semibold border transition-all duration-150 active:scale-95"
            style={{ backgroundColor: "#7C3AED", color: "#fff", borderColor: "#7C3AED",
              opacity: finishing ? 0.7 : 1 }}>
            {finishing ? "Finishing…" : "Finish Review"}
          </button>
        </div>
      </div>
    </div>
  );
}
