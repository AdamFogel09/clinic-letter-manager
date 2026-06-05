"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import LetterHeader from "@/components/letter/LetterHeader";
import LetterFooter from "@/components/letter/LetterFooter";
import { upsertLetter } from "@/lib/letterStore";
import { createClient } from "@/lib/supabase/client";
import { saveLetter as saveLetterToSupabase, updateLetterFileUrls } from "@/lib/supabase/letters";
import { exportLetterPdfBlob } from "@/lib/generatePdf";
import { triggerDownload } from "@/lib/generateDocx";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LungRow {
  id: number;
  date: string; fev1l: string; fev1p: string; fvcl: string; fvcp: string;
  ratio: string; fef: string; tlcl: string; tlc: string; rvl: string; rv: string;
  dlco: string; kco: string; feno: string; meta: string; walk: string; hwbmi: string;
}

interface LetterData {
  name: string; patId: string;
  bDay: string; bMonth: string; bYear: string; gender: string;
  email: string; phone: string;
  smoking: string; pets: string; occupation: string;
  referredBy: string; location: string;
  dateDay: string; dateMonth: string; dateYear: string;
  diagEN: string; diagHE: string;
  sumEN: string; sumHE: string;
  medHistory: string; famHistory: string;
  medications: string[]; allergies: string[]; vaccinations: string[];
  appearance: string; clubbing: string; lymph: string;
  bp: string; pulse: string; rr: string; spo2: string;
  heartSounds: string; heartOther: string;
  lungAusc: string; lungOther: string; otherFindings: string;
  testResults: {
    ekg:          { value: string; details: string };
    echo:         string;
    blood:        { date: string; testType: string; details: string };
    bronchWash:   { microbiology: string; cytology: string; cellCounts: string };
    bronchBiopsy: { pathology: string; microbiology: string };
    ebus:         { cytology: string };
    pleuralFluid: { cytology: string; microbiology: string; biochemistry: string; cellCounts: string };
    pleuralBiopsy:{ pathology: string; microbiology: string };
    otherTest:    string;
    selected?:    Record<string, boolean | string[]>;
  };
  planStepsEN: string[]; planStepsHE: string[];
  lungRows: LungRow[];
  pictures: string[];
  inhalerName: string;
  inhalerLink: string;
  inhalerImageUrl: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDisplayDate(d: string): string {
  const [dd, mm, yyyy] = (d || "").split("/");
  if (!dd || !mm || !yyyy) return d || "";
  return `${dd} / ${mm} / ${yyyy}`;
}

function hasTestData(val: unknown): boolean {
  if (typeof val === "string") return (val as string).trim().length > 0;
  if (val && typeof val === "object") return Object.values(val as Record<string, unknown>).some(v => hasTestData(v));
  return false;
}

function TRGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 5px" }}>{label}</p>
      <div>{children}</div>
    </div>
  );
}

function TRField({ label, value }: { label: string; value: string }) {
  if (!value?.trim()) return null;
  return (
    <div style={{ marginBottom: 5 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}: </span>
      <span style={{ fontSize: 13, color: "#1A2B4A", lineHeight: 1.6 }}>{value}</span>
    </div>
  );
}

function formatPhone(p: string): string {
  const clean = (p || "").replace(/\D/g, "");
  if (clean.length === 10) return clean.slice(0, 3) + "-" + clean.slice(3);
  return p;
}

function calcAge(d: string, m: string, y: string): string {
  const day = parseInt(d), mon = parseInt(m), yr = parseInt(y);
  if (!day || !mon || !yr || yr < 1900 || yr > new Date().getFullYear()) return "";
  const birth = new Date(yr, mon - 1, day);
  if (isNaN(birth.getTime()) || birth.getMonth() !== mon - 1) return "";
  const now = new Date();
  let yrs = now.getFullYear() - birth.getFullYear();
  let mos = now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) mos--;
  if (mos < 0) { yrs--; mos += 12; }
  if (yrs < 0) return "";
  if (yrs === 0) return `${mos} month${mos !== 1 ? "s" : ""}`;
  return `${yrs} year${yrs !== 1 ? "s" : ""}, ${mos} month${mos !== 1 ? "s" : ""}`;
}

// ─── Document section components ─────────────────────────────────────────────

function DocSection({ title, titleHe, heOnly, children }: {
  title: string; titleHe?: string; heOnly?: boolean; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16, breakInside: "avoid", pageBreakInside: "avoid" }}>
      <div style={{
        display: "flex",
        direction: heOnly ? "rtl" : "ltr",
        justifyContent: heOnly ? "flex-start" : (titleHe ? "space-between" : "flex-start"),
        alignItems: "baseline",
        borderBottom: "1px solid #160B5C",
        paddingBottom: 5,
        marginBottom: 10,
      }}>
        <h3 style={{
          fontSize: 15, fontWeight: 700, color: "#1A2B4A", margin: 0,
          textTransform: heOnly ? "none" : "uppercase",
          letterSpacing: heOnly ? "0.03em" : "0.10em",
        }}>
          {title}
        </h3>
        {titleHe && !heOnly && (
          <span style={{ fontSize: 15, fontWeight: 700, color: "#1A2B4A", letterSpacing: "0.04em" }}>
            {titleHe}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function LV({ label, value, boldValue }: { label: string; value: string; boldValue?: boolean }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
      <span style={{ fontSize: 13, color: "#000000", fontWeight: 700, minWidth: 120, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: "#1A2B4A", fontWeight: boldValue ? 700 : 400 }}>{value}</span>
    </div>
  );
}

function TextBlock({ text, rtl }: { text: string; rtl?: boolean }) {
  if (!text?.trim()) return null;
  return (
    <p style={{
      fontSize: 13, color: "#1A2B4A", lineHeight: 1.7, margin: 0,
      direction: rtl ? "rtl" : "ltr", textAlign: rtl ? "right" : "left",
      whiteSpace: "pre-wrap",
    }}>
      {text}
    </p>
  );
}

function InhalerIconSmall() {
  return (
    <svg viewBox="0 0 40 56" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 30, height: 42 }}>
      <rect x="8" y="2" width="24" height="34" rx="6" fill="#CBD5E1" />
      <rect x="4" y="32" width="32" height="11" rx="5.5" fill="#94A3B8" />
      <rect x="15" y="43" width="10" height="9" rx="3" fill="#64748B" />
      <rect x="11" y="10" width="18" height="14" rx="3" fill="white" opacity="0.35" />
      <circle cx="20" cy="17" r="3" fill="white" opacity="0.45" />
    </svg>
  );
}


// ─── A4 Page wrapper ──────────────────────────────────────────────────────────

function A4Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="a4-page" style={{
      width: "100%",
      maxWidth: 820,
      minHeight: 1123,
      backgroundColor: "white",
      fontFamily: "'Avenir Next', Avenir, 'Helvetica Neue', Arial, sans-serif",
      boxShadow: "0 4px 6px -1px rgb(0 0 0/0.07), 0 20px 40px rgb(26 43 74/0.10)",
      display: "flex",
      flexDirection: "column",
    }}>
      <LetterHeader />
      <div style={{ flex: "1 1 auto", padding: "28px 40px 24px" }}>
        {children}
      </div>
      <LetterFooter />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LetterPreviewPage() {
  const router = useRouter();
  const [data, setData] = useState<LetterData | null>(null);
  const [sent, setSent] = useState(false);
  const [returnTo, setReturnTo] = useState<"review" | "editor" | "all-letters">("editor");
  const [exportMode, setExportMode] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState("");
  const [exportDone, setExportDone] = useState(false);
  const [pdfUploadStatus, setPdfUploadStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [pdfUploadError, setPdfUploadError] = useState("");

  useEffect(() => {
    const rt = localStorage.getItem("letter_return_to");
    if (rt === "review") setReturnTo("review");
    else if (rt === "all-letters") setReturnTo("all-letters");
    const em = localStorage.getItem("letter_export_mode");
    if (em === "1") {
      setExportMode(true);
      localStorage.removeItem("letter_export_mode"); // consume the flag
    }
  }, []);

  const handleExportPdf = async () => {
    if (exporting) return;
    setExporting(true);
    setExportDone(false);
    setPdfUploadStatus("idle");
    setPdfUploadError("");
    try {
      const d = data as unknown as Record<string, unknown>;
      const patientName = (d?.name     as string) || "";
      const patientId   = (d?.patId    as string) || "";
      const location    = (d?.location as string) || "";
      const date = [(d?.dateDay as string), (d?.dateMonth as string), (d?.dateYear as string)]
        .filter(Boolean).join("/");

      // Generate PDF blob — same rendering as before, but returns bytes for upload
      const { blob, filename } = await exportLetterPdfBlob(
        patientName, date, setExportProgress, patientId, location
      );

      setExportProgress("Saving PDF…");
      triggerDownload(blob, filename);
      setExportDone(true);
      setExportProgress("");

      // Upload to Supabase Storage (clinic-letters bucket)
      // Bucket must be created in Supabase dashboard: Storage → New Bucket → "clinic-letters" (private)
      const letterId = localStorage.getItem("letter_current_supabase_id");
      if (letterId) {
        setPdfUploadStatus("uploading");
        try {
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error("Not authenticated");

          const safePatId = (patientId || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_");
          const storagePath = `${user.id}/${safePatId}/${letterId}/${filename}`;

          const { error: uploadErr } = await supabase.storage
            .from("clinic-letters")
            .upload(storagePath, blob, { contentType: "application/pdf", upsert: true });

          if (uploadErr) throw new Error(uploadErr.message);

          await updateLetterFileUrls(supabase, letterId, { finalPdfUrl: storagePath });
          setPdfUploadStatus("done");
        } catch (uploadErr) {
          console.warn("[preview] PDF upload error:", uploadErr);
          setPdfUploadStatus("error");
          setPdfUploadError(uploadErr instanceof Error ? uploadErr.message : "Upload failed");
        }
      }
    } catch (err) {
      setExportProgress(`Export failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setExporting(false);
    }
  };

  const handleSendToAnat = async () => {
    if (sent) return;
    const raw = localStorage.getItem("letter_preview");
    const letterData = raw ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : null;

    const d = (letterData ?? data) as Record<string, unknown>;
    const patientName = (d?.name as string) || "Unnamed Patient";
    const date = [(d?.dateDay as string), (d?.dateMonth as string), (d?.dateYear as string)].filter(Boolean).join("/");

    // Save to Supabase (primary source of truth)
    try {
      const supabase = createClient();
      const supabaseLetterId = localStorage.getItem("letter_current_supabase_id") || undefined;
      const saved = await saveLetterToSupabase(supabase, {
        letterId:     supabaseLetterId,
        status:       "Waiting for Anat",
        letterDate:   date,
        letterData:   d,
        sentToAnatAt: new Date().toISOString(),
      });
      localStorage.setItem("letter_current_supabase_id", saved.id);
      // Letter is now in Supabase — clear the local copy of full letter data.
      localStorage.removeItem("letter_preview");
    } catch (err) {
      console.error("[preview] Supabase save error:", err);
    }

    // localStorage fallback
    let letterId = localStorage.getItem("letter_current_id");
    if (!letterId) {
      letterId = `letter-${Date.now().toString(36)}`;
      localStorage.setItem("letter_current_id", letterId);
    }
    upsertLetter({
      id: letterId,
      patientName,
      patientId: (d?.patId as string) || "",
      letterDate: date,
      status: "Waiting for Anat",
      savedAt: new Date().toISOString(),
      data: d,
    });

    setSent(true);

    // Later this action will send an email notification to Anat with a secure link.
    localStorage.setItem("letter_just_sent", "1");
    setTimeout(() => router.push("/workspace/anat-review"), 800);
  };

  useEffect(() => {
    const raw = localStorage.getItem("letter_preview");
    if (raw) {
      try { setData(JSON.parse(raw)); } catch { /* malformed — ignore */ }
    }
  }, []);

  const d = data;
  const age = d ? calcAge(d.bDay, d.bMonth, d.bYear) : "";
  const dob = d ? [d.bDay, d.bMonth, d.bYear].filter(Boolean).join(" / ") : "";
  const letterDate = d ? [d.dateDay, d.dateMonth, d.dateYear].filter(Boolean).join(" / ") : "";

  const examRows = d ? ([
    ["Appearance", d.appearance],
    ["Fingernail Clubbing", d.clubbing],
    ["Cervical Lymphadenopathy", d.lymph],
    ["Blood Pressure", d.bp],
    ["Pulse", d.pulse ? `${d.pulse} bpm` : ""],
    ["Respiratory Rate", d.rr ? `${d.rr} breaths/min` : ""],
    ["SpO2", d.spo2 ? `${d.spo2}%` : ""],
    ["Heart Sounds", d.heartSounds === "Other" ? `Other — ${d.heartOther}` : d.heartSounds],
    ["Lung Auscultation", d.lungAusc === "Other" ? `Other — ${d.lungOther}` : d.lungAusc],
    ["Other Findings", d.otherFindings],
  ] as [string, string][]).filter(([, v]) => !!v) : [];

  // Page 1: patient details + Hebrew patient-facing content
  const hasPage1 = !!(d && (d.name || d.patId || d.diagHE || d.sumHE || d.planStepsHE?.some(s => s.trim())));
  // Page 2: English clinical sections + medical/exam content
  const hasPage2 = !!(d && (
    d.diagEN || d.sumEN || d.planStepsEN?.some(s => s.trim()) ||
    d.medHistory || d.famHistory ||
    (d.medications?.length > 0) || (d.allergies?.length > 0) ||
    (d.vaccinations?.length > 0) || examRows.length > 0
  ));
  // Page 3: objective data + inhalers
  const hasPage3 = !!(d && (
    hasTestData(d.testResults) ||
    (d.lungRows?.length > 0) || d.inhalerName
  ));
  const hasPictures = !!(d && d.pictures?.length > 0);

  return (
    <>
      <style>{`
        @media print {
          body { margin: 0 !important; background: white !important; }
          .preview-toolbar { display: none !important; }
          .preview-wrapper {
            padding: 0 !important;
            gap: 0 !important;
            background: white !important;
          }
          .a4-page {
            box-shadow: none !important;
            break-after: page;
            page-break-after: always;
            min-height: 100vh;
          }
          .a4-page:last-child {
            break-after: auto;
            page-break-after: auto;
          }
        }
      `}</style>

      <div className="preview-wrapper" style={{
        backgroundColor: "#F4F6F9",
        minHeight: "100vh",
        padding: "32px 16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 32,
      }}>

        {/* Toolbar */}
        <div className="preview-toolbar" style={{
          width: "100%", maxWidth: 820,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          {/* Back button */}
          <button
            onClick={() => {
              localStorage.removeItem("letter_export_mode");
              if (window.history.length > 1) router.back();
              else router.push("/workspace/letter-editor");
            }}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, color: "#64748B", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
              <path d="M10 12L6 8l4-4"/>
            </svg>
            Back
          </button>

          {/* Toolbar actions */}
          {exportMode ? (
            /* ── Export Final PDF mode ── */
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {exportDone && pdfUploadStatus === "idle" && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#0D9488", display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
                      <path d="M3 8l4 4 6-7"/>
                    </svg>
                    PDF downloaded
                  </span>
                )}
                {exporting && exportProgress && (
                  <span style={{ fontSize: 11, color: "#94A3B8" }}>{exportProgress}</span>
                )}
                <button
                  onClick={handleExportPdf}
                  disabled={exporting}
                  style={{
                    fontSize: 12, fontWeight: 600, borderRadius: 10, padding: "8px 20px",
                    backgroundColor: exporting ? "#F4F6F9" : "#0D9488",
                    color: exporting ? "#94A3B8" : "#fff",
                    border: exporting ? "1px solid #E2E8F0" : "1px solid #0D9488",
                    cursor: exporting ? "default" : "pointer",
                    transition: "all 0.15s",
                  }}>
                  {exporting ? "Generating PDF…" : exportDone ? "Download Again" : "Download Final PDF"}
                </button>
              </div>
              {/* Upload status feedback */}
              {pdfUploadStatus === "uploading" && (
                <span style={{ fontSize: 11, color: "#94A3B8" }}>Uploading PDF to secure storage…</span>
              )}
              {pdfUploadStatus === "done" && (
                <span style={{ fontSize: 11, fontWeight: 600, color: "#0D9488", display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ width: 11, height: 11 }}>
                    <path d="M3 8l4 4 6-7"/>
                  </svg>
                  PDF saved to storage
                </span>
              )}
              {pdfUploadStatus === "error" && (
                <span style={{ fontSize: 11, color: "#BE123C" }}>
                  Could not save to storage: {pdfUploadError}
                </span>
              )}
            </div>
          ) : (
            /* ── Normal preview mode ── */
            <div style={{ display: "flex", gap: 8 }}>
              {returnTo !== "review" && (
                <button
                  onClick={handleSendToAnat}
                  disabled={sent}
                  style={{
                    fontSize: 12, fontWeight: 600, borderRadius: 10, padding: "8px 20px", cursor: sent ? "default" : "pointer",
                    backgroundColor: sent ? "#EDE9FE" : "#1A2B4A",
                    color: sent ? "#7C3AED" : "#ffffff",
                    border: sent ? "1px solid #EDE9FE" : "1px solid #1A2B4A",
                    transition: "all 0.15s",
                  }}>
                  {sent ? "Sent to Anat ✓" : "Send to Anat"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Page 1: Patient Details · Hebrew Diagnosis · Hebrew Summary · Hebrew Plan ── */}
        {hasPage1 && (
          <A4Page>
            {d && (d.name || d.patId) && (
              <div style={{ marginBottom: 16, breakInside: "avoid", pageBreakInside: "avoid" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/lungistitute.png" alt="מרפאת ריאות" style={{ maxHeight: 52, objectFit: "contain", marginBottom: 0, display: "block", marginLeft: "auto", marginRight: "auto" }} />
                <div style={{ borderBottom: "1px solid #160B5C", marginBottom: 10 }} />
                <div style={{ display: "flex", gap: 32 }}>
                  <div style={{ flex: 1 }}>
                    <LV label="Name"          value={d.name} />
                    <LV label="ID"            value={d.patId} />
                    <LV label="Date of Birth" value={dob} />
                    <LV label="Age / Gender"  value={[age, d.gender].filter(Boolean).join("  ·  ")} />
                    <LV label="Email"         value={d.email} />
                    <LV label="Phone"         value={formatPhone(d.phone)} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <LV label="Smoking / Vaping" value={d.smoking} />
                    <LV label="Pets"             value={d.pets} />
                    <LV label="Occupation"       value={d.occupation} />
                    <LV label="Referred By"      value={d.referredBy} />
                    <LV label="Location"         value={d.location} />
                    <LV label="Date"             value={letterDate} boldValue />
                  </div>
                </div>
                <div style={{ borderTop: "1px solid #160B5C", marginTop: 10 }} />
              </div>
            )}

            {d?.diagHE && (
              <DocSection title="אבחנה" heOnly>
                <TextBlock text={d.diagHE} rtl />
              </DocSection>
            )}

            {d?.sumHE && (
              <DocSection title="סיכום" heOnly>
                <TextBlock text={d.sumHE} rtl />
              </DocSection>
            )}

            {d?.planStepsHE?.some(s => s.trim()) && (
              <DocSection title="תכנית" heOnly>
                <div style={{ direction: "rtl" }}>
                  {d.planStepsHE.filter(s => s.trim()).map((step, i) => (
                    <div key={i} style={{ display: "flex", gap: 6, marginBottom: 5, alignItems: "flex-start", textAlign: "right" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, flexShrink: 0, color: "#1A2B4A", lineHeight: 1.8 }}>{i + 1}.</span>
                      <span style={{ fontSize: 13, color: "#1A2B4A", lineHeight: 1.8, flex: 1 }}>{step}</span>
                    </div>
                  ))}
                </div>
              </DocSection>
            )}
          </A4Page>
        )}

        {/* ── Page 2: English Diagnosis · Summary · Medical History · Medications · Examination · Plan ── */}
        {hasPage2 && (
          <A4Page>
            {d?.diagEN && (
              <DocSection title="Diagnosis">
                <TextBlock text={d.diagEN} />
              </DocSection>
            )}

            {d?.sumEN && (
              <DocSection title="Summary">
                <TextBlock text={d.sumEN} />
              </DocSection>
            )}

            {d?.medHistory && (
              <DocSection title="Medical History">
                <TextBlock text={d.medHistory} />
              </DocSection>
            )}

            {d?.famHistory && (
              <DocSection title="Family History">
                <TextBlock text={d.famHistory} />
              </DocSection>
            )}

            {d && d.medications?.length > 0 && (
              <DocSection title="Medications">
                <div>
                  {d.medications.map((m, i) => (
                    <p key={i} style={{ fontSize: 13, color: "#1A2B4A", lineHeight: 1.8, margin: "0 0 2px" }}>• {m}</p>
                  ))}
                </div>
              </DocSection>
            )}

            {d && d.allergies?.length > 0 && (
              <DocSection title="Allergies">
                <div>
                  {d.allergies.map((a, i) => (
                    <p key={i} style={{ fontSize: 13, color: "#1A2B4A", lineHeight: 1.8, margin: "0 0 2px" }}>• {a}</p>
                  ))}
                </div>
              </DocSection>
            )}

            {d && d.vaccinations?.length > 0 && (
              <DocSection title="Vaccinations">
                <p style={{ fontSize: 13, color: "#1A2B4A", margin: 0 }}>{d.vaccinations.join(", ")}</p>
              </DocSection>
            )}

            {examRows.length > 0 && (
              <DocSection title="Examination">
                <div style={{ display: "grid", gridTemplateColumns: "max-content 1fr max-content 1fr", columnGap: 12, rowGap: 5 }}>
                  {examRows.map(([label, value]) => (
                    <div key={label} style={{ display: "contents" }}>
                      <span style={{ fontSize: 13, color: "#475569", fontWeight: 600 }}>{label}</span>
                      <span style={{ fontSize: 13, color: "#1A2B4A" }}>{value}</span>
                    </div>
                  ))}
                </div>
              </DocSection>
            )}

            {d?.planStepsEN?.some(s => s.trim()) && (
              <DocSection title="Plan">
                <div>
                  {d.planStepsEN.filter(s => s.trim()).map((step, i) => (
                    <div key={i} style={{ display: "flex", gap: 6, marginBottom: 5, alignItems: "flex-start" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, flexShrink: 0, minWidth: 18, color: "#1A2B4A", lineHeight: 1.8 }}>{i + 1}.</span>
                      <span style={{ fontSize: 13, color: "#1A2B4A", lineHeight: 1.8, flex: 1 }}>{step}</span>
                    </div>
                  ))}
                </div>
              </DocSection>
            )}
          </A4Page>
        )}

        {/* ── Page 3: Test Results · Lung Function · Inhalers ── */}
        {hasPage3 && (
          <A4Page>
            {d && hasTestData(d.testResults) && (
              <DocSection title="Test Results">
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

                  {/* EKG */}
                  {hasTestData(d.testResults.ekg) && (
                    <TRGroup label="EKG">
                      <p style={{ fontSize: 13, color: "#1A2B4A", margin: 0, lineHeight: 1.6 }}>
                        {d.testResults.ekg.value === "Other" ? d.testResults.ekg.details : d.testResults.ekg.value}
                      </p>
                    </TRGroup>
                  )}

                  {/* Echocardiogram */}
                  {d.testResults.echo?.trim() && (
                    <TRGroup label="Echocardiogram">
                      <p style={{ fontSize: 13, color: "#1A2B4A", margin: 0, lineHeight: 1.6 }}>{d.testResults.echo}</p>
                    </TRGroup>
                  )}

                  {/* Blood Tests */}
                  {hasTestData(d.testResults.blood) && (
                    <TRGroup label="Blood Tests">
                      {d.testResults.blood.date?.trim() && (
                        <p style={{ fontSize: 12, color: "#475569", margin: "0 0 3px", fontWeight: 600 }}>{formatDisplayDate(d.testResults.blood.date)}</p>
                      )}
                      <TRField label="Type" value={d.testResults.blood.testType} />
                      <TRField label="Results" value={d.testResults.blood.details} />
                    </TRGroup>
                  )}

                  {/* Bronchoscopy Washing */}
                  {hasTestData(d.testResults.bronchWash) && (
                    <TRGroup label="Bronchoscopy Washing">
                      <TRField label="Microbiology" value={d.testResults.bronchWash.microbiology} />
                      <TRField label="Cytology"     value={d.testResults.bronchWash.cytology} />
                      <TRField label="Cell Counts"  value={d.testResults.bronchWash.cellCounts} />
                    </TRGroup>
                  )}

                  {/* Bronchoscopy Biopsy */}
                  {hasTestData(d.testResults.bronchBiopsy) && (
                    <TRGroup label="Bronchoscopy Biopsy">
                      <TRField label="Pathology"    value={d.testResults.bronchBiopsy.pathology} />
                      <TRField label="Microbiology" value={d.testResults.bronchBiopsy.microbiology} />
                    </TRGroup>
                  )}

                  {/* EBUS */}
                  {hasTestData(d.testResults.ebus) && (
                    <TRGroup label="EBUS">
                      <TRField label="Cytology" value={d.testResults.ebus.cytology} />
                    </TRGroup>
                  )}

                  {/* Pleural Fluid */}
                  {hasTestData(d.testResults.pleuralFluid) && (
                    <TRGroup label="Pleural Fluid">
                      <TRField label="Cytology"     value={d.testResults.pleuralFluid.cytology} />
                      <TRField label="Microbiology" value={d.testResults.pleuralFluid.microbiology} />
                      <TRField label="Biochemistry" value={d.testResults.pleuralFluid.biochemistry} />
                      <TRField label="Cell Counts"  value={d.testResults.pleuralFluid.cellCounts} />
                    </TRGroup>
                  )}

                  {/* Pleural Biopsy */}
                  {hasTestData(d.testResults.pleuralBiopsy) && (
                    <TRGroup label="Pleural Biopsy">
                      <TRField label="Pathology"    value={d.testResults.pleuralBiopsy.pathology} />
                      <TRField label="Microbiology" value={d.testResults.pleuralBiopsy.microbiology} />
                    </TRGroup>
                  )}

                  {/* Other Test */}
                  {d.testResults.otherTest?.trim() && (
                    <TRGroup label="Other Test">
                      <p style={{ fontSize: 13, color: "#1A2B4A", margin: 0, lineHeight: 1.6 }}>{d.testResults.otherTest}</p>
                    </TRGroup>
                  )}

                </div>
              </DocSection>
            )}

            {d && d.lungRows?.length > 0 && (
              <DocSection title="Lung Function" titleHe="תפקוד ריאות">
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {d.lungRows.map(row => {
                    const mainFields:  [string, string][] = [["FEV1 L", row.fev1l], ["FEV1 %", row.fev1p], ["FVC L", row.fvcl], ["FVC %", row.fvcp], ["FEV1/FVC %", row.ratio], ["FEF 25-75 %", row.fef]];
                    const extraFields: [string, string][] = [["TLC L", row.tlcl], ["TLC %", row.tlc], ["RV L", row.rvl], ["RV %", row.rv], ["DLCO %", row.dlco], ["KCO %", row.kco], ["FeNO", row.feno], ["Metacholine", row.meta], ["6 Min Walk", row.walk], ["Ht/Wt/BMI", row.hwbmi]];
                    const hasMain  = mainFields.some(([, v]) => v?.trim());
                    const hasExtra = extraFields.some(([, v]) => v?.trim());
                    return (
                      <div key={row.id} style={{ border: "1.5px solid #160B5C", borderRadius: 10, overflow: "hidden" }}>
                        {/* Date header */}
                        {row.date && (
                          <div style={{ backgroundColor: "#F2A56B", padding: "5px 12px" }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#000000" }}>Date: {formatDisplayDate(row.date)}</span>
                          </div>
                        )}

                        <div style={{ padding: "5px 8px" }}>
                          {(hasMain || hasExtra) && (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: "4px 6px" }}>
                              {[...mainFields, ...extraFields].map(([label, val]) => (
                                <div key={label} style={{ textAlign: "center" }}>
                                  <div style={{ fontSize: 6.5, color: "#475569", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.02em" }}>{label}</div>
                                  <div style={{ fontSize: 13, color: "#1A2B4A", fontWeight: 600 }}>{val?.trim() || "—"}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </DocSection>
            )}

            {d?.inhalerName && (
              <DocSection title="" titleHe="סרטון המסביר איך להשתמש במשאף שלך">
                <div style={{ display: "flex", gap: 16, alignItems: "center", padding: "10px 14px", border: "1px solid #E2E8F0", borderRadius: 12, backgroundColor: "#FAFBFF" }}>
                  <div style={{
                    width: 72, height: 72, borderRadius: 10,
                    backgroundColor: "#EBF3FB", border: "1px solid #E2E8F0",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    overflow: "hidden",
                  }}>
                    {d.inhalerImageUrl
                      /* eslint-disable-next-line @next/next/no-img-element */
                      ? <img src={d.inhalerImageUrl} alt={d.inhalerName} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                      : <InhalerIconSmall />
                    }
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#1A2B4A", margin: "0 0 4px" }}>{d.inhalerName}</p>
                    {d.inhalerLink && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <svg viewBox="0 0 16 16" fill="none" stroke="#4A90D9" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12, flexShrink: 0 }}>
                          <path d="M7 3H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V9M9 1h6m0 0v6m0-6L7 9"/>
                        </svg>
                        <a href={d.inhalerLink} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 11, color: "#4A90D9", textDecoration: "none", fontWeight: 500 }}>
                          Watch video guide on RightBreathe
                        </a>
                        <span style={{ fontSize: 11, color: "#64748B", fontWeight: 400 }}>
                          (גלול עד למטה אחרי כניסה לקישור בכדי לצפות בסרטון ההדרכה)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </DocSection>
            )}
          </A4Page>
        )}

        {/* ── Page 4: Pictures ── */}
        {hasPictures && (
          <A4Page>
            <DocSection title="Pictures" titleHe="תמונות">
              <div style={{
                display: "grid",
                gridTemplateColumns: d!.pictures.length === 1 ? "1fr" : "1fr 1fr",
                gap: 16,
              }}>
                {d!.pictures.map((src, i) => (
                  <div key={i} style={{ overflow: "hidden", border: "2px solid #000000", backgroundColor: "#ffffff" }}>
                    <div style={{ padding: "4px 10px", borderBottom: "1px solid #000000" }}>
                      <p style={{ fontSize: 10, color: "#000000", margin: 0, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        Image {i + 1}
                      </p>
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={`Image ${i + 1}`}
                      style={{ width: "100%", display: "block", objectFit: "contain", maxHeight: 280, backgroundColor: "#ffffff" }}
                    />
                  </div>
                ))}
              </div>
            </DocSection>
          </A4Page>
        )}

        {/* ── Final Page: Important Notes + Signature ── */}
        <A4Page>
          {/* Stamp (left) + Important Notes box (right) — kept together, no page splits */}
          <div style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
            <div style={{ display: "flex", gap: 28, alignItems: "stretch" }}>

              {/* Stamp on the left — standalone, no border */}
              <div style={{
                flexShrink: 0, width: 210,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/stamp.png" alt="Official Stamp" style={{ width: 210, height: 210, objectFit: "contain", display: "block" }} />
              </div>

              {/* Important Notes on the right */}
              <div style={{ flex: 1 }}>
                {/* Line above heading */}
                <div style={{ borderTop: "1px solid #160B5C", marginBottom: 7 }} />
                {/* Heading */}
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 7 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "#160B5C", margin: 0, letterSpacing: "0.03em" }}>
                    נקודות חשובות
                  </h3>
                </div>
                {/* Line below heading */}
                <div style={{ borderTop: "1px solid #160B5C", marginBottom: 10 }} />

                {/* Notes list — RTL */}
                <div>
                  {[
                    "מכתב זה הוא מסמך סודי המיועד רק למטופל, או למטפל מועמד ואנשי מקצוע בתחום הבריאות המעורבים בטיפול הרפואי הישיר במטופל. אם מסמך זה התקבל בטעות, אנא החזר אותו מיד לכתובת: lungdrsumit@gmail.com .",
                    "יש להעביר מכתב זה לרופא המשפחה כדי לעיין בתוכנית הניהול והחקירה.",
                    "כל ביקור במרפאה (כולל ביקורות מעקב ולאחר בדיקות) נדרשות בתשלום.",
                  ].map((text, i) => {
                    const color = i === 2 ? "#DC2626" : "#160B5C";
                    return (
                      <div key={i} style={{ display: "flex", direction: "rtl", gap: 6, alignItems: "flex-start", marginBottom: 4 }}>
                        <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 700, lineHeight: 1.5, color }}>{i + 1}.</span>
                        <span style={{ flex: 1, fontSize: 13, lineHeight: 1.5, color, textAlign: "right" }}>{text}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Line below notes */}
                <div style={{ borderTop: "1px solid #160B5C", marginTop: 10 }} />
              </div>

            </div>
          </div>
        </A4Page>

      </div>
    </>
  );
}
