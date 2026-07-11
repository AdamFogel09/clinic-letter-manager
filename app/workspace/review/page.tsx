"use client";

// Supabase is now the source of truth for patients and letters.
// Temporary storage should only be used as a fallback during development.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  getLettersByStatus,
  updateLetterStatus,
  deleteOldLettersForPatient,
  deleteLetter,
} from "@/lib/supabase/letters";
import {
  markAsPreviewed,
  removeLettersById,
  type StoredLetter,
  type LetterStatus,
} from "@/lib/letterStore";
import type { ContactEntry } from "@/lib/supabase/patients";
// ─── Status colours ───────────────────────────────────────────────────────────

const STATUS_COLORS: Record<LetterStatus, { bg: string; text: string }> = {
  Draft:               { bg: "#EBF3FB",  text: "#4A90D9" },
  "Ready for Review":  { bg: "#FEF3C7",  text: "#D97706" },
  "Waiting for Anat":  { bg: "#EDE9FE",  text: "#7C3AED" },
  Reviewed:            { bg: "#FFE4E6",  text: "#BE123C" },
  "Ready for Patient": { bg: "#CCFBF1",  text: "#0D9488" },
  "Sent to Patient":   { bg: "#F0FDF4",  text: "#16A34A" },
  saved_internal:      { bg: "#F1F5F9",  text: "#475569" },
};

// ─── Shared "Save to All Letters" button ─────────────────────────────────────

function SaveInternalButton({ onSaveInternal, busy }: {
  onSaveInternal: () => Promise<void>;
  busy: boolean;
}) {
  const [saving, setSaving]   = useState(false);
  const [done,   setDone]     = useState(false);
  const [error,  setError]    = useState("");

  const handle = async () => {
    if (saving || busy) return;
    setSaving(true);
    setError("");
    try {
      await onSaveInternal();
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      {done  && <span className="text-[11px] font-semibold" style={{ color: "#0D9488" }}>Saved to All Letters ✓</span>}
      {error && <span className="text-[11px] font-semibold" style={{ color: "#BE123C" }}>{error}</span>}
      <button onClick={handle} disabled={saving || busy}
        className="text-xs font-semibold px-3 py-2 rounded-xl border transition-all duration-150 flex-shrink-0"
        style={{ backgroundColor: "white", color: "#475569", borderColor: "#94A3B8",
          opacity: (saving || busy) ? 0.6 : 1, cursor: (saving || busy) ? "default" : "pointer" }}
        onMouseEnter={e => { if (!saving && !busy) e.currentTarget.style.transform = "translateY(-1px)"; }}
        onMouseLeave={e => (e.currentTarget.style.transform = "none")}>
        {saving ? "Saving…" : "Save to All Letters"}
      </button>
    </div>
  );
}

// ─── Waiting for Anat card ────────────────────────────────────────────────────

function WaitingCard({
  letter,
  onPreview,
  onEditLetter,
  onDeleteLetter,
  onSaveInternal,
}: {
  letter: StoredLetter;
  onPreview: () => void;
  onEditLetter: () => Promise<void>;
  onDeleteLetter: () => Promise<void>;
  onSaveInternal: () => Promise<void>;
}) {
  const colors  = STATUS_COLORS["Waiting for Anat"];
  const [recalling,    setRecalling]    = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [deleteError,  setDeleteError]  = useState("");

  const handleEdit = async () => {
    if (recalling) return;
    setRecalling(true);
    try { await onEditLetter(); } finally { setRecalling(false); }
  };

  const handleDelete = async () => {
    if (deleting) return;
    const confirmed = window.confirm(
      `Delete the letter for ${letter.patientName}?\n\nThis cannot be undone.`
    );
    if (!confirmed) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await onDeleteLetter();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete.");
    } finally {
      setDeleting(false);
    }
  };

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
        <SaveInternalButton onSaveInternal={onSaveInternal} busy={recalling} />
        <button onClick={onPreview}
          className="text-xs font-semibold px-3 py-2 rounded-xl border transition-all duration-150 flex-shrink-0"
          style={{ backgroundColor: "white", color: "#475569", borderColor: "#94A3B8", cursor: "pointer" }}
          onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-1px)")}
          onMouseLeave={e => (e.currentTarget.style.transform = "none")}>
          Preview
        </button>
        <button onClick={handleEdit} disabled={recalling || deleting}
          className="text-xs font-semibold px-3 py-2 rounded-xl border transition-all duration-150 flex-shrink-0"
          style={{ backgroundColor: recalling ? "#F4F6F9" : "#1A2B4A", color: recalling ? "#94A3B8" : "#fff",
            borderColor: recalling ? "#E2E8F0" : "#1A2B4A", cursor: (recalling || deleting) ? "default" : "pointer" }}
          onMouseEnter={e => { if (!recalling && !deleting) e.currentTarget.style.transform = "translateY(-1px)"; }}
          onMouseLeave={e => (e.currentTarget.style.transform = "none")}>
          {recalling ? "Recalling…" : "Edit Letter"}
        </button>
        <button onClick={handleDelete} disabled={deleting || recalling}
          className="text-xs font-semibold px-3 py-2 rounded-xl border transition-all duration-150 flex-shrink-0"
          style={{ backgroundColor: deleting ? "#F4F6F9" : "#FEF2F2", color: deleting ? "#94A3B8" : "#DC2626",
            borderColor: deleting ? "#E2E8F0" : "#FECACA", cursor: (deleting || recalling) ? "default" : "pointer" }}
          onMouseEnter={e => { if (!deleting && !recalling) e.currentTarget.style.transform = "translateY(-1px)"; }}
          onMouseLeave={e => (e.currentTarget.style.transform = "none")}>
          {deleting ? "Deleting…" : "Delete Letter"}
        </button>
      </div>
      {deleteError && (
        <p className="text-xs mt-2 font-semibold text-right" style={{ color: "#DC2626" }}>{deleteError}</p>
      )}
    </div>
  );
}

// ─── Reviewed card ────────────────────────────────────────────────────────────

function ReviewedCard({
  letter, onPreview, onApprove, onSaveInternal,
}: {
  letter: StoredLetter;
  onPreview: () => void; onApprove: () => Promise<void>; onSaveInternal: () => Promise<void>;
}) {
  const colors = STATUS_COLORS["Reviewed"];
  const [approving,    setApproving]    = useState(false);
  const [approveError, setApproveError] = useState("");

  const handleApproveClick = async () => {
    if (approving) return;
    setApproving(true);
    setApproveError("");
    try {
      await onApprove();
    } catch (err) {
      setApproveError(err instanceof Error ? err.message : "Approve failed. Please try again.");
    } finally {
      setApproving(false);
    }
  };
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
      <div className="flex items-center gap-3 mt-3 pt-3 flex-wrap" style={{ borderTop: "1px solid #F1F5F9" }}>
        <div className="flex-1 min-w-0">
          {approveError && (
            <p className="text-xs font-semibold" style={{ color: "#BE123C" }}>{approveError}</p>
          )}
        </div>
        <SaveInternalButton onSaveInternal={onSaveInternal} busy={approving} />
        <button onClick={onPreview}
          className="text-xs font-semibold px-4 py-2 rounded-xl border transition-all duration-150 flex-shrink-0"
          style={{ backgroundColor: "white", color: "#1A2B4A", borderColor: "#E2E8F0" }}
          onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-1px)")}
          onMouseLeave={e => (e.currentTarget.style.transform = "none")}>
          Preview Letter
        </button>
        <button onClick={handleApproveClick} disabled={approving}
          className="text-xs font-semibold px-4 py-2 rounded-xl border transition-all duration-150 flex-shrink-0"
          style={{ backgroundColor: approving ? "#F4F6F9" : "#1A2B4A",
            color: approving ? "#94A3B8" : "#fff",
            borderColor: approving ? "#E2E8F0" : "#1A2B4A",
            cursor: approving ? "default" : "pointer" }}
          onMouseEnter={e => { if (!approving) e.currentTarget.style.transform = "translateY(-1px)"; }}
          onMouseLeave={e => (e.currentTarget.style.transform = "none")}>
          {approving ? "Approving…" : "Approve"}
        </button>
      </div>
    </div>
  );
}

// ─── Send confirmation modal ──────────────────────────────────────────────────

function ConfirmSendModal({
  patientName, emails, sending, success, onCancel, onConfirm,
}: {
  patientName: string; emails: ContactEntry[];
  sending: boolean; success: boolean; onCancel: () => void; onConfirm: (recipientEmails: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(emails[0]?.value ? [emails[0].value] : [])
  );

  const toggle = (value: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value); else next.add(value);
      return next;
    });
  };

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ backgroundColor: "rgba(26,43,74,0.45)" }}>
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4"
          style={{ boxShadow: "0 24px 64px rgb(26 43 74 / 0.25)" }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center rounded-full flex-shrink-0"
              style={{ width: 36, height: 36, backgroundColor: "#F0FDF4" }}>
              <svg viewBox="0 0 16 16" fill="none" stroke="#16A34A" strokeWidth={2}
                strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M3 8l4 4 6-7"/>
              </svg>
            </div>
            <h3 className="text-base font-bold" style={{ color: "#16A34A" }}>Email sent!</h3>
          </div>
          <p className="text-sm" style={{ color: "#1A2B4A" }}>Email sent to patient successfully.</p>
        </div>
      </div>
    );
  }

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
          <div className="flex items-baseline gap-3 mb-3">
            <span className="text-xs font-semibold w-14 flex-shrink-0" style={{ color: "#64748B" }}>Patient</span>
            <span className="text-sm font-semibold" style={{ color: "#1A2B4A" }}>{patientName}</span>
          </div>
          <span className="text-xs font-semibold block mb-1.5" style={{ color: "#64748B" }}>Send to</span>
          <div className="space-y-1.5">
            {emails.map((entry, i) => (
              <label key={entry.value} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={selected.has(entry.value)}
                  onChange={() => toggle(entry.value)} className="flex-shrink-0" />
                <span className="text-sm" style={{ color: "#1A2B4A", wordBreak: "break-all" }}>{entry.value}</span>
                {i === 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}>PRIMARY</span>
                )}
                {entry.label && (
                  <span className="text-xs flex-shrink-0" style={{ color: "#94A3B8" }}>({entry.label})</span>
                )}
              </label>
            ))}
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
          <button onClick={() => onConfirm(Array.from(selected))} disabled={sending || selected.size === 0}
            className="text-xs font-semibold px-4 py-2 rounded-xl border transition-all duration-150"
            style={{ backgroundColor: sending || selected.size === 0 ? "#F4F6F9" : "#1A2B4A",
              color: sending || selected.size === 0 ? "#94A3B8" : "#fff",
              borderColor: sending || selected.size === 0 ? "#E2E8F0" : "#1A2B4A",
              cursor: sending || selected.size === 0 ? "default" : "pointer" }}>
            {sending ? "Sending…" : "Send PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Ready for Patient card ───────────────────────────────────────────────────

function ReadyCard({
  letter, onPreview, onExportPdf, onMarkSent, onSaveInternal,
}: {
  letter: StoredLetter;
  onPreview: () => void;
  onExportPdf: () => void;
  onMarkSent: () => Promise<void>;
  onSaveInternal: () => Promise<void>;
}) {
  const colors       = STATUS_COLORS["Ready for Patient"];
  const d            = (letter.data ?? {}) as Record<string, unknown>;
  const emails       = (d.emails   as ContactEntry[]) || [];
  const patientName  = (d.name     as string) || letter.patientName || "";
  const patientId    = (d.patId    as string) || letter.patientId   || "";
  const location     = (d.location as string) || "";
  const date         = letter.letterDate || "";

  const [showModal,    setShowModal]    = useState(false);
  const [sending,      setSending]      = useState(false);
  const [sendSuccess,  setSendSuccess]  = useState(false);
  const [noEmailError, setNoEmailError] = useState(false);
  const [sendError,    setSendError]    = useState("");

  const handleSendClick = () => {
    setSendError("");
    if (emails.length === 0) { setNoEmailError(true); setTimeout(() => setNoEmailError(false), 4000); return; }
    setShowModal(true);
  };

  const confirmSend = async (recipientEmails: string[]) => {
    setSending(true);
    setSendError("");
    try {
      const res = await fetch("/api/send-patient-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ letterId: letter.id, recipientEmails }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Send failed.");
      setSending(false);
      setSendSuccess(true);
      // Trigger cleanup of old letters after email confirmed sent
      setTimeout(async () => {
        await onMarkSent();
      }, 1500);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send.");
      setSending(false);
    }
  };

  return (
    <>
      {showModal && (
        <ConfirmSendModal patientName={patientName} emails={emails}
          sending={sending} success={sendSuccess} onCancel={() => { if (!sending && !sendSuccess) setShowModal(false); }} onConfirm={confirmSend} />
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

        {/* Export actions */}
        <div className="flex items-center gap-2 mt-3 pt-3 flex-wrap" style={{ borderTop: "1px solid #F1F5F9" }}>
          <button onClick={onPreview}
            className="text-xs font-semibold px-3 py-2 rounded-xl border transition-all duration-150"
            style={{ backgroundColor: "white", color: "#64748B", borderColor: "#E2E8F0" }}
            onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-1px)")}
            onMouseLeave={e => (e.currentTarget.style.transform = "none")}>
            Preview Final Letter
          </button>
          <button onClick={onExportPdf}
            className="text-xs font-semibold px-3 py-2 rounded-xl border transition-all duration-150"
            style={{ backgroundColor: "#0D9488", color: "#fff", borderColor: "#0D9488" }}
            onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-1px)")}
            onMouseLeave={e => (e.currentTarget.style.transform = "none")}>
            Export Final PDF
          </button>
          <SaveInternalButton onSaveInternal={onSaveInternal} busy={sending} />
        </div>

        {/* Send PDF to patient */}
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
            {!noEmailError && !sendError && emails.length > 0 && (
              <p className="text-xs truncate" style={{ color: "#94A3B8" }}>
                Will send to: {emails[0].value}
                {emails.length > 1 && ` (+${emails.length - 1} more available)`}
              </p>
            )}
            {!noEmailError && !sendError && emails.length === 0 && (
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
  const colors = STATUS_COLORS["Sent to Patient"];

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
  const [letters, setLetters]       = useState<StoredLetter[]>([]);
  const [deleteError, setDeleteError] = useState("");

  const loadAll = async () => {
    const supabase = createClient();
    const statuses: LetterStatus[] = ["Waiting for Anat", "Reviewed", "Ready for Patient", "Sent to Patient"];
    const all = await getLettersByStatus(supabase, statuses);
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    setLetters(all.filter((l) =>
      l.status !== "Sent to Patient" ||
      (l.sentAt ? new Date(l.sentAt).getTime() > cutoff : true)
    ));
  };

  useEffect(() => { loadAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleApprove = async (letter: StoredLetter) => {
    const supabase = createClient();
    await updateLetterStatus(supabase, letter.id, "Ready for Patient", {
      approvedAt: new Date().toISOString(),
    });
    await loadAll();
  };

  const handleUploadReviewed = async (letter: StoredLetter, filename: string) => {
    const supabase = createClient();
    await updateLetterStatus(supabase, letter.id, "Reviewed", {
      reviewedAt:     new Date().toISOString(),
      reviewFileName: filename,
    });
    await loadAll();
  };

  const handleSaveInternal = async (letter: StoredLetter) => {
    const supabase = createClient();
    await updateLetterStatus(supabase, letter.id, "saved_internal", {
      savedInternalAt: new Date().toISOString(),
    });
    if (letter.patientDbId) {
      await deleteOldLettersForPatient(supabase, letter.id, letter.patientDbId);
    }
    await loadAll();
  };

  const handleDeleteLetter = async (letter: StoredLetter) => {
    const supabase = createClient();
    await deleteLetter(supabase, letter.id);
    await loadAll();
  };

  const handleRecallForEdit = async (letter: StoredLetter) => {
    const supabase = createClient();
    await updateLetterStatus(supabase, letter.id, "Draft");
    localStorage.setItem("letter_current_id",          letter.id);
    localStorage.setItem("letter_current_supabase_id", letter.id);
    sessionStorage.setItem("letter_supabase_id",  letter.id);
    sessionStorage.setItem("load_from_supabase",  "1");
    sessionStorage.removeItem("letter_draft");
    router.push("/workspace/letter-editor");
  };

  const handleMarkSent = async (letter: StoredLetter) => {
    const supabase = createClient();
    setDeleteError("");
    try {
      if (letter.patientDbId) {
        const deletedIds = await deleteOldLettersForPatient(supabase, letter.id, letter.patientDbId);
        if (deletedIds.length > 0) removeLettersById(deletedIds);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete old letter(s).";
      setDeleteError(msg);
      console.error("[handleMarkSent] cleanup failed:", err);
    } finally {
      await loadAll();
    }
  };

  const navigateToPreview = (letter: StoredLetter, exportMode = false) => {
    if (letter.data) {
      // Strip pictures before storing — they're large base64 blobs that can
      // exhaust the 5 MB localStorage quota. The preview page fetches them
      // from Supabase separately when they're missing.
      const { pictures: _p, ...dataWithoutPictures } = letter.data as Record<string, unknown>;
      try {
        localStorage.setItem("letter_preview", JSON.stringify(dataWithoutPictures));
      } catch {
        // Quota exceeded — preview page will fall back to Supabase fetch
        localStorage.removeItem("letter_preview");
      }
    }
    localStorage.setItem("letter_current_id",          letter.id);
    localStorage.setItem("letter_current_supabase_id", letter.id);
    localStorage.setItem("letter_return_to", "review");
    localStorage.setItem("letter_status",              letter.status);
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

      {deleteError && (
        <div className="px-6 sm:px-8 mb-4">
          <div className="rounded-xl px-4 py-3 flex items-start gap-2"
            style={{ backgroundColor: "#FFF1F2", border: "1px solid #FECDD3" }}>
            <svg viewBox="0 0 16 16" fill="none" stroke="#BE123C" strokeWidth={1.75}
              strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0 mt-px">
              <circle cx="8" cy="8" r="7"/><path d="M8 5v4M8 11h.01"/>
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold" style={{ color: "#BE123C" }}>
                Email sent, but old letter cleanup failed:
              </p>
              <p className="text-xs mt-0.5" style={{ color: "#9F1239" }}>{deleteError}</p>
              <p className="text-xs mt-1" style={{ color: "#9F1239" }}>
                The letter was sent successfully. You can delete the old letter manually from All Letters.
              </p>
            </div>
            <button onClick={() => setDeleteError("")} className="flex-shrink-0 mt-0.5"
              style={{ color: "#BE123C", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2}
                strokeLinecap="round" className="w-3 h-3"><path d="M2 2l8 8M10 2l-8 8"/></svg>
            </button>
          </div>
        </div>
      )}

      <Section title="Waiting for Anat" count={waiting.length}
        badge={{ bg: "#EDE9FE", text: "#7C3AED" }} empty="No letters waiting for review">
        {waiting.map((l) => (
          <WaitingCard key={l.id} letter={l}
            onPreview={() => navigateToPreview(l, false)}
            onEditLetter={() => handleRecallForEdit(l)}
            onDeleteLetter={() => handleDeleteLetter(l)}
            onSaveInternal={() => handleSaveInternal(l)} />
        ))}
      </Section>

      <Section title="Reviewed — Needs Doctor Approval" count={reviewed.length}
        badge={{ bg: "#FFE4E6", text: "#BE123C" }} empty="No letters pending approval">
        {reviewed.map((l) => (
          <ReviewedCard key={l.id} letter={l}
            onPreview={() => navigateToPreview(l, false)}
            onApprove={() => handleApprove(l)}
            onSaveInternal={() => handleSaveInternal(l)} />
        ))}
      </Section>


      <Section title="Ready for Patient" count={ready.length}
        badge={{ bg: "#CCFBF1", text: "#0D9488" }} empty="No letters ready for patient yet">
        {ready.map((l) => (
          <ReadyCard key={l.id} letter={l}
            onPreview={() => navigateToPreview(l, false)}
            onExportPdf={() => navigateToPreview(l, true)}
            onMarkSent={() => handleMarkSent(l)}
            onSaveInternal={() => handleSaveInternal(l)} />
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
