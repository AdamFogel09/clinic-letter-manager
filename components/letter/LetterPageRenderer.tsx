"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import LetterHeader from "@/components/letter/LetterHeader";
import LetterFooter from "@/components/letter/LetterFooter";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LungRow {
  id: number;
  date: string; fev1l: string; fev1p: string; fvcl: string; fvcp: string;
  ratio: string; fef: string; tlcl: string; tlc: string; rvl: string; rv: string;
  dlco: string; kco: string; feno: string; meta: string; walk: string; hwbmi: string;
}

export interface LetterData {
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
    ekg:           Array<{ id: string; date: string; result: string }>;
    echo:          Array<{ id: string; date: string; result: string }>;
    blood:         Array<{ id: string; date: string; testType: string; details: string }>;
    bronchWash:    Array<{ id: string; date: string; selected: string[]; microbiology: string; cytology: string; cellCounts: string }>;
    bronchBiopsy:  Array<{ id: string; date: string; selected: string[]; pathology: string; microbiology: string }>;
    ebus:          Array<{ id: string; date: string; selected: string[]; cytology: string }>;
    pleuralFluid:  Array<{ id: string; date: string; selected: string[]; cytology: string; microbiology: string; biochemistry: string; cellCounts: string }>;
    pleuralBiopsy: Array<{ id: string; date: string; selected: string[]; pathology: string; microbiology: string }>;
    otherTests:    Array<{ id: string; date: string; testName: string; result: string }>;
  };
  planStepsEN: string[]; planStepsHE: string[];
  lungRows: LungRow[];
  pictures: string[];
  inhalers: Array<{ id: string; name: string; link: string; imageUrl: string }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDisplayDate(d: string): string {
  const [dd, mm, yyyy] = (d || "").split("/");
  if (!dd || !mm || !yyyy) return d || "";
  return `${dd} / ${mm} / ${yyyy}`;
}

function hasTestData(val: unknown): boolean {
  if (typeof val === "string") return val.trim().length > 0;
  if (Array.isArray(val)) return val.some(item => hasTestData(item));
  if (val && typeof val === "object") {
    return Object.entries(val as Record<string, unknown>)
      .filter(([k]) => k !== "id" && k !== "selected")
      .some(([, v]) => hasTestData(v));
  }
  return false;
}

function TRGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div data-atomic="1" style={{ marginBottom: 10 }}>
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

function textChunks(text: string): string[] {
  if (!text?.trim()) return [text || ""];
  const paras = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  return paras.length > 1 ? paras : [text];
}

// ─── Section components ───────────────────────────────────────────────────────

function DocSection({ title, titleHe, heOnly, plain, children }: {
  title: string; titleHe?: string; heOnly?: boolean; plain?: boolean; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 0 }}>
      {heOnly ? (
        <div className="section-bar-he" style={{
          width: "100%", backgroundColor: "#D8DEF6", border: "1px solid #000000", height: 26,
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 8, boxSizing: "border-box",
        }}>
          <div className="section-title-text" style={{
            margin: 0, padding: 0, lineHeight: 1, fontSize: 13, fontWeight: 700,
            color: "#1E106E", fontFamily: "Arial, Helvetica, sans-serif",
            letterSpacing: "0.04em", display: "block",
          }}>
            {title}
          </div>
        </div>
      ) : plain ? (
        <div style={{
          display: "flex", direction: "ltr",
          justifyContent: titleHe ? "space-between" : "flex-start",
          alignItems: "baseline", borderBottom: "1px solid #160B5C",
          paddingBottom: 5, marginBottom: 10,
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1A2B4A", margin: 0, letterSpacing: "0.03em" }}>
            {title}
          </h3>
          {titleHe && (
            <span style={{ fontSize: 15, fontWeight: 700, color: "#1A2B4A", letterSpacing: "0.04em" }}>
              {titleHe}
            </span>
          )}
        </div>
      ) : (
        <div className="section-bar" style={{
          width: "100%", backgroundColor: "#E2E2E2", border: "1px solid #AAAAAA", height: 23,
          display: "flex", alignItems: "center",
          justifyContent: (title && titleHe) ? "space-between" : "center",
          padding: "0 10px", marginBottom: 10, boxSizing: "border-box",
        }}>
          {title && (
            <div className="section-title-text" style={{
              fontSize: 12, fontWeight: 700, color: "#1A2B4A", margin: 0, padding: 0,
              lineHeight: 1, fontFamily: "Arial, Helvetica, sans-serif",
              letterSpacing: "0.05em", display: "block",
            }}>
              {title}
            </div>
          )}
          {titleHe && (
            <div className="section-title-text" style={{
              fontSize: title ? 11 : 12, fontWeight: 700, color: "#1A2B4A", margin: 0, padding: 0,
              lineHeight: 1, fontFamily: "Arial, Helvetica, sans-serif",
              direction: "rtl", display: "block",
            }}>
              {titleHe}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

function LV({ label, value, boldValue }: { label: string; value: string; boldValue?: boolean }) {
  if (!value) return null;
  return (
    <div className="pdf-lv" style={{ display: "flex", gap: 8, marginBottom: 4 }}>
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

const DATE_LINE = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
const OLD_LABEL = /^(Review date:|תאריך ביקורת:)\s*/i;

function SummaryBlock({ text, rtl }: { text: string; rtl?: boolean }) {
  if (!text?.trim()) return null;
  const lines = text.split("\n").map(l => l.replace(OLD_LABEL, ""));
  return (
    <p style={{
      fontSize: 13, color: "#1A2B4A", lineHeight: 1.7, margin: 0,
      direction: rtl ? "rtl" : "ltr", textAlign: rtl ? "right" : "left",
      whiteSpace: "pre-wrap",
    }}>
      {lines.map((line, i) => (
        <span key={i}>
          {DATE_LINE.test(line.trim()) ? (
            <strong style={{ fontFamily: "Arial, Helvetica, sans-serif", color: "#1E106E", fontSize: 13 }}>
              {line}
            </strong>
          ) : line}
          {i < lines.length - 1 ? "\n" : null}
        </span>
      ))}
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

// ─── Page layout ──────────────────────────────────────────────────────────────

const PAGE_H = 1160;
const CONTENT_H = 825;
const SECTION_GAP = 12;

interface SectionDef {
  id: string;
  estimate: number;
  render: () => React.ReactNode;
  isContinuation?: boolean;
}

function A4Page({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="a4-page"
      data-export-page="true"
      style={{
        width: "100%",
        maxWidth: 820,
        height: PAGE_H,
        backgroundColor: "white",
        fontFamily: "Arial, Helvetica, sans-serif",
        boxShadow: "0 4px 6px -1px rgb(0 0 0/0.07), 0 20px 40px rgb(26 43 74/0.10)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <LetterHeader />
      <div className="a4-page-content" style={{
        flex: "1 0 0",
        minHeight: 0,
        overflow: "hidden",
        padding: "14px 40px 16px",
      }}>
        {children}
      </div>
      <LetterFooter />
    </div>
  );
}

function PageBuilder({ sections, onReady }: { sections: SectionDef[]; onReady?: () => void }) {
  const [pages,     setPages]    = useState<SectionDef[][]>([]);
  const [measuring, setMeasuring] = useState(true);
  const measureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!measuring) return;

    const doMeasure = async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));

      const container = measureRef.current;
      if (!container) return;

      const imgs    = Array.from(container.querySelectorAll<HTMLImageElement>("img"));
      const pending = imgs.filter(img => !img.complete || img.naturalWidth === 0);
      if (pending.length > 0) {
        await Promise.all(pending.map(img => new Promise<void>(r => {
          img.onload = img.onerror = () => r();
        })));
        await new Promise<void>(r => requestAnimationFrame(() => r()));
      }

      const sectionEls = Array.from(container.querySelectorAll<HTMLElement>(":scope > [data-sid]"));
      const heights = sectionEls.map(el => el.getBoundingClientRect().height);

      const SAFE_H = CONTENT_H - 10;
      const packed: SectionDef[][] = [];
      let curPage: SectionDef[] = [];
      let curH = 0;

      sections.forEach((sec, i) => {
        const h   = heights[i] ?? 0;
        const gap = curPage.length > 0 ? (sec.isContinuation ? 5 : SECTION_GAP) : 0;
        if (curPage.length === 0 || curH + gap + h <= SAFE_H) {
          curPage.push(sec);
          curH += gap + h;
        } else {
          packed.push(curPage);
          curPage = [sec];
          curH    = h;
        }
      });
      if (curPage.length > 0) packed.push(curPage);

      setPages(packed);
      setMeasuring(false);
    };

    doMeasure();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measuring]);

  // Signal render completion after pages paint
  useEffect(() => {
    if (!measuring && pages.length > 0 && onReady) {
      requestAnimationFrame(() => requestAnimationFrame(() => onReady()));
    }
  }, [measuring, pages, onReady]);

  return (
    <>
      {measuring && (
        <div
          ref={measureRef}
          aria-hidden="true"
          style={{
            position: "fixed", top: 0, left: "-9999px", width: 740,
            visibility: "hidden", pointerEvents: "none", zIndex: -1,
          }}
        >
          {sections.map(s => (
            <div key={s.id} data-sid={s.id} style={s.isContinuation ? { marginTop: -7 } : undefined}>
              {s.render()}
            </div>
          ))}
        </div>
      )}
      {!measuring && pages.map((pageSections, pi) => (
        <A4Page key={pi}>
          <div style={{ display: "flex", flexDirection: "column", gap: SECTION_GAP }}>
            {pageSections.map(s => (
              <div key={s.id} data-sid={s.id} style={s.isContinuation ? { marginTop: -7 } : undefined}>
                {s.render()}
              </div>
            ))}
          </div>
        </A4Page>
      ))}
    </>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function LetterPageRenderer({
  data,
  onReady,
}: {
  data: LetterData;
  onReady?: () => void;
}) {
  const d = data;

  const sections = useMemo((): SectionDef[] => {
    if (!d) return [];

    const age        = calcAge(d.bDay, d.bMonth, d.bYear);
    const dob        = [d.bDay, d.bMonth, d.bYear].filter(Boolean).join(" / ");
    const letterDate = [d.dateDay, d.dateMonth, d.dateYear].filter(Boolean).join(" / ");

    const examRows = ([
      ["Appearance",               d.appearance],
      ["Fingernail Clubbing",      d.clubbing],
      ["Cervical Lymphadenopathy", d.lymph],
      ["Blood Pressure",           d.bp],
      ["Pulse",                    d.pulse   ? `${d.pulse} bpm`            : ""],
      ["Respiratory Rate",         d.rr      ? `${d.rr} breaths/min`       : ""],
      ["SpO2",                     d.spo2    ? `${d.spo2}%`                : ""],
      ["Heart Sounds",             d.heartSounds === "Other" ? `Other — ${d.heartOther}` : d.heartSounds],
      ["Lung Auscultation",        d.lungAusc === "Other"   ? `Other — ${d.lungOther}`  : d.lungAusc],
      ["Other Findings",           d.otherFindings],
    ] as [string, string][]).filter(([, v]) => !!v);

    const arr: SectionDef[] = [];

    // ── 1. Patient header ────────────────────────────────────────────────────
    arr.push({
      id: "patient-header", estimate: 190,
      render: () => (
        <div>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 0 }}>
            <div className="lungistitute-wrap" style={{ backgroundColor: "#1E106E", isolation: "isolate" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/lungistitute.png" alt="מרפאת ריאות" style={{ maxHeight: 52, objectFit: "contain", display: "block", mixBlendMode: "screen" }} />
            </div>
          </div>
          <div style={{ borderBottom: "1px solid #160B5C", marginBottom: 10 }} />
          <div className="pdf-patient-cols" style={{ display: "flex" }}>
            <div style={{ flex: 1 }}>
              <LV label="Name"          value={d.name} />
              <LV label="ID"            value={d.patId} />
              <LV label="Date of Birth" value={dob} />
              <LV label="Age / Gender"  value={[age, d.gender].filter(Boolean).join("  ·  ")} />
              <LV label="Email"         value={d.email} />
              <LV label="Phone"         value={formatPhone(d.phone)} />
            </div>
            <div style={{ flex: 1, paddingLeft: 8 }}>
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
      ),
    });

    // ── 2. Hebrew diagnosis ──────────────────────────────────────────────────
    if (d.diagHE?.trim()) {
      const chunks = textChunks(d.diagHE);
      arr.push({ id: "diag-he", estimate: 60,
        render: () => <DocSection title="אבחנה" heOnly><TextBlock text={chunks[0]} rtl /></DocSection> });
      chunks.slice(1).forEach((c, i) => arr.push({ id: `diag-he-${i + 1}`, estimate: 35,
        render: () => <TextBlock text={c} rtl /> }));
    }

    // ── 3. Hebrew summary ────────────────────────────────────────────────────
    if (d.sumHE?.trim()) {
      const chunks = textChunks(d.sumHE);
      arr.push({ id: "sum-he", estimate: 80,
        render: () => <DocSection title="סיכום" heOnly><SummaryBlock text={chunks[0]} rtl /></DocSection> });
      chunks.slice(1).forEach((c, i) => arr.push({ id: `sum-he-${i + 1}`, estimate: 35,
        render: () => <SummaryBlock text={c} rtl /> }));
    }

    // ── 4. Hebrew plan ───────────────────────────────────────────────────────
    if (d.planStepsHE?.some(s => s.trim())) {
      const heSteps = d.planStepsHE.filter(s => s.trim());
      arr.push({
        id: "plan-he", estimate: 60,
        render: () => (
          <DocSection title="תכנית" heOnly>
            <div style={{ direction: "rtl" }}>
              <div data-atomic="1" style={{ display: "flex", gap: 6, marginBottom: 5, alignItems: "flex-start", textAlign: "right" }}>
                <span style={{ fontSize: 13, fontWeight: 700, flexShrink: 0, color: "#1A2B4A", lineHeight: 1.8 }}>1.</span>
                <span style={{ fontSize: 13, color: "#1A2B4A", lineHeight: 1.8, flex: 1 }}>{heSteps[0]}</span>
              </div>
            </div>
          </DocSection>
        ),
      });
      heSteps.slice(1).forEach((step, idx) => arr.push({
        id: `plan-he-${idx + 1}`, estimate: 35, isContinuation: true,
        render: () => (
          <div data-atomic="1" style={{ display: "flex", gap: 6, marginBottom: 5, alignItems: "flex-start", textAlign: "right", direction: "rtl" }}>
            <span style={{ fontSize: 13, fontWeight: 700, flexShrink: 0, color: "#1A2B4A", lineHeight: 1.8 }}>{idx + 2}.</span>
            <span style={{ fontSize: 13, color: "#1A2B4A", lineHeight: 1.8, flex: 1 }}>{step}</span>
          </div>
        ),
      }));
    }

    // ── 5. English diagnosis ─────────────────────────────────────────────────
    if (d.diagEN?.trim()) {
      const chunks = textChunks(d.diagEN);
      arr.push({ id: "diag-en", estimate: 60,
        render: () => <DocSection title="Diagnosis"><TextBlock text={chunks[0]} /></DocSection> });
      chunks.slice(1).forEach((c, i) => arr.push({ id: `diag-en-${i + 1}`, estimate: 35,
        render: () => <TextBlock text={c} /> }));
    }

    // ── 6. English summary ───────────────────────────────────────────────────
    if (d.sumEN?.trim()) {
      const chunks = textChunks(d.sumEN);
      arr.push({ id: "sum-en", estimate: 80,
        render: () => <DocSection title="Summary"><SummaryBlock text={chunks[0]} /></DocSection> });
      chunks.slice(1).forEach((c, i) => arr.push({ id: `sum-en-${i + 1}`, estimate: 35,
        render: () => <SummaryBlock text={c} /> }));
    }

    // ── 7. Medical history ───────────────────────────────────────────────────
    if (d.medHistory?.trim()) {
      const chunks = textChunks(d.medHistory);
      arr.push({ id: "med-history", estimate: 60,
        render: () => <DocSection title="Medical History"><TextBlock text={chunks[0]} /></DocSection> });
      chunks.slice(1).forEach((c, i) => arr.push({ id: `med-history-${i + 1}`, estimate: 35,
        render: () => <TextBlock text={c} /> }));
    }

    // ── 8. Family history ────────────────────────────────────────────────────
    if (d.famHistory?.trim()) {
      const chunks = textChunks(d.famHistory);
      arr.push({ id: "fam-history", estimate: 60,
        render: () => <DocSection title="Family History"><TextBlock text={chunks[0]} /></DocSection> });
      chunks.slice(1).forEach((c, i) => arr.push({ id: `fam-history-${i + 1}`, estimate: 35,
        render: () => <TextBlock text={c} /> }));
    }

    // ── 9. Medications ───────────────────────────────────────────────────────
    if (d.medications?.length > 0) {
      arr.push({
        id: "medications", estimate: 50,
        render: () => (
          <DocSection title="Medications">
            <p data-atomic="1" style={{ fontSize: 13, color: "#1A2B4A", lineHeight: 1.8, margin: "0 0 2px" }}>• {d.medications[0]}</p>
          </DocSection>
        ),
      });
      d.medications.slice(1).forEach((m, idx) => arr.push({
        id: `medications-${idx + 1}`, estimate: 26, isContinuation: true,
        render: () => <p data-atomic="1" style={{ fontSize: 13, color: "#1A2B4A", lineHeight: 1.8, margin: "0 0 2px" }}>• {m}</p>,
      }));
    }

    // ── 10. Allergies ────────────────────────────────────────────────────────
    if (d.allergies?.length > 0) {
      arr.push({
        id: "allergies", estimate: 50,
        render: () => (
          <DocSection title="Allergies">
            <p data-atomic="1" style={{ fontSize: 13, color: "#1A2B4A", lineHeight: 1.8, margin: "0 0 2px" }}>• {d.allergies[0]}</p>
          </DocSection>
        ),
      });
      d.allergies.slice(1).forEach((a, idx) => arr.push({
        id: `allergies-${idx + 1}`, estimate: 26, isContinuation: true,
        render: () => <p data-atomic="1" style={{ fontSize: 13, color: "#1A2B4A", lineHeight: 1.8, margin: "0 0 2px" }}>• {a}</p>,
      }));
    }

    // ── 11. Vaccinations ─────────────────────────────────────────────────────
    if (d.vaccinations?.length > 0) arr.push({
      id: "vaccinations", estimate: 50,
      render: () => (
        <DocSection title="Vaccinations">
          <p style={{ fontSize: 13, color: "#1A2B4A", margin: 0 }}>{d.vaccinations.join(", ")}</p>
        </DocSection>
      ),
    });

    // ── 12. Examination ──────────────────────────────────────────────────────
    if (examRows.length > 0) arr.push({
      id: "examination", estimate: examRows.length * 22 + 35,
      render: () => (
        <DocSection title="Examination">
          <div className="pdf-exam-grid" style={{ display: "grid", gridTemplateColumns: "max-content 1fr max-content 1fr", columnGap: 12, rowGap: 5 }}>
            {examRows.map(([label, value]) => (
              <div key={label} style={{ display: "contents" }}>
                <span style={{ fontSize: 13, color: "#475569", fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: 13, color: "#1A2B4A" }}>{value}</span>
              </div>
            ))}
          </div>
        </DocSection>
      ),
    });

    // ── 13. English plan ─────────────────────────────────────────────────────
    if (d.planStepsEN?.some(s => s.trim())) {
      const enSteps = d.planStepsEN.filter(s => s.trim());
      arr.push({
        id: "plan-en", estimate: 60,
        render: () => (
          <DocSection title="Plan">
            <div>
              <div data-atomic="1" style={{ display: "flex", gap: 6, marginBottom: 5, alignItems: "flex-start" }}>
                <span style={{ fontSize: 13, fontWeight: 700, flexShrink: 0, minWidth: 18, color: "#1A2B4A", lineHeight: 1.8 }}>1.</span>
                <span style={{ fontSize: 13, color: "#1A2B4A", lineHeight: 1.8, flex: 1 }}>{enSteps[0]}</span>
              </div>
            </div>
          </DocSection>
        ),
      });
      enSteps.slice(1).forEach((step, idx) => arr.push({
        id: `plan-en-${idx + 1}`, estimate: 35, isContinuation: true,
        render: () => (
          <div data-atomic="1" style={{ display: "flex", gap: 6, marginBottom: 5, alignItems: "flex-start" }}>
            <span style={{ fontSize: 13, fontWeight: 700, flexShrink: 0, minWidth: 18, color: "#1A2B4A", lineHeight: 1.8 }}>{idx + 2}.</span>
            <span style={{ fontSize: 13, color: "#1A2B4A", lineHeight: 1.8, flex: 1 }}>{step}</span>
          </div>
        ),
      }));
    }

    // ── 14. Test results ─────────────────────────────────────────────────────
    if (hasTestData(d.testResults)) {
      type TrItem = { key: string; node: () => React.ReactNode };
      const trItems: TrItem[] = [];

      if (d.testResults.ekg.length > 0)
        trItems.push({ key: "ekg", node: () => (
          <TRGroup label="EKG">
            {d.testResults.ekg.map((entry, idx) => (
              <div key={entry.id || idx} style={{ marginBottom: idx < d.testResults.ekg.length - 1 ? 8 : 0 }}>
                {entry.date?.trim() && <p style={{ fontSize: 12, color: "#475569", margin: "0 0 3px", fontWeight: 600 }}>{formatDisplayDate(entry.date)}</p>}
                {entry.result?.trim() && <p style={{ fontSize: 13, color: "#1A2B4A", margin: 0, lineHeight: 1.6 }}>{entry.result}</p>}
              </div>
            ))}
          </TRGroup>
        ) });

      if (d.testResults.echo?.length > 0)
        trItems.push({ key: "echo", node: () => (
          <TRGroup label="Echocardiogram">
            {d.testResults.echo.map((entry, idx) => (
              <div key={entry.id ?? idx} style={{ marginBottom: d.testResults.echo.length > 1 && idx < d.testResults.echo.length - 1 ? 8 : 0 }}>
                {d.testResults.echo.length > 1 && <p style={{ fontSize: 11, fontWeight: 600, color: "#64748B", margin: "0 0 2px" }}>Entry {idx + 1}</p>}
                {entry.date?.trim() && <p style={{ fontSize: 12, color: "#475569", margin: "0 0 3px", fontWeight: 600 }}>{formatDisplayDate(entry.date)}</p>}
                <p style={{ fontSize: 13, color: "#1A2B4A", margin: 0, lineHeight: 1.6 }}>{entry.result}</p>
              </div>
            ))}
          </TRGroup>
        ) });

      if (d.testResults.blood.length > 0 && d.testResults.blood.some(e => e.testType || e.details))
        trItems.push({ key: "blood", node: () => (
          <TRGroup label="Blood Tests">
            {d.testResults.blood.map((entry, idx) => (
              <div key={entry.id || idx} style={{ marginBottom: idx < d.testResults.blood.length - 1 ? 10 : 0 }}>
                {entry.date?.trim() && <p style={{ fontSize: 12, color: "#475569", margin: "0 0 3px", fontWeight: 600 }}>{formatDisplayDate(entry.date)}</p>}
                <TRField label="Type"    value={entry.testType} />
                <TRField label="Results" value={entry.details} />
              </div>
            ))}
          </TRGroup>
        ) });

      if (d.testResults.bronchWash.length > 0 && d.testResults.bronchWash.some(e => e.microbiology || e.cytology || e.cellCounts))
        trItems.push({ key: "bronchWash", node: () => (
          <TRGroup label="Bronchoscopy Washing">
            {d.testResults.bronchWash.map((entry, idx) => (
              <div key={entry.id || idx} style={{ marginBottom: idx < d.testResults.bronchWash.length - 1 ? 10 : 0 }}>
                {entry.date?.trim() && <p style={{ fontSize: 12, color: "#475569", margin: "0 0 3px", fontWeight: 600 }}>{formatDisplayDate(entry.date)}</p>}
                <TRField label="Microbiology" value={entry.microbiology} />
                <TRField label="Cytology"     value={entry.cytology} />
                <TRField label="Cell Counts"  value={entry.cellCounts} />
              </div>
            ))}
          </TRGroup>
        ) });

      if (d.testResults.bronchBiopsy.length > 0 && d.testResults.bronchBiopsy.some(e => e.pathology || e.microbiology))
        trItems.push({ key: "bronchBiopsy", node: () => (
          <TRGroup label="Bronchoscopy Biopsy">
            {d.testResults.bronchBiopsy.map((entry, idx) => (
              <div key={entry.id || idx} style={{ marginBottom: idx < d.testResults.bronchBiopsy.length - 1 ? 10 : 0 }}>
                {entry.date?.trim() && <p style={{ fontSize: 12, color: "#475569", margin: "0 0 3px", fontWeight: 600 }}>{formatDisplayDate(entry.date)}</p>}
                <TRField label="Pathology"    value={entry.pathology} />
                <TRField label="Microbiology" value={entry.microbiology} />
              </div>
            ))}
          </TRGroup>
        ) });

      if (d.testResults.ebus.length > 0 && d.testResults.ebus.some(e => e.cytology))
        trItems.push({ key: "ebus", node: () => (
          <TRGroup label="EBUS">
            {d.testResults.ebus.map((entry, idx) => (
              <div key={entry.id || idx} style={{ marginBottom: idx < d.testResults.ebus.length - 1 ? 10 : 0 }}>
                {entry.date?.trim() && <p style={{ fontSize: 12, color: "#475569", margin: "0 0 3px", fontWeight: 600 }}>{formatDisplayDate(entry.date)}</p>}
                <TRField label="Cytology" value={entry.cytology} />
              </div>
            ))}
          </TRGroup>
        ) });

      if (d.testResults.pleuralFluid.length > 0 && d.testResults.pleuralFluid.some(e => e.cytology || e.microbiology || e.biochemistry || e.cellCounts))
        trItems.push({ key: "pleuralFluid", node: () => (
          <TRGroup label="Pleural Fluid">
            {d.testResults.pleuralFluid.map((entry, idx) => (
              <div key={entry.id || idx} style={{ marginBottom: idx < d.testResults.pleuralFluid.length - 1 ? 10 : 0 }}>
                {entry.date?.trim() && <p style={{ fontSize: 12, color: "#475569", margin: "0 0 3px", fontWeight: 600 }}>{formatDisplayDate(entry.date)}</p>}
                <TRField label="Cytology"     value={entry.cytology} />
                <TRField label="Microbiology" value={entry.microbiology} />
                <TRField label="Biochemistry" value={entry.biochemistry} />
                <TRField label="Cell Counts"  value={entry.cellCounts} />
              </div>
            ))}
          </TRGroup>
        ) });

      if (d.testResults.pleuralBiopsy.length > 0 && d.testResults.pleuralBiopsy.some(e => e.pathology || e.microbiology))
        trItems.push({ key: "pleuralBiopsy", node: () => (
          <TRGroup label="Pleural Biopsy">
            {d.testResults.pleuralBiopsy.map((entry, idx) => (
              <div key={entry.id || idx} style={{ marginBottom: idx < d.testResults.pleuralBiopsy.length - 1 ? 10 : 0 }}>
                {entry.date?.trim() && <p style={{ fontSize: 12, color: "#475569", margin: "0 0 3px", fontWeight: 600 }}>{formatDisplayDate(entry.date)}</p>}
                <TRField label="Pathology"    value={entry.pathology} />
                <TRField label="Microbiology" value={entry.microbiology} />
              </div>
            ))}
          </TRGroup>
        ) });

      if (d.testResults.otherTests.length > 0 && d.testResults.otherTests.some(e => e.testName || e.result))
        trItems.push({ key: "otherTests", node: () => (
          <TRGroup label="Other Test">
            {d.testResults.otherTests.map((entry, idx) => (
              <div key={entry.id || idx} style={{ marginBottom: idx < d.testResults.otherTests.length - 1 ? 10 : 0 }}>
                {entry.date?.trim() && <p style={{ fontSize: 12, color: "#475569", margin: "0 0 3px", fontWeight: 600 }}>{formatDisplayDate(entry.date)}</p>}
                {entry.testName?.trim() && <TRField label="Test" value={entry.testName} />}
                {entry.result?.trim() && <p style={{ fontSize: 13, color: "#1A2B4A", margin: 0, lineHeight: 1.6 }}>{entry.result}</p>}
              </div>
            ))}
          </TRGroup>
        ) });

      if (trItems.length > 0) {
        arr.push({ id: "test-results", estimate: 80,
          render: () => <DocSection title="Test Results">{trItems[0].node()}</DocSection> });
        trItems.slice(1).forEach(item => arr.push({
          id: `test-results-${item.key}`, estimate: 80, render: item.node }));
      }
    }

    // ── 15. Lung function ────────────────────────────────────────────────────
    if (d.lungRows?.length > 0) {
      const renderLungRow = (row: typeof d.lungRows[0]) => {
        const mainFields:  [string, string][] = [["FEV1 L", row.fev1l], ["FEV1 %", row.fev1p], ["FVC L", row.fvcl], ["FVC %", row.fvcp], ["FEV1/FVC %", row.ratio], ["FEF 25-75 %", row.fef]];
        const extraFields: [string, string][] = [["TLC L", row.tlcl], ["TLC %", row.tlc], ["RV L", row.rvl], ["RV %", row.rv], ["DLCO %", row.dlco], ["KCO %", row.kco], ["FeNO", row.feno], ["Metacholine", row.meta], ["6 Min Walk", row.walk], ["Ht/Wt/BMI", row.hwbmi]];
        const hasMain  = mainFields.some(([, v]) => v?.trim());
        const hasExtra = extraFields.some(([, v]) => v?.trim());
        return (
          <div key={row.id} data-atomic="1" style={{ border: "1.5px solid #160B5C", borderRadius: 10, overflow: "hidden" }}>
            {row.date && (
              <div style={{ backgroundColor: "#F2A56B", padding: "5px 12px" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#000000" }}>Date: {formatDisplayDate(row.date)}</span>
              </div>
            )}
            <div style={{ padding: "5px 8px" }}>
              {(hasMain || hasExtra) && (
                <div className="pdf-lung-grid" style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: "4px 6px" }}>
                  {[...mainFields, ...extraFields].map(([label, val]) => (
                    <div key={label} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: "#475569", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.02em" }}>{label}</div>
                      <div style={{ fontSize: 13, color: "#1A2B4A", fontWeight: 600 }}>{val?.trim() || "—"}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      };
      arr.push({
        id: "lung-function", estimate: 100,
        render: () => (
          <DocSection title="" titleHe="תפקוד ריאות">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {renderLungRow(d.lungRows[0])}
            </div>
          </DocSection>
        ),
      });
      d.lungRows.slice(1).forEach((row, idx) => arr.push({
        id: `lung-function-${idx + 1}`, estimate: 95, isContinuation: true,
        render: () => renderLungRow(row),
      }));
    }

    // ── 16. Inhalers ─────────────────────────────────────────────────────────
    if (d.inhalers?.some(inh => inh.name?.trim())) {
      const activeInhalers = d.inhalers.filter(inh => inh.name?.trim());
      const renderInhaler = (inh: typeof d.inhalers[0], key: string | number) => (
        <div key={key} data-atomic="1" style={{ display: "flex", gap: 16, alignItems: "center", padding: "10px 14px", border: "1px solid #E2E8F0", borderRadius: 12, backgroundColor: "#FAFBFF" }}>
          <div style={{ width: 72, height: 72, borderRadius: 10, backgroundColor: "#EBF3FB", border: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
            {inh.imageUrl
              /* eslint-disable-next-line @next/next/no-img-element */
              ? <img src={inh.imageUrl} alt={inh.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              : <InhalerIconSmall />
            }
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#1A2B4A", margin: "0 0 4px" }}>{inh.name}</p>
            {inh.link && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <svg viewBox="0 0 16 16" fill="none" stroke="#4A90D9" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12, flexShrink: 0 }}>
                  <path d="M7 3H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V9M9 1h6m0 0v6m0-6L7 9"/>
                </svg>
                <a href={inh.link} data-pdf-link={inh.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#4A90D9", textDecoration: "none", fontWeight: 500 }}>
                  Watch video guide on RightBreathe
                </a>
                <span style={{ fontSize: 11, color: "#64748B", fontWeight: 400 }}>
                  (גלול עד למטה אחרי כניסה לקישור בכדי לצפות בסרטון ההדרכה)
                </span>
              </div>
            )}
          </div>
        </div>
      );
      arr.push({
        id: "inhalers", estimate: 100,
        render: () => (
          <DocSection title="" titleHe="סרטון המסביר איך להשתמש במשאף שלך">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {renderInhaler(activeInhalers[0], activeInhalers[0].id ?? 0)}
            </div>
          </DocSection>
        ),
      });
      activeInhalers.slice(1).forEach((inh, idx) => arr.push({
        id: `inhalers-${idx + 1}`, estimate: 90, isContinuation: true,
        render: () => renderInhaler(inh, inh.id ?? idx + 1),
      }));
    }

    // ── 17. Pictures ─────────────────────────────────────────────────────────
    if (d.pictures?.length > 0) arr.push({
      id: "pictures",
      estimate: Math.ceil(d.pictures.length / 2) * 300 + 40,
      render: () => (
        <DocSection title="תמונות">
          <div style={{ display: "grid", gridTemplateColumns: d.pictures.length === 1 ? "1fr" : "1fr 1fr", gap: 16 }}>
            {d.pictures.map((src, i) => (
              <div key={i} style={{ overflow: "hidden", border: "2px solid #000000", backgroundColor: "#ffffff" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Image ${i + 1}`} style={{ width: "100%", display: "block", objectFit: "contain", maxHeight: 280, backgroundColor: "#ffffff" }} />
              </div>
            ))}
          </div>
        </DocSection>
      ),
    });

    // ── 18. Important notes + stamp ──────────────────────────────────────────
    arr.push({
      id: "important-notes", estimate: 380,
      render: () => (
        <div data-atomic="1">
          <div className="section-bar-he" style={{
            width: "100%", backgroundColor: "#E2E2E2", border: "1px solid #AAAAAA", height: 26,
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 10, boxSizing: "border-box",
          }}>
            <div className="section-title-text" style={{
              margin: 0, padding: 0, lineHeight: 1, fontSize: 13, fontWeight: 700,
              color: "#1A2B4A", fontFamily: "Arial, Helvetica, sans-serif",
              letterSpacing: "0.04em", display: "block",
            }}>
              נקודות חשובות
            </div>
          </div>

          <div>
            {([
              "מכתב זה הוא מסמך סודי המיועד רק למטופל, או למטפל מועמד ואנשי מקצוע בתחום הבריאות המעורבים בטיפול הרפואי הישיר במטופל. אם מסמך זה התקבל בטעות, אנא החזר אותו מיד לכתובת: lungdrsumit@gmail.com .",
              "יש להעביר מכתב זה לרופא המשפחה כדי לעיין בתוכנית הניהול והחקירה.",
              "כל ביקור במרפאה (כולל ביקורות מעקב ולאחר בדיקות) נדרשות בתשלום.",
            ] as string[]).map((text, i) => {
              const color = i === 2 ? "#DC2626" : "#160B5C";
              return (
                <div key={i} style={{ display: "flex", direction: "rtl", gap: 6, alignItems: "flex-start", marginBottom: 4 }}>
                  <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 700, lineHeight: 1.5, color }}>{i + 1}.</span>
                  <span style={{ flex: 1, fontSize: 13, lineHeight: 1.5, color, textAlign: "right" }}>{text}</span>
                </div>
              );
            })}
          </div>

          <div style={{ borderTop: "1px solid #160B5C", marginTop: 10 }} />
          <div style={{ display: "flex", justifyContent: "center", marginTop: 24 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/stamp.png" alt="Official Stamp" style={{ width: 180, height: 180, objectFit: "contain" }} />
          </div>
        </div>
      ),
    });

    return arr;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d]);

  const builderKey = d
    ? `${d.name}|${d.patId}|${d.dateDay}-${d.dateMonth}-${d.dateYear}`
    : "empty";

  if (!sections.length) return null;

  return (
    <PageBuilder key={builderKey} sections={sections} onReady={onReady} />
  );
}
