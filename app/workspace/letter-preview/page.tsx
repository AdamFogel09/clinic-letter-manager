"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { upsertLetter } from "@/lib/letterStore";
import { createClient } from "@/lib/supabase/client";
import { saveLetter as saveLetterToSupabase, updateLetterFileUrls, updateLetterFileSizes, getLetterById, cleanupOldLetterFiles } from "@/lib/supabase/letters";
import { triggerDownload, finalPdfFilename } from "@/lib/generateDocx";
import LetterPageRenderer, { type LetterData } from "@/components/letter/LetterPageRenderer";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mkId() { return `tr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,5)}`; }

function migratePreviewTestResults(raw: unknown): LetterData["testResults"] {
  const empty: LetterData["testResults"] = { ekg: [], echo: [], blood: [], bronchWash: [], bronchBiopsy: [], ebus: [], pleuralFluid: [], pleuralBiopsy: [], otherTests: [] };
  if (!raw || typeof raw !== "object") return empty;
  const r = raw as Record<string, unknown>;
  const sel = ((r.selected ?? {}) as Record<string, unknown>);
  const res = { ...empty };
  const arrSel = (k: string): string[] => Array.isArray(sel[k]) ? sel[k] as string[] : [];

  if (Array.isArray(r.ekg)) res.ekg = r.ekg as typeof res.ekg;
  else if (r.ekg && typeof r.ekg === "object") {
    const o = r.ekg as { value?: string; details?: string };
    if (o.value) res.ekg = [{ id: mkId(), date: "", result: o.value === "Other" ? (o.details || "") : o.value }];
  } else if (typeof r.ekg === "string" && (r.ekg as string).trim()) {
    res.ekg = [{ id: mkId(), date: "", result: r.ekg as string }];
  }

  if (Array.isArray(r.echo)) res.echo = r.echo as typeof res.echo;
  else if (typeof r.echo === "string" && (r.echo as string).trim()) {
    res.echo = [{ id: mkId(), date: "", result: r.echo as string }];
  }

  if (Array.isArray(r.blood)) res.blood = r.blood as typeof res.blood;
  else if (r.blood && typeof r.blood === "object") {
    const o = r.blood as { date?: string; testType?: string; details?: string };
    if (o.date || o.testType || o.details) res.blood = [{ id: mkId(), date: o.date || "", testType: o.testType || "", details: o.details || "" }];
  }

  if (Array.isArray(r.bronchWash)) res.bronchWash = r.bronchWash as typeof res.bronchWash;
  else if (r.bronchWash && typeof r.bronchWash === "object") {
    const o = r.bronchWash as Record<string, string>;
    if (o.microbiology || o.cytology || o.cellCounts)
      res.bronchWash = [{ id: mkId(), date: "", selected: arrSel("bronchWash"), microbiology: o.microbiology||"", cytology: o.cytology||"", cellCounts: o.cellCounts||"" }];
  }

  if (Array.isArray(r.bronchBiopsy)) res.bronchBiopsy = r.bronchBiopsy as typeof res.bronchBiopsy;
  else if (r.bronchBiopsy && typeof r.bronchBiopsy === "object") {
    const o = r.bronchBiopsy as Record<string, string>;
    if (o.pathology || o.microbiology)
      res.bronchBiopsy = [{ id: mkId(), date: "", selected: arrSel("bronchBiopsy"), pathology: o.pathology||"", microbiology: o.microbiology||"" }];
  }

  if (Array.isArray(r.ebus)) res.ebus = r.ebus as typeof res.ebus;
  else if (r.ebus && typeof r.ebus === "object") {
    const o = r.ebus as Record<string, string>;
    if (o.cytology)
      res.ebus = [{ id: mkId(), date: "", selected: arrSel("ebus"), cytology: o.cytology||"" }];
  }

  if (Array.isArray(r.pleuralFluid)) res.pleuralFluid = r.pleuralFluid as typeof res.pleuralFluid;
  else if (r.pleuralFluid && typeof r.pleuralFluid === "object") {
    const o = r.pleuralFluid as Record<string, string>;
    if (o.cytology || o.microbiology || o.biochemistry || o.cellCounts)
      res.pleuralFluid = [{ id: mkId(), date: "", selected: arrSel("pleuralFluid"), cytology: o.cytology||"", microbiology: o.microbiology||"", biochemistry: o.biochemistry||"", cellCounts: o.cellCounts||"" }];
  }

  if (Array.isArray(r.pleuralBiopsy)) res.pleuralBiopsy = r.pleuralBiopsy as typeof res.pleuralBiopsy;
  else if (r.pleuralBiopsy && typeof r.pleuralBiopsy === "object") {
    const o = r.pleuralBiopsy as Record<string, string>;
    if (o.pathology || o.microbiology)
      res.pleuralBiopsy = [{ id: mkId(), date: "", selected: arrSel("pleuralBiopsy"), pathology: o.pathology||"", microbiology: o.microbiology||"" }];
  }

  if (Array.isArray(r.otherTests)) res.otherTests = r.otherTests as typeof res.otherTests;
  else if (typeof r.otherTest === "string" && (r.otherTest as string).trim()) {
    res.otherTests = [{ id: mkId(), date: "", testName: "", result: r.otherTest as string }];
  }

  return res;
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
  const [exportError, setExportError] = useState("");
  const [exportDone, setExportDone] = useState(false);
  const [pdfUploadStatus, setPdfUploadStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [pdfUploadError, setPdfUploadError] = useState("");
  const [letterStatus, setLetterStatus] = useState("");
  const [editWarning, setEditWarning] = useState(false);

  useEffect(() => {
    const rt = localStorage.getItem("letter_return_to");
    if (rt === "review") setReturnTo("review");
    else if (rt === "all-letters") setReturnTo("all-letters");
    const em = localStorage.getItem("letter_export_mode");
    if (em === "1") {
      setExportMode(true);
      localStorage.removeItem("letter_export_mode");
    }
    const ls = localStorage.getItem("letter_status");
    if (ls) setLetterStatus(ls);
  }, []);

  const handleEditLetter = () => {
    if (letterStatus === "Sent to Patient") { setEditWarning(true); return; }
    navigateToEditor();
  };

  const navigateToEditor = () => {
    const supabaseId = localStorage.getItem("letter_current_supabase_id");
    if (supabaseId) {
      sessionStorage.setItem("load_from_supabase", "1");
      sessionStorage.setItem("letter_supabase_id", supabaseId);
      if (letterStatus === "Ready for Patient" || letterStatus === "Sent to Patient") {
        sessionStorage.setItem("edit_from_approved_status", letterStatus);
      }
    }
    router.push("/workspace/letter-editor");
  };

  const handleExportPdf = async () => {
    if (exporting) return;
    setExporting(true);
    setExportDone(false);
    setExportError("");
    setPdfUploadStatus("idle");
    setPdfUploadError("");
    try {
      const d = data as unknown as Record<string, unknown>;
      const patientName = (d?.name     as string) || "";
      const patientId   = (d?.patId    as string) || "";
      const location    = (d?.location as string) || "";
      const date = [(d?.dateDay as string), (d?.dateMonth as string), (d?.dateYear as string)]
        .filter(Boolean).join("/");

      const letterId = localStorage.getItem("letter_current_supabase_id");
      if (!letterId) throw new Error("Letter not saved yet — cannot export PDF. Please save the letter first.");

      setExportProgress("Launching browser for PDF export…");
      const apiRes = await fetch("/api/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ letterId }),
      });
      if (!apiRes.ok) {
        const errJson = await apiRes.json().catch(() => ({}));
        throw new Error((errJson as { error?: string }).error || `Export failed (${apiRes.status})`);
      }
      setExportProgress("Building PDF…");
      const pdfArrayBuffer = await apiRes.arrayBuffer();
      const filename = finalPdfFilename(patientId, patientName, location, date);
      const blob = new Blob([pdfArrayBuffer], { type: "application/pdf" });

      const pdfSizeBytes = blob.size;
      console.log(`[size] PDF size: ${Math.round(pdfSizeBytes / 1024)} KB`);

      setExportProgress("Saving PDF…");
      triggerDownload(blob, filename);
      setExportDone(true);
      setExportProgress("");

      setPdfUploadStatus("uploading");
      {
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

          const pictures = (d?.pictures as string[]) || [];
          const imagesTotalSizeBytes = pictures.reduce((total, pic) => {
            const b64 = pic.split(",")[1] ?? "";
            const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
            return total + Math.floor(b64.length * 3 / 4) - pad;
          }, 0);
          console.log(`[size] PDF: ${Math.round(pdfSizeBytes / 1024)} KB · Images: ${pictures.length} = ${Math.round(imagesTotalSizeBytes / 1024)} KB`);

          updateLetterFileSizes(supabase, letterId, {
            finalPdfSizeBytes: pdfSizeBytes,
            imagesSizeBytes:   imagesTotalSizeBytes,
          }).catch((e) => console.warn("[preview] size update error:", e));

          getLetterById(supabase, letterId).then((letter) => {
            if (letter?.patient_id) {
              cleanupOldLetterFiles(supabase, letterId, letter.patient_id).catch((e) =>
                console.warn("[preview] Storage cleanup error:", e)
              );
            }
          }).catch(() => { /* cleanup is best-effort */ });
        } catch (uploadErr) {
          console.warn("[preview] PDF upload error:", uploadErr);
          setPdfUploadStatus("error");
          setPdfUploadError(uploadErr instanceof Error ? uploadErr.message : "Upload failed");
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[exportPdf] failed:", err);
      setExportError(`PDF export failed: ${msg}. Please try again.`);
      setExportProgress("");
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
      localStorage.removeItem("letter_preview");
    } catch (err) {
      console.error("[preview] Supabase save error:", err);
    }

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
    localStorage.setItem("letter_just_sent", "1");
    setTimeout(() => router.push("/workspace/anat-review"), 800);
  };

  useEffect(() => {
    const run = async () => {
      const raw = localStorage.getItem("letter_preview");
      let parsed: Record<string, unknown> | null = null;
      if (raw) {
        try {
          parsed = JSON.parse(raw);
          if (parsed?.testResults) parsed.testResults = migratePreviewTestResults(parsed.testResults) as unknown as Record<string, unknown>;
          if (!Array.isArray(parsed?.inhalers)) {
            parsed!.inhalers = parsed?.inhalerName
              ? [{ id: "inh-0", name: parsed!.inhalerName, link: parsed!.inhalerLink || "", imageUrl: parsed!.inhalerImageUrl || "" }]
              : [];
          }
        } catch { parsed = null; }
      }

      const supabaseId = localStorage.getItem("letter_current_supabase_id");
      if (supabaseId && (!parsed?.pictures || (parsed.pictures as string[]).length === 0)) {
        try {
          const supabase = createClient();
          const letter = await getLetterById(supabase, supabaseId);
          if (letter?.pictures?.length) {
            if (!parsed) parsed = {};
            parsed.pictures = letter.pictures;
          }
        } catch { /* Supabase unavailable — proceed without pictures */ }
      }

      if (parsed) setData(parsed as unknown as LetterData);
    };
    run();
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── "Sent to Patient" edit warning dialog ── */}
      {editWarning && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          backgroundColor: "rgba(0,0,0,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 24,
        }}>
          <div style={{
            backgroundColor: "#fff", borderRadius: 16, padding: 28, maxWidth: 420, width: "100%",
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg viewBox="0 0 16 16" fill="none" stroke="#BE123C" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                  <circle cx="8" cy="8" r="7"/><path d="M8 5v3M8 11h.01"/>
                </svg>
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1A2B4A", margin: 0 }}>Letter already sent to patient</h3>
            </div>
            <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, marginBottom: 20 }}>
              This letter has already been sent to the patient. Editing it will <strong>not</strong> change the email that was already sent. You can still make corrections for your records — just re-export the PDF before sending again.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setEditWarning(false)} style={{ fontSize: 13, fontWeight: 600, borderRadius: 10, padding: "8px 18px", backgroundColor: "white", color: "#64748B", border: "1px solid #E2E8F0", cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={() => { setEditWarning(false); navigateToEditor(); }} style={{ fontSize: 13, fontWeight: 600, borderRadius: 10, padding: "8px 18px", backgroundColor: "#BE123C", color: "#fff", border: "1px solid #BE123C", cursor: "pointer" }}>
                Edit Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          body { margin: 0 !important; background: white !important; }
          .preview-toolbar { display: none !important; }
          .preview-wrapper { padding: 0 !important; gap: 0 !important; background: white !important; }
          .a4-page { box-shadow: none !important; break-after: page; page-break-after: always; }
          .a4-page:last-child { break-after: auto; page-break-after: auto; }
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
        <div className="preview-toolbar" style={{ width: "100%", maxWidth: 820, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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

          {exportMode ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {exportDone && pdfUploadStatus === "idle" && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#0D9488", display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}><path d="M3 8l4 4 6-7"/></svg>
                    PDF downloaded
                  </span>
                )}
                {exporting && exportProgress && (
                  <span style={{ fontSize: 11, color: "#94A3B8" }}>{exportProgress}</span>
                )}
                {!exporting && exportError && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#BE123C", display: "inline-flex", alignItems: "center", gap: 4, maxWidth: 280 }}>
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12, flexShrink: 0 }}>
                      <circle cx="8" cy="8" r="7"/><path d="M8 5v3M8 11h.01"/>
                    </svg>
                    {exportError}
                  </span>
                )}
                <button type="button" onClick={handleEditLetter} style={{ fontSize: 12, fontWeight: 600, borderRadius: 10, padding: "8px 16px", backgroundColor: "white", color: "#64748B", border: "1px solid #E2E8F0", cursor: "pointer", transition: "all 0.15s" }}>
                  Edit Letter
                </button>
                <button type="button" onClick={handleExportPdf} disabled={exporting} style={{ fontSize: 12, fontWeight: 600, borderRadius: 10, padding: "8px 20px", backgroundColor: exporting ? "#F4F6F9" : "#0D9488", color: exporting ? "#94A3B8" : "#fff", border: exporting ? "1px solid #E2E8F0" : "1px solid #0D9488", cursor: exporting ? "default" : "pointer", transition: "all 0.15s" }}>
                  {exporting ? "Generating PDF…" : exportDone ? "Download Again" : "Download Final PDF"}
                </button>
              </div>
              {pdfUploadStatus === "uploading" && (
                <span style={{ fontSize: 11, color: "#94A3B8" }}>Uploading PDF to secure storage…</span>
              )}
              {pdfUploadStatus === "done" && (
                <span style={{ fontSize: 11, fontWeight: 600, color: "#0D9488", display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ width: 11, height: 11 }}><path d="M3 8l4 4 6-7"/></svg>
                  PDF saved to storage
                </span>
              )}
              {pdfUploadStatus === "error" && (
                <span style={{ fontSize: 11, color: "#BE123C" }}>Could not save to storage: {pdfUploadError}</span>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={handleEditLetter} style={{ fontSize: 12, fontWeight: 600, borderRadius: 10, padding: "8px 16px", backgroundColor: "white", color: "#64748B", border: "1px solid #E2E8F0", cursor: "pointer", transition: "all 0.15s" }}>
                Edit Letter
              </button>
              {returnTo !== "review" && (
                <button type="button" onClick={handleSendToAnat} disabled={sent} style={{ fontSize: 12, fontWeight: 600, borderRadius: 10, padding: "8px 20px", cursor: sent ? "default" : "pointer", backgroundColor: sent ? "#EDE9FE" : "#1A2B4A", color: sent ? "#7C3AED" : "#ffffff", border: sent ? "1px solid #EDE9FE" : "1px solid #1A2B4A", transition: "all 0.15s" }}>
                  {sent ? "Sent to Anat ✓" : "Send to Anat"}
                </button>
              )}
            </div>
          )}
        </div>

        <div id="letter-preview-export-source">
          {data ? <LetterPageRenderer data={data} /> : (
            <div style={{ color: "#94A3B8", fontSize: 13, padding: 40 }}>Loading letter…</div>
          )}
        </div>

      </div>
    </>
  );
}
