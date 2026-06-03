"use client";

// Supabase is now the source of truth for patients and letters.
// Temporary storage should only be used as a fallback during development.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  getLettersByStatus,
  updateLetterStatus,
  updateLetterFileUrls,
} from "@/lib/supabase/letters";
import {
  getLetters,
  markAsPreviewed,
  updateStatus as updateLocalStatus,
  setReviewFile,
  markSentToPatient,
  type StoredLetter,
  type LetterStatus,
} from "@/lib/letterStore";
import { generateLetterDocx, triggerDownload, finalDocxFilename } from "@/lib/generateDocx";

// ─── Storage helpers ─────────────────────────────────────────────────────────

const STORAGE_BUCKET = "clinic-letters";

/** Sanitise a string for use as a Storage path segment. */
function safePathSegment(s: string): string {
  return (s || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_{2,}/g, "_").replace(/^_|_$/, "") || "unknown";
}

/** Create a 1-hour signed download URL and trigger the browser download. */
async function downloadFromStorage(storagePath: string, downloadFilename: string): Promise<string | null> {
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, 3600, { download: downloadFilename });
  if (error || !data?.signedUrl) {
    console.error("[downloadFromStorage]", error?.message);
    return null;
  }
  return data.signedUrl;
}

// ─── Status colours ───────────────────────────────────────────────────────────

const STATUS_COLORS: Record<LetterStatus, { bg: string; text: string }> = {
  Draft:               { bg: "#EBF3FB",  text: "#4A90D9" },
  "Ready for Review":  { bg: "#FEF3C7",  text: "#D97706" },
  "Waiting for Anat":  { bg: "#EDE9FE",  text: "#7C3AED" },
  Reviewed:            { bg: "#FFE4E6",  text: "#BE123C" },
  "Ready for Patient": { bg: "#CCFBF1",  text: "#0D9488" },
  "Sent to Patient":   { bg: "#F0FDF4",  text: "#16A34A" },
};

// ─── Waiting for Anat card ────────────────────────────────────────────────────

function WaitingCard({
  letter,
  onMarkReviewed,
}: {
  letter: StoredLetter;
  onMarkReviewed: (filename: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const colors  = STATUS_COLORS["Waiting for Anat"];

  return (
    <div className="bg-white rounded-2xl border px-5 py-4"
      style={{ borderColor: "#E2E8F0", boxShadow: "0 1px 3px 0 rgb(0 0 0/0.05), 0 4px 16px 0 rgb(26 43 74/0.04)" }}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: "#1A2B4A" }}>{letter.patientName}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {letter.patientId && <span className="text-xs" style={{ color: "#94A3B8" }}>{letter.patientId}</span>}
            {letter.patientId && letter.letterDate && <span style={{ color: "#E2E8F0" }}>·</span>}
            {letter.letterDate && <span className="text-xs" style={{ color: "#94A3B8" }}>{letter.letterDate}</span>}
          </div>
        </div>
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 hidden sm:inline-flex"
          style={{ backgroundColor: colors.bg, color: colors.text }}>
          Waiting for Anat
        </span>
      </div>
      <div className="flex items-center gap-3 mt-3 pt-3 flex-wrap" style={{ borderTop: "1px solid #F1F5F9" }}>
        <p className="text-xs flex-1 min-w-0" style={{ color: "#94A3B8" }}>
          Waiting for Anat to return the reviewed file
        </p>
        <input ref={fileRef} type="file" accept=".docx,.pages,.doc" className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            onMarkReviewed(file.name);
            e.target.value = "";
          }} />
        <button onClick={() => fileRef.current?.click()}
          className="text-xs font-semibold px-4 py-2 rounded-xl border transition-all duration-150 flex-shrink-0"
          style={{ backgroundColor: "#1A2B4A", color: "#fff", borderColor: "#1A2B4A" }}
          onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-1px)")}
          onMouseLeave={e => (e.currentTarget.style.transform = "none")}>
          Upload Reviewed File
        </button>
      </div>
      <p className="text-[10px] mt-1.5 text-right" style={{ color: "#CBD5E1" }}>
        Accepts .docx · .pages · .doc
      </p>
    </div>
  );
}

// ─── Reviewed card ────────────────────────────────────────────────────────────

function ReviewedCard({
  letter, previewed, onPreview, onApprove,
}: {
  letter: StoredLetter; previewed: boolean;
  onPreview: () => void; onApprove: () => void;
}) {
  const colors = STATUS_COLORS["Reviewed"];
  return (
    <div className="bg-white rounded-2xl border px-5 py-4"
      style={{ borderColor: "#E2E8F0", boxShadow: "0 1px 3px 0 rgb(0 0 0/0.05), 0 4px 16px 0 rgb(26 43 74/0.04)" }}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: "#1A2B4A" }}>{letter.patientName}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {letter.patientId && <span className="text-xs" style={{ color: "#94A3B8" }}>{letter.patientId}</span>}
            {letter.patientId && letter.letterDate && <span style={{ color: "#E2E8F0" }}>·</span>}
            {letter.letterDate && <span className="text-xs" style={{ color: "#94A3B8" }}>{letter.letterDate}</span>}
          </div>
          {letter.reviewFileName && (
            <p className="text-[11px] mt-1.5 flex items-center gap-1.5" style={{ color: "#7C3AED" }}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.75}
                strokeLinecap="round" strokeLinejoin="round" style={{ width: 11, height: 11 }}>
                <path d="M9 1H3a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6L9 1z"/>
                <path d="M9 1v5h5"/>
              </svg>
              {letter.reviewFileName}
            </p>
          )}
        </div>
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 hidden sm:inline-flex"
          style={{ backgroundColor: colors.bg, color: colors.text }}>
          Reviewed
        </span>
      </div>
      <div className="flex items-center gap-3 mt-3 pt-3" style={{ borderTop: "1px solid #F1F5F9" }}>
        <div className="flex-1 min-w-0">
          {previewed
            ? <p className="text-xs flex items-center gap-1.5" style={{ color: "#0D9488" }}>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.5}
                  strokeLinecap="round" strokeLinejoin="round" style={{ width: 11, height: 11, flexShrink: 0 }}>
                  <path d="M3 8l4 4 6-7"/>
                </svg>
                Letter previewed — ready to approve
              </p>
            : <p className="text-xs" style={{ color: "#94A3B8" }}>Preview the letter before approving</p>}
        </div>
        <button onClick={onPreview}
          className="text-xs font-semibold px-4 py-2 rounded-xl border transition-all duration-150 flex-shrink-0"
          style={{ backgroundColor: "white", color: "#1A2B4A", borderColor: "#E2E8F0" }}
          onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-1px)")}
          onMouseLeave={e => (e.currentTarget.style.transform = "none")}>
          Preview Letter
        </button>
        <button onClick={previewed ? onApprove : undefined} disabled={!previewed}
          className="text-xs font-semibold px-4 py-2 rounded-xl border transition-all duration-150 flex-shrink-0"
          style={previewed
            ? { backgroundColor: "#1A2B4A", color: "#fff", borderColor: "#1A2B4A", cursor: "pointer" }
            : { backgroundColor: "#F4F6F9", color: "#CBD5E1", borderColor: "#E2E8F0", cursor: "not-allowed" }}
          onMouseEnter={e => { if (previewed) (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "none"; }}>
          Approve
        </button>
      </div>
    </div>
  );
}

// ─── Send confirmation modal ──────────────────────────────────────────────────

function ConfirmSendModal({
  patientName, patientEmail, sending, onCancel, onConfirm,
}: {
  patientName: string; patientEmail: string;
  sending: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(26,43,74,0.45)" }} onClick={onCancel}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4"
        style={{ boxShadow: "0 24px 64px rgb(26 43 74 / 0.25)" }} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold mb-1" style={{ color: "#1A2B4A" }}>Send final PDF to patient?</h3>
        <p className="text-xs mb-5" style={{ color: "#94A3B8" }}>
          Please confirm before sending. The patient will receive the final clinic letter.
        </p>
        <div className="rounded-xl px-4 py-3 mb-5" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
          <div className="flex items-baseline gap-3 mb-2">
            <span className="text-xs font-semibold w-14 flex-shrink-0" style={{ color: "#64748B" }}>Patient</span>
            <span className="text-sm font-semibold" style={{ color: "#1A2B4A" }}>{patientName}</span>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-xs font-semibold w-14 flex-shrink-0" style={{ color: "#64748B" }}>Email</span>
            <span className="text-sm" style={{ color: "#1A2B4A", wordBreak: "break-all" }}>{patientEmail}</span>
          </div>
        </div>
        <div className="rounded-xl px-3 py-2 mb-5 flex items-start gap-2"
          style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}>
          <svg viewBox="0 0 16 16" fill="none" stroke="#D97706" strokeWidth={1.75}
            strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 flex-shrink-0 mt-px">
            <path d="M8 1l7 13H1L8 1z"/><path d="M8 6v4M8 12h.01"/>
          </svg>
          <p className="text-xs" style={{ color: "#92400E" }}>
            This will send the letter as a PDF attachment to the patient&apos;s email.
          </p>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} disabled={sending}
            className="text-xs font-semibold px-4 py-2 rounded-xl border transition-all duration-150"
            style={{ backgroundColor: "white", color: "#64748B", borderColor: "#E2E8F0" }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={sending}
            className="text-xs font-semibold px-4 py-2 rounded-xl border transition-all duration-150"
            style={{ backgroundColor: sending ? "#F4F6F9" : "#1A2B4A",
              color: sending ? "#94A3B8" : "#fff",
              borderColor: sending ? "#E2E8F0" : "#1A2B4A",
              cursor: sending ? "default" : "pointer" }}>
            {sending ? "Sending…" : "Send PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Ready for Patient card ───────────────────────────────────────────────────

function ReadyCard({
  letter, onPreview, onExportPdf, onMarkSent,
}: {
  letter: StoredLetter;
  onPreview: () => void;
  onExportPdf: () => void;
  onMarkSent: (email: string) => Promise<void>;
}) {
  const colors       = STATUS_COLORS["Ready for Patient"];
  const d            = (letter.data ?? {}) as Record<string, unknown>;
  const patientEmail = (d.email    as string) || "";
  const patientName  = (d.name     as string) || letter.patientName || "";
  const patientId    = (d.patId    as string) || letter.patientId   || "";
  const location     = (d.location as string) || "";
  const date         = letter.letterDate || "";

  const [exportingDocx,    setExportingDocx]    = useState(false);
  const [docxUploadStatus, setDocxUploadStatus] = useState<"idle"|"uploading"|"done"|"error">("idle");
  const [docxUploadError,  setDocxUploadError]  = useState("");
  const [localDocxPath,    setLocalDocxPath]    = useState<string | null>(null);
  const [downloading,      setDownloading]      = useState(false);
  const [downloadError,    setDownloadError]    = useState("");
  const [showModal,        setShowModal]        = useState(false);
  const [sending,          setSending]          = useState(false);
  const [noEmailError,     setNoEmailError]     = useState(false);
  const [sendError,        setSendError]        = useState("");

  const effectiveDocxPath = localDocxPath || letter.editableDocxPath || null;
  const effectivePdfPath  = letter.finalPdfPath || null;

  const handleExportDocx = async () => {
    if (exportingDocx) return;
    setExportingDocx(true);
    setDocxUploadStatus("idle");
    setDocxUploadError("");
    try {
      const blob     = await generateLetterDocx(d, "final");
      const filename = finalDocxFilename(patientId, patientName, location, date);
      triggerDownload(blob, filename);

      // Upload to Supabase Storage
      setDocxUploadStatus("uploading");
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const safePatId    = safePathSegment(patientId);
      const storagePath  = `${user.id}/${safePatId}/${letter.id}/${filename}`;
      const { error: uploadErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, blob, {
          contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          upsert: true,
        });
      if (uploadErr) throw new Error(uploadErr.message);

      await updateLetterFileUrls(supabase, letter.id, { editableDocxUrl: storagePath });
      setLocalDocxPath(storagePath);
      setDocxUploadStatus("done");
    } catch (err) {
      console.error("DOCX export/upload failed:", err);
      setDocxUploadStatus("error");
      setDocxUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setExportingDocx(false);
    }
  };

  const handleDownload = async (storagePath: string, filename: string) => {
    if (downloading) return;
    setDownloading(true);
    setDownloadError("");
    try {
      const url = await downloadFromStorage(storagePath, filename);
      if (!url) throw new Error("Could not generate download link.");
      window.open(url, "_blank");
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Download failed");
      setTimeout(() => setDownloadError(""), 5000);
    } finally {
      setDownloading(false);
    }
  };

  const handleSendClick = () => {
    setSendError("");
    if (!patientEmail) { setNoEmailError(true); setTimeout(() => setNoEmailError(false), 4000); return; }
    setShowModal(true);
  };

  const confirmSend = async () => {
    setSending(true);
    setSendError("");
    try {
      const res = await fetch("/api/send-patient-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ letterId: letter.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Send failed.");
      await onMarkSent(patientEmail);
      setShowModal(false);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send.");
      setSending(false);
    }
  };

  return (
    <>
      {showModal && (
        <ConfirmSendModal patientName={patientName} patientEmail={patientEmail}
          sending={sending} onCancel={() => { if (!sending) setShowModal(false); }} onConfirm={confirmSend} />
      )}
      <div className="bg-white rounded-2xl border px-5 py-4"
        style={{ borderColor: "#E2E8F0", boxShadow: "0 1px 3px 0 rgb(0 0 0/0.05), 0 4px 16px 0 rgb(26 43 74/0.04)" }}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: "#1A2B4A" }}>{letter.patientName}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {letter.patientId && <span className="text-xs" style={{ color: "#94A3B8" }}>{letter.patientId}</span>}
              {letter.patientId && letter.letterDate && <span style={{ color: "#E2E8F0" }}>·</span>}
              {letter.letterDate && <span className="text-xs" style={{ color: "#94A3B8" }}>{letter.letterDate}</span>}
            </div>
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 hidden sm:inline-flex"
            style={{ backgroundColor: colors.bg, color: colors.text }}>Ready for Patient</span>
        </div>

        {/* Row 1: export actions */}
        <div className="flex items-center gap-2 mt-3 pt-3 flex-wrap" style={{ borderTop: "1px solid #F1F5F9" }}>
          <button onClick={onPreview}
            className="text-xs font-semibold px-3 py-2 rounded-xl border transition-all duration-150"
            style={{ backgroundColor: "white", color: "#64748B", borderColor: "#E2E8F0" }}
            onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-1px)")}
            onMouseLeave={e => (e.currentTarget.style.transform = "none")}>
            Preview Final Letter
          </button>
          <button onClick={handleExportDocx} disabled={exportingDocx}
            className="text-xs font-semibold px-3 py-2 rounded-xl border transition-all duration-150"
            style={{ backgroundColor: "white", color: exportingDocx ? "#94A3B8" : "#1A2B4A",
              borderColor: exportingDocx ? "#E2E8F0" : "#1A2B4A", cursor: exportingDocx ? "default" : "pointer" }}
            onMouseEnter={e => { if (!exportingDocx) (e.currentTarget.style.transform = "translateY(-1px)"); }}
            onMouseLeave={e => { (e.currentTarget.style.transform = "none"); }}>
            {exportingDocx ? "Generating…" : "Export Editable DOCX"}
          </button>
          <button onClick={onExportPdf}
            className="text-xs font-semibold px-3 py-2 rounded-xl border transition-all duration-150"
            style={{ backgroundColor: "#0D9488", color: "#fff", borderColor: "#0D9488" }}
            onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-1px)")}
            onMouseLeave={e => (e.currentTarget.style.transform = "none")}>
            Export Final PDF
          </button>
        </div>

        {/* Upload feedback */}
        {(docxUploadStatus !== "idle") && (
          <div className="mt-2">
            {docxUploadStatus === "uploading" && (
              <p className="text-xs" style={{ color: "#94A3B8" }}>Uploading DOCX…</p>
            )}
            {docxUploadStatus === "done" && (
              <p className="text-xs flex items-center gap-1" style={{ color: "#0D9488" }}>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 flex-shrink-0"><path d="M3 8l4 4 6-7"/></svg>
                DOCX saved successfully
              </p>
            )}
            {docxUploadStatus === "error" && (
              <p className="text-xs" style={{ color: "#BE123C" }}>Could not save DOCX: {docxUploadError}</p>
            )}
          </div>
        )}

        {/* Row 2: download saved files (visible only when files exist in storage) */}
        {(effectivePdfPath || effectiveDocxPath) && (
          <div className="flex items-center gap-2 mt-2.5 pt-2.5 flex-wrap" style={{ borderTop: "1px dashed #F1F5F9" }}>
            <span className="text-xs flex-shrink-0" style={{ color: "#94A3B8" }}>Saved:</span>
            {effectivePdfPath && (
              <button
                onClick={() => handleDownload(effectivePdfPath, finalDocxFilename(patientId, patientName, location, date).replace(".docx", ".pdf"))}
                disabled={downloading}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all duration-150 inline-flex items-center gap-1"
                style={{ backgroundColor: "white", color: "#0D9488", borderColor: "#0D9488", cursor: downloading ? "default" : "pointer" }}
                onMouseEnter={e => { if (!downloading) (e.currentTarget.style.transform = "translateY(-1px)"); }}
                onMouseLeave={e => (e.currentTarget.style.transform = "none")}>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><path d="M8 3v7M5 7l3 3 3-3"/><path d="M3 13h10"/></svg>
                Download Saved PDF
              </button>
            )}
            {effectiveDocxPath && (
              <button
                onClick={() => handleDownload(effectiveDocxPath, finalDocxFilename(patientId, patientName, location, date))}
                disabled={downloading}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all duration-150 inline-flex items-center gap-1"
                style={{ backgroundColor: "white", color: "#1A2B4A", borderColor: "#1A2B4A", cursor: downloading ? "default" : "pointer" }}
                onMouseEnter={e => { if (!downloading) (e.currentTarget.style.transform = "translateY(-1px)"); }}
                onMouseLeave={e => (e.currentTarget.style.transform = "none")}>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><path d="M8 3v7M5 7l3 3 3-3"/><path d="M3 13h10"/></svg>
                Download Saved DOCX
              </button>
            )}
            {downloadError && <p className="text-xs w-full" style={{ color: "#BE123C" }}>{downloadError}</p>}
          </div>
        )}

        {/* Row 3: send email to patient */}
        <div className="flex items-center gap-3 mt-2.5 pt-2.5 flex-wrap" style={{ borderTop: "1px dashed #F1F5F9" }}>
          <div className="flex-1 min-w-0">
            {noEmailError && <p className="text-xs flex items-center gap-1.5" style={{ color: "#BE123C" }}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2}
                strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 flex-shrink-0">
                <circle cx="8" cy="8" r="7"/><path d="M8 5v4M8 11h.01"/>
              </svg>
              Patient email is missing. Add it in Patient Details.
            </p>}
            {sendError && <p className="text-xs" style={{ color: "#BE123C" }}>{sendError}</p>}
            {!noEmailError && !sendError && patientEmail && (
              <p className="text-xs truncate" style={{ color: "#94A3B8" }}>Will send to: {patientEmail}</p>
            )}
            {!noEmailError && !sendError && !patientEmail && (
              <p className="text-xs" style={{ color: "#CBD5E1" }}>No patient email on file</p>
            )}
          </div>
          <button onClick={handleSendClick}
            className="text-xs font-semibold px-3 py-2 rounded-xl border transition-all duration-150 flex-shrink-0 inline-flex items-center gap-1.5"
            style={{ backgroundColor: "#1A2B4A", color: "#fff", borderColor: "#1A2B4A" }}
            onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-1px)")}
            onMouseLeave={e => (e.currentTarget.style.transform = "none")}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.75}
              strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <rect x="1" y="3" width="14" height="10" rx="1.5"/><path d="M1 4l7 5 7-5"/>
            </svg>
            Send PDF to Patient
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Sent to Patient card ─────────────────────────────────────────────────────

function SentCard({ letter }: { letter: StoredLetter }) {
  const colors       = STATUS_COLORS["Sent to Patient"];
  const d            = (letter.data ?? {}) as Record<string, unknown>;
  const patientId    = (d.patId    as string) || letter.patientId || "";
  const patientName  = (d.name     as string) || letter.patientName || "";
  const location     = (d.location as string) || "";
  const date         = letter.letterDate || "";

  const [downloading,   setDownloading]   = useState(false);
  const [downloadError, setDownloadError] = useState("");

  const hasPdf  = !!letter.finalPdfPath;
  const hasDocx = !!letter.editableDocxPath;

  const handleDownload = async (storagePath: string, filename: string) => {
    if (downloading) return;
    setDownloading(true);
    setDownloadError("");
    try {
      const url = await downloadFromStorage(storagePath, filename);
      if (!url) throw new Error("Could not generate download link.");
      window.open(url, "_blank");
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Download failed");
      setTimeout(() => setDownloadError(""), 5000);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border px-5 py-4"
      style={{ borderColor: "#E2E8F0", boxShadow: "0 1px 3px 0 rgb(0 0 0/0.05), 0 4px 16px 0 rgb(26 43 74/0.04)" }}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: "#1A2B4A" }}>{letter.patientName}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {letter.patientId && <span className="text-xs" style={{ color: "#94A3B8" }}>{letter.patientId}</span>}
            {letter.patientId && letter.letterDate && <span style={{ color: "#E2E8F0" }}>·</span>}
            {letter.letterDate && <span className="text-xs" style={{ color: "#94A3B8" }}>{letter.letterDate}</span>}
            {letter.sentToEmail && (
              <><span style={{ color: "#E2E8F0" }}>·</span>
              <span className="text-xs truncate" style={{ color: "#94A3B8" }}>{letter.sentToEmail}</span></>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full hidden sm:inline-flex"
            style={{ backgroundColor: colors.bg, color: colors.text }}>Sent to Patient</span>
          <span className="text-xs font-semibold flex items-center gap-1" style={{ color: "#16A34A" }}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.5}
              strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <path d="M3 8l4 4 6-7"/>
            </svg>
            PDF sent
          </span>
        </div>
      </div>

      {/* Download saved files */}
      {(hasPdf || hasDocx) && (
        <div className="flex items-center gap-2 mt-3 pt-3 flex-wrap" style={{ borderTop: "1px dashed #F1F5F9" }}>
          <span className="text-xs flex-shrink-0" style={{ color: "#94A3B8" }}>Saved:</span>
          {hasPdf && (
            <button
              onClick={() => handleDownload(letter.finalPdfPath!, finalDocxFilename(patientId, patientName, location, date).replace(".docx", ".pdf"))}
              disabled={downloading}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all duration-150 inline-flex items-center gap-1"
              style={{ backgroundColor: "white", color: "#0D9488", borderColor: "#0D9488", cursor: downloading ? "default" : "pointer" }}
              onMouseEnter={e => { if (!downloading) (e.currentTarget.style.transform = "translateY(-1px)"); }}
              onMouseLeave={e => (e.currentTarget.style.transform = "none")}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><path d="M8 3v7M5 7l3 3 3-3"/><path d="M3 13h10"/></svg>
              Download Saved PDF
            </button>
          )}
          {hasDocx && (
            <button
              onClick={() => handleDownload(letter.editableDocxPath!, finalDocxFilename(patientId, patientName, location, date))}
              disabled={downloading}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all duration-150 inline-flex items-center gap-1"
              style={{ backgroundColor: "white", color: "#1A2B4A", borderColor: "#1A2B4A", cursor: downloading ? "default" : "pointer" }}
              onMouseEnter={e => { if (!downloading) (e.currentTarget.style.transform = "translateY(-1px)"); }}
              onMouseLeave={e => (e.currentTarget.style.transform = "none")}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><path d="M8 3v7M5 7l3 3 3-3"/><path d="M3 13h10"/></svg>
              Download Saved DOCX
            </button>
          )}
          {downloadError && <p className="text-xs w-full" style={{ color: "#BE123C" }}>{downloadError}</p>}
        </div>
      )}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, count, badge, empty, children }: {
  title: string; count: number; badge: { bg: string; text: string };
  empty: string; children: React.ReactNode;
}) {
  return (
    <div className="px-6 sm:px-8 mb-8">
      <div className="flex items-center gap-2.5 mb-3">
        <h2 className="text-sm font-bold" style={{ color: "#1A2B4A" }}>{title}</h2>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full tabular-nums"
          style={{ backgroundColor: badge.bg, color: badge.text }}>
          {count}
        </span>
      </div>
      {count === 0
        ? <div className="flex items-center justify-center py-5 rounded-xl"
            style={{ border: "1px dashed #E2E8F0" }}>
            <p className="text-xs" style={{ color: "#CBD5E1" }}>{empty}</p>
          </div>
        : <div className="flex flex-col gap-2.5">{children}</div>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReviewPage() {
  const router = useRouter();
  const [letters,     setLetters]     = useState<StoredLetter[]>([]);
  const [previewedIds, setPreviewedIds] = useState<string[]>([]);

  const loadAll = async () => {
    const supabase = createClient();
    const statuses: LetterStatus[] = ["Waiting for Anat", "Reviewed", "Ready for Patient", "Sent to Patient"];
    const supabaseLetters = await getLettersByStatus(supabase, statuses);

    if (supabaseLetters.length > 0) {
      setLetters(supabaseLetters);
    } else {
      // Fallback to localStorage while Supabase is empty or unavailable
      setLetters(getLetters().filter((l) =>
        statuses.includes(l.status as LetterStatus)
      ));
    }
    try {
      const raw = localStorage.getItem("clinic_previewed_v1");
      setPreviewedIds(raw ? JSON.parse(raw) : []);
    } catch { setPreviewedIds([]); }
  };

  useEffect(() => { loadAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleApprove = async (letter: StoredLetter) => {
    const supabase = createClient();
    await updateLetterStatus(supabase, letter.id, "Ready for Patient", {
      approvedAt: new Date().toISOString(),
    });
    updateLocalStatus(letter.id, "Ready for Patient");
    loadAll();
  };

  const handleUploadReviewed = async (letter: StoredLetter, filename: string) => {
    const supabase = createClient();
    await updateLetterStatus(supabase, letter.id, "Reviewed", {
      reviewedAt:      new Date().toISOString(),
      reviewFileName:  filename,
    });
    setReviewFile(letter.id, filename);
    updateLocalStatus(letter.id, "Reviewed");
    loadAll();
  };

  const handleMarkSent = async (letter: StoredLetter, email: string) => {
    const supabase = createClient();
    await updateLetterStatus(supabase, letter.id, "Sent to Patient", {
      sentToPatientAt: new Date().toISOString(),
    });
    markSentToPatient(letter.id, email);
    loadAll();
  };

  const navigateToPreview = (letter: StoredLetter, exportMode = false) => {
    if (letter.data) localStorage.setItem("letter_preview", JSON.stringify(letter.data));
    localStorage.setItem("letter_current_id",          letter.id);
    localStorage.setItem("letter_current_supabase_id", letter.id);
    localStorage.setItem("letter_return_to", "review");
    if (exportMode) localStorage.setItem("letter_export_mode", "1");
    else            localStorage.removeItem("letter_export_mode");
    markAsPreviewed(letter.id);
    router.push("/workspace/letter-preview");
  };

  const waiting  = letters.filter((l) => l.status === "Waiting for Anat");
  const reviewed = letters.filter((l) => l.status === "Reviewed");
  const ready    = letters.filter((l) => l.status === "Ready for Patient");
  const sent     = letters.filter((l) => l.status === "Sent to Patient");

  return (
    <div className="flex-1 pb-10">
      {/* Header */}
      <div className="grid grid-cols-3 items-start px-6 sm:px-8 pt-8 pb-6">
        <div />
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: "#1A2B4A" }}>Review Workflow</h1>
          <p className="text-sm mt-1" style={{ color: "#94A3B8" }}>Track letters through the review process</p>
        </div>
        <div className="flex items-center justify-end pt-1">
          <button
            onClick={() => window.history.length > 1 ? router.back() : router.push("/workspace")}
            className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors duration-150"
            style={{ color: "#94A3B8", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2}
              strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <path d="M10 12L6 8l4-4"/>
            </svg>
            Back
          </button>
        </div>
      </div>

      <Section title="Waiting for Anat" count={waiting.length}
        badge={{ bg: "#EDE9FE", text: "#7C3AED" }} empty="No letters waiting for review">
        {waiting.map((l) => (
          <WaitingCard key={l.id} letter={l}
            onMarkReviewed={(filename) => handleUploadReviewed(l, filename)} />
        ))}
      </Section>

      <Section title="Reviewed — Needs Doctor Approval" count={reviewed.length}
        badge={{ bg: "#FFE4E6", text: "#BE123C" }} empty="No letters pending approval">
        {reviewed.map((l) => (
          <ReviewedCard key={l.id} letter={l}
            previewed={previewedIds.includes(l.id)}
            onPreview={() => navigateToPreview(l, false)}
            onApprove={() => handleApprove(l)} />
        ))}
      </Section>

      <Section title="Ready for Patient" count={ready.length}
        badge={{ bg: "#CCFBF1", text: "#0D9488" }} empty="No letters ready for patient yet">
        {ready.map((l) => (
          <ReadyCard key={l.id} letter={l}
            onPreview={() => navigateToPreview(l, false)}
            onExportPdf={() => navigateToPreview(l, true)}
            onMarkSent={(email) => handleMarkSent(l, email)} />
        ))}
      </Section>

      {sent.length > 0 && (
        <Section title="Sent to Patient" count={sent.length}
          badge={{ bg: "#F0FDF4", text: "#16A34A" }} empty="">
          {sent.map((l) => <SentCard key={l.id} letter={l} />)}
        </Section>
      )}
    </div>
  );
}
