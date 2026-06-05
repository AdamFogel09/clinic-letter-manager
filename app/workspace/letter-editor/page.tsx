"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { upsertLetter } from "@/lib/letterStore";
import { createClient } from "@/lib/supabase/client";
import {
  saveLetter as saveLetterToSupabase, updateLetterStatus, getLetterById, supabaseLetterToStoredLetter,
  type SummarySection, type DiagnosisItem, type PlanStep,
  sectionsToSumEN, sectionsToSumHE,
  diagItemsToEN, diagItemsToHE,
  planStepsToENArr, planStepsToHEArr,
} from "@/lib/supabase/letters";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EkgEntry           { id: string; date: string; result: string; }
interface BloodEntry         { id: string; date: string; testType: string; details: string; }
interface BronchWashEntry    { id: string; date: string; selected: string[]; microbiology: string; cytology: string; cellCounts: string; }
interface BronchBiopsyEntry  { id: string; date: string; selected: string[]; pathology: string; microbiology: string; }
interface EbusEntry          { id: string; date: string; selected: string[]; cytology: string; }
interface PleuralFluidEntry  { id: string; date: string; selected: string[]; cytology: string; microbiology: string; biochemistry: string; cellCounts: string; }
interface PleuralBiopsyEntry { id: string; date: string; selected: string[]; pathology: string; microbiology: string; }
interface OtherTestEntry     { id: string; date: string; testName: string; result: string; }
interface EchoEntry          { id: string; date: string; result: string; }
interface InhalerEntry       { id: string; name: string; link: string; imageUrl: string; }

interface TestResultsData {
  ekg:           EkgEntry[];
  echo:          EchoEntry[];
  blood:         BloodEntry[];
  bronchWash:    BronchWashEntry[];
  bronchBiopsy:  BronchBiopsyEntry[];
  ebus:          EbusEntry[];
  pleuralFluid:  PleuralFluidEntry[];
  pleuralBiopsy: PleuralBiopsyEntry[];
  otherTests:    OtherTestEntry[];
}

const DEFAULT_TEST_RESULTS: TestResultsData = {
  ekg:           [],
  echo:          [],
  blood:         [],
  bronchWash:    [],
  bronchBiopsy:  [],
  ebus:          [],
  pleuralFluid:  [],
  pleuralBiopsy: [],
  otherTests:    [],
};

function newTRId(): string {
  return `tr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}
function newEkgEntry():           EkgEntry           { return { id: newTRId(), date: "", result: "" }; }
function newBloodEntry():         BloodEntry         { return { id: newTRId(), date: "", testType: "", details: "" }; }
function newBronchWashEntry():    BronchWashEntry    { return { id: newTRId(), date: "", selected: [], microbiology: "", cytology: "", cellCounts: "" }; }
function newBronchBiopsyEntry():  BronchBiopsyEntry  { return { id: newTRId(), date: "", selected: [], pathology: "", microbiology: "" }; }
function newEbusEntry():          EbusEntry          { return { id: newTRId(), date: "", selected: [], cytology: "" }; }
function newPleuralFluidEntry():  PleuralFluidEntry  { return { id: newTRId(), date: "", selected: [], cytology: "", microbiology: "", biochemistry: "", cellCounts: "" }; }
function newPleuralBiopsyEntry(): PleuralBiopsyEntry { return { id: newTRId(), date: "", selected: [], pathology: "", microbiology: "" }; }
function newOtherTestEntry():     OtherTestEntry     { return { id: newTRId(), date: "", testName: "", result: "" }; }
function newEchoEntry():          EchoEntry          { return { id: newTRId(), date: "", result: "" }; }
function newInhalerId(): string { return `inh-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`; }
function newInhalerEntry(): InhalerEntry { return { id: newInhalerId(), name: "", link: "", imageUrl: "" }; }

function migrateTestResults(raw: unknown): TestResultsData {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_TEST_RESULTS };
  const r = raw as Record<string, unknown>;
  const sel = ((r.selected ?? {}) as Record<string, unknown>);
  const res: TestResultsData = { ...DEFAULT_TEST_RESULTS };

  // EKG: old formats were string or { value, details }; new is array
  if (Array.isArray(r.ekg)) res.ekg = r.ekg as EkgEntry[];
  else if (r.ekg && typeof r.ekg === "object") {
    const o = r.ekg as { value?: string; details?: string };
    if (o.value) res.ekg = [{ id: newTRId(), date: "", result: o.value === "Other" ? (o.details || "") : o.value }];
  } else if (typeof r.ekg === "string" && (r.ekg as string).trim()) {
    res.ekg = [{ id: newTRId(), date: "", result: r.ekg as string }];
  }

  // Echo: old was string + echoEnabled boolean; new is array
  if (Array.isArray(r.echo)) res.echo = r.echo as EchoEntry[];
  else if (typeof r.echo === "string" && (r.echo as string).trim()) {
    res.echo = [{ id: newTRId(), date: "", result: r.echo as string }];
  }

  // Blood: old was { date, testType, details }; new is array
  if (Array.isArray(r.blood)) res.blood = r.blood as BloodEntry[];
  else if (r.blood && typeof r.blood === "object") {
    const o = r.blood as { date?: string; testType?: string; details?: string };
    if (o.date || o.testType || o.details) res.blood = [{ id: newTRId(), date: o.date || "", testType: o.testType || "", details: o.details || "" }];
  }

  const arrSel = (key: string): string[] => Array.isArray(sel[key]) ? sel[key] as string[] : [];

  // BronchWash
  if (Array.isArray(r.bronchWash)) res.bronchWash = r.bronchWash as BronchWashEntry[];
  else if (r.bronchWash && typeof r.bronchWash === "object") {
    const o = r.bronchWash as Record<string, string>;
    if (o.microbiology || o.cytology || o.cellCounts)
      res.bronchWash = [{ id: newTRId(), date: "", selected: arrSel("bronchWash"), microbiology: o.microbiology || "", cytology: o.cytology || "", cellCounts: o.cellCounts || "" }];
  }

  // BronchBiopsy
  if (Array.isArray(r.bronchBiopsy)) res.bronchBiopsy = r.bronchBiopsy as BronchBiopsyEntry[];
  else if (r.bronchBiopsy && typeof r.bronchBiopsy === "object") {
    const o = r.bronchBiopsy as Record<string, string>;
    if (o.pathology || o.microbiology)
      res.bronchBiopsy = [{ id: newTRId(), date: "", selected: arrSel("bronchBiopsy"), pathology: o.pathology || "", microbiology: o.microbiology || "" }];
  }

  // EBUS
  if (Array.isArray(r.ebus)) res.ebus = r.ebus as EbusEntry[];
  else if (r.ebus && typeof r.ebus === "object") {
    const o = r.ebus as Record<string, string>;
    if (o.cytology)
      res.ebus = [{ id: newTRId(), date: "", selected: arrSel("ebus"), cytology: o.cytology || "" }];
  }

  // PleuralFluid
  if (Array.isArray(r.pleuralFluid)) res.pleuralFluid = r.pleuralFluid as PleuralFluidEntry[];
  else if (r.pleuralFluid && typeof r.pleuralFluid === "object") {
    const o = r.pleuralFluid as Record<string, string>;
    if (o.cytology || o.microbiology || o.biochemistry || o.cellCounts)
      res.pleuralFluid = [{ id: newTRId(), date: "", selected: arrSel("pleuralFluid"), cytology: o.cytology || "", microbiology: o.microbiology || "", biochemistry: o.biochemistry || "", cellCounts: o.cellCounts || "" }];
  }

  // PleuralBiopsy
  if (Array.isArray(r.pleuralBiopsy)) res.pleuralBiopsy = r.pleuralBiopsy as PleuralBiopsyEntry[];
  else if (r.pleuralBiopsy && typeof r.pleuralBiopsy === "object") {
    const o = r.pleuralBiopsy as Record<string, string>;
    if (o.pathology || o.microbiology)
      res.pleuralBiopsy = [{ id: newTRId(), date: "", selected: arrSel("pleuralBiopsy"), pathology: o.pathology || "", microbiology: o.microbiology || "" }];
  }

  // OtherTests: old was string field "otherTest"; new is array "otherTests"
  if (Array.isArray(r.otherTests)) res.otherTests = r.otherTests as OtherTestEntry[];
  else if (typeof r.otherTest === "string" && (r.otherTest as string).trim()) {
    res.otherTests = [{ id: newTRId(), date: "", testName: "", result: r.otherTest as string }];
  }

  return res;
}

interface LungRow {
  id: number;
  date: string; fev1l: string; fev1p: string; fvcl: string; fvcp: string;
  ratio: string; fef: string; tlcl: string; tlc: string; rvl: string; rv: string;
  dlco: string; kco: string; feno: string; meta: string; walk: string; hwbmi: string;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

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

// ─── Style constants ──────────────────────────────────────────────────────────

const ic = "w-full px-4 py-2.5 rounded-xl border bg-white text-sm focus:outline-none transition-colors duration-150";
const is = { borderColor: "#E2E8F0", color: "#1A2B4A" };
const lc = "block text-xs font-semibold uppercase tracking-wide mb-1.5";
const ls = { color: "#64748B" };
const ta = "w-full px-4 py-3 rounded-xl border bg-white text-sm focus:outline-none resize-none transition-colors duration-150";

// ─── Sub-components ───────────────────────────────────────────────────────────

function F({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className={lc} style={ls}>{label}</label>
      {children}
    </div>
  );
}

function TranslateBtn({ onClick, disabled, loading, label = "Translate to Hebrew" }: {
  onClick?: () => void; disabled?: boolean; loading?: boolean; label?: string;
}) {
  const isOff = disabled || loading;
  return (
    <button type="button" onClick={onClick} disabled={isOff}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all duration-150 ${isOff ? "cursor-not-allowed opacity-60" : "hover:-translate-y-px"}`}
      style={{ borderColor: isOff ? "#E2E8F0" : "#4A90D9", color: isOff ? "#CBD5E1" : "#4A90D9" }}>
      {loading ? (
        <>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="w-3.5 h-3.5 animate-spin">
            <path d="M8 2a6 6 0 1 1-4.24 1.76"/>
          </svg>
          Translating...
        </>
      ) : (
        <>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
            <circle cx="8" cy="8" r="6.5"/>
            <path d="M1.5 8h13M8 1.5a10 10 0 0 1 0 13M8 1.5a10 10 0 0 0 0 13"/>
          </svg>
          {label}
        </>
      )}
    </button>
  );
}

function SplitDateInput({ value, onChange, validateFuture = false, onEnterFromLast }: {
  value: string; onChange: (v: string) => void; validateFuture?: boolean;
  onEnterFromLast?: (from: HTMLInputElement) => void;
}) {
  const parts = (value || "//").split("/");
  const dd = parts[0] ?? ""; const mm = parts[1] ?? ""; const yyyy = parts[2] ?? "";
  const mmRef = useRef<HTMLInputElement>(null);
  const yyyyRef = useRef<HTMLInputElement>(null);
  const set = (d: string, m: string, y: string) => onChange(`${d}/${m}/${y}`);
  const err = (() => {
    if (!dd || !mm || !yyyy || yyyy.length < 4) return null;
    const dt = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
    if (dt.getMonth() !== parseInt(mm) - 1) return "This date does not exist.";
    if (validateFuture && dt > new Date()) return "Test date cannot be in the future.";
    return null;
  })();
  return (
    <div>
      <div className="flex items-center gap-2">
        <input inputMode="numeric" maxLength={2} value={dd} placeholder="DD"
          onChange={e => { const v = e.target.value.replace(/\D/g,"").slice(0,2); set(v,mm,yyyy); if(v.length===2) mmRef.current?.focus(); }}
          className="w-14 px-3 py-2.5 rounded-xl border bg-white text-sm text-center focus:outline-none transition-colors duration-150" style={is}/>
        <span style={{color:"#CBD5E1"}}>/</span>
        <input ref={mmRef} inputMode="numeric" maxLength={2} value={mm} placeholder="MM"
          onChange={e => { const v = e.target.value.replace(/\D/g,"").slice(0,2); set(dd,v,yyyy); if(v.length===2) yyyyRef.current?.focus(); }}
          className="w-14 px-3 py-2.5 rounded-xl border bg-white text-sm text-center focus:outline-none transition-colors duration-150" style={is}/>
        <span style={{color:"#CBD5E1"}}>/</span>
        <input ref={yyyyRef} inputMode="numeric" maxLength={4} value={yyyy} placeholder="YYYY"
          onChange={e => { const v = e.target.value.replace(/\D/g,"").slice(0,4); set(dd,mm,v); }}
          onKeyDown={e => { if (e.key === "Enter" && onEnterFromLast) { e.preventDefault(); onEnterFromLast(e.currentTarget); } }}
          className="w-20 px-3 py-2.5 rounded-xl border bg-white text-sm text-center focus:outline-none transition-colors duration-150" style={is}/>
      </div>
      {err && <p className="text-xs mt-1.5 font-medium" style={{color:"#BE123C"}}>{err}</p>}
    </div>
  );
}

function NavySelect({ value, onChange, options, placeholder = "Select" }: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border bg-white text-sm focus:outline-none transition-all duration-150"
        style={{ borderColor: value ? "#1A2B4A" : "#E2E8F0", color: value ? "#1A2B4A" : "#94A3B8" }}>
        <span style={{ fontWeight: value ? 500 : 400 }}>{value || placeholder}</span>
        <svg viewBox="0 0 16 16" fill="none" stroke="#1A2B4A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
          className="w-3.5 h-3.5 flex-shrink-0"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl z-30 overflow-hidden"
          style={{ border: "1px solid #E2E8F0", boxShadow: "0 4px 6px -1px rgb(0 0 0/0.07), 0 8px 24px rgb(26 43 74/0.10)" }}>
          {options.map(opt => (
            <button key={opt} type="button" onClick={() => { onChange(opt); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-sm transition-colors duration-100"
              style={{ color: opt === value ? "#1A2B4A" : "#64748B", fontWeight: opt === value ? 600 : 400, backgroundColor: opt === value ? "#F4F6F9" : "transparent" }}
              onMouseEnter={e => { if (opt !== value) (e.currentTarget as HTMLElement).style.backgroundColor = "#F4F6F9"; }}
              onMouseLeave={e => { if (opt !== value) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}>
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function YesNo({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2">
      {["Yes", "No"].map(opt => (
        <button key={opt} type="button" onClick={() => onChange(opt)}
          className="flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all duration-150"
          style={{ borderColor: value === opt ? "#1A2B4A" : "#E2E8F0", backgroundColor: value === opt ? "#1A2B4A" : "white", color: value === opt ? "white" : "#64748B" }}>
          {opt}
        </button>
      ))}
    </div>
  );
}

function SectionCard({ title, titleHe, children }: { title: string; titleHe?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border p-6"
      style={{ borderColor: "#E2E8F0", boxShadow: "0 1px 3px 0 rgb(0 0 0/0.06), 0 4px 16px 0 rgb(26 43 74/0.05)" }}>
      <div className="flex items-baseline justify-between pb-3 mb-5" style={{ borderBottom: "2px solid #1A2B4A" }}>
        <h2 className="text-base font-bold" style={{ color: "#1A2B4A" }}>{title}</h2>
        {titleHe && <span className="text-sm font-semibold" style={{ color: "#1A2B4A" }}>{titleHe}</span>}
      </div>
      {children}
    </div>
  );
}

function TestGroup({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ borderBottom: last ? "none" : "1px solid #F4F6F9", paddingBottom: last ? 0 : 18 }}>
      <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: "#64748B", letterSpacing: "0.08em" }}>{title}</p>
      {children}
    </div>
  );
}

function InhalerIcon() {
  return (
    <svg viewBox="0 0 40 56" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 36, height: 50 }}>
      <rect x="8" y="2" width="24" height="34" rx="6" fill="#CBD5E1" />
      <rect x="4" y="32" width="32" height="11" rx="5.5" fill="#94A3B8" />
      <rect x="15" y="43" width="10" height="9" rx="3" fill="#64748B" />
      <rect x="11" y="10" width="18" height="14" rx="3" fill="white" opacity="0.35" />
      <circle cx="20" cy="17" r="3" fill="white" opacity="0.45" />
    </svg>
  );
}

// Defined at module level so its identity is stable across re-renders.
// Defining it inside renderSection() would create a new function on every
// keystroke, causing React to unmount/remount and lose input focus.
function SubToggle({ fields, selected, values, onToggle, onChange }: {
  fields: [string, string][];
  selected: string[];
  values: Record<string, string>;
  onToggle: (field: string) => void;
  onChange: (field: string, value: string) => void;
}) {
  return (
    <>
      <div className="flex flex-wrap gap-2 mb-3">
        {fields.map(([key, label]) => {
          const on = selected.includes(key);
          return (
            <button key={key} type="button" onClick={() => onToggle(key)}
              className="px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all duration-150"
              style={{ borderColor: on ? "#1A2B4A" : "#E2E8F0", backgroundColor: on ? "#1A2B4A" : "white", color: on ? "white" : "#64748B" }}>
              {on ? `✓ ${label}` : `+ ${label}`}
            </button>
          );
        })}
      </div>
      {fields.filter(([k]) => selected.includes(k)).map(([key, label]) => (
        <div key={key} className="mb-3">
          <label className={lc} style={ls}>{label}</label>
          <textarea className={ta} style={is} rows={2}
            value={values[key] || ""}
            onChange={e => onChange(key, e.target.value)}
            placeholder={`Enter ${label.toLowerCase()} results`} />
        </div>
      ))}
      {selected.length === 0 && (
        <p className="text-xs" style={{ color: "#CBD5E1" }}>Select options above to add results.</p>
      )}
    </>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: "patient",      label: "Patient Details" },
  { id: "clinical",     label: "Clinical Notes" },
  { id: "allergies",    label: "Allergies" },
  { id: "vaccinations", label: "Vaccinations" },
  { id: "examination",  label: "Examination" },
  { id: "tests",        label: "Test Results" },
  { id: "lung",         label: "Lung Function" },
  { id: "pictures",     label: "Pictures" },
  { id: "inhalers",     label: "Inhalers" },
  { id: "review",       label: "Review" },
];

const GROUP_FIELDS: Record<string, [string, string][]> = {
  bronchWash:   [["microbiology","Microbiology"],["cytology","Cytology"],["cellCounts","Cell Counts"]],
  bronchBiopsy: [["pathology","Pathology"],["microbiology","Microbiology"]],
  ebus:         [["cytology","Cytology"]],
  pleuralFluid: [["cytology","Cytology"],["microbiology","Microbiology"],["biochemistry","Biochemistry"],["cellCounts","Cell Counts"]],
  pleuralBiopsy:[["pathology","Pathology"],["microbiology","Microbiology"]],
};

const LUNG_MAIN:  [string, keyof LungRow][] =[["FEV1 L","fev1l"],["FEV1 %","fev1p"],["FVC L","fvcl"],["FVC %","fvcp"],["FEV1/FVC %","ratio"],["FEF 25-75 %","fef"]];
const LUNG_EXTRA: [string, keyof LungRow][] = [["TLC L","tlcl"],["TLC %","tlc"],["RV L","rvl"],["RV %","rv"],["DLCO %","dlco"],["KCO %","kco"],["FeNO","feno"],["Metacholine","meta"],["6 Min Walk","walk"],["Ht/Wt/BMI","hwbmi"]];
const VAX_OPTIONS = ["None","Influenza","Prevenar","Pneumovax","Covid 19","RSV"];

const INHALER_CATALOG = [
  { name: "Salbutamol 100mcg MDI (Ventolin)", link: "https://www.rightbreathe.com/?search=salbutamol" },
  { name: "Budesonide/Formoterol 160/4.5mcg Turbuhaler (Symbicort)", link: "https://www.rightbreathe.com/?search=budesonide+formoterol" },
  { name: "Tiotropium 18mcg Handihaler (Spiriva)", link: "https://www.rightbreathe.com/?search=tiotropium" },
  { name: "Salmeterol/Fluticasone 25/250mcg MDI (Seretide)", link: "https://www.rightbreathe.com/?search=seretide" },
  { name: "Beclometasone 50mcg MDI (Qvar)", link: "https://www.rightbreathe.com/?search=qvar" },
  { name: "Ipratropium 20mcg MDI (Atrovent)", link: "https://www.rightbreathe.com/?search=atrovent" },
  { name: "Formoterol 12mcg Turbuhaler (Oxis)", link: "https://www.rightbreathe.com/?search=formoterol" },
  { name: "Indacaterol/Glycopyrronium Breezhaler (Ultibro)", link: "https://www.rightbreathe.com/?search=ultibro" },
  { name: "Umeclidinium/Vilanterol Ellipta (Anoro)", link: "https://www.rightbreathe.com/?search=anoro" },
  { name: "Fluticasone 250mcg Accuhaler (Flixotide)", link: "https://www.rightbreathe.com/?search=flixotide" },
  { name: "Aclidinium 322mcg Genuair (Eklira)", link: "https://www.rightbreathe.com/?search=aclidinium" },
  { name: "Glycopyrronium 44mcg Breezhaler (Seebri)", link: "https://www.rightbreathe.com/?search=glycopyrronium" },
];

// ─── Summary section helpers ──────────────────────────────────────────────────

function newSectionId(): string {
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

function todaySectionDate(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function newItemId(): string {
  return `i-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

function newStepId(): string {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

/** Convert flat diagEN/diagHE text blocks to a single structured item (backward compat). */
function flatToDiagItems(en: string, he: string): DiagnosisItem[] {
  if (!en.trim() && !he.trim()) {
    return [{ id: newItemId(), textEN: "", textHE: "", source: "new" }];
  }
  return [{ id: newItemId(), textEN: en.trim(), textHE: he.trim(), source: "copied" as const }];
}

/** Convert parallel planStepsEN/HE arrays to structured steps (backward compat). */
function flatToPlanSteps(en: string[], he: string[]): PlanStep[] {
  if (!en.length || (en.length === 1 && !en[0])) {
    return [{ id: newStepId(), textEN: "", textHE: "", source: "new" }];
  }
  return en.map((textEN, i) => ({
    id: newStepId(),
    textEN,
    textHE: he[i] || "",
    source: "copied" as const,
  }));
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LetterEditorPage() {
  const router = useRouter();
  const [active, setActive] = useState("patient");

  // Patient Details
  const [name, setName] = useState("");
  const [patId, setPatId] = useState("");
  const [bDay, setBDay] = useState(""); const [bMonth, setBMonth] = useState(""); const [bYear, setBYear] = useState("");
  const [gender, setGender] = useState("");
  const [email, setEmail] = useState(""); const [phone, setPhone] = useState("");
  const [smoking, setSmoking] = useState(""); const [pets, setPets] = useState("");
  const [occupation, setOccupation] = useState(""); const [referredBy, setReferredBy] = useState("");
  const [location, setLocation] = useState("");
  const [dateDay, setDateDay] = useState(String(new Date().getDate()).padStart(2,"0"));
  const [dateMonth, setDateMonth] = useState(String(new Date().getMonth()+1).padStart(2,"0"));
  const [dateYear, setDateYear] = useState(String(new Date().getFullYear()));

  // Diagnosis / Summary / Plan
  const [diagItems, setDiagItems] = useState<DiagnosisItem[]>([
    { id: newItemId(), textEN: "", textHE: "", source: "new" },
  ]);
  const [summarySections, setSummarySections] = useState<SummarySection[]>([
    { id: newSectionId(), date: todaySectionDate(), textEN: "", textHE: "", source: "new" },
  ]);
  const [planSteps, setPlanSteps] = useState<PlanStep[]>([
    { id: newStepId(), textEN: "", textHE: "", source: "new" },
  ]);

  // History
  const [medHistory, setMedHistory] = useState(""); const [famHistory, setFamHistory] = useState("");

  // Medications
  const [medications, setMedications] = useState<string[]>([]); const [medInput, setMedInput] = useState("");

  // Allergies
  const [allergies, setAllergies] = useState<string[]>([]); const [allergyInput, setAllergyInput] = useState("");

  // Vaccinations
  const [vaccinations, setVaccinations] = useState<string[]>([]);

  // Examination
  const [appearance, setAppearance] = useState(""); const [clubbing, setClubbing] = useState("");
  const [lymph, setLymph] = useState(""); const [bp, setBp] = useState("");
  const [pulse, setPulse] = useState(""); const [rr, setRr] = useState(""); const [spo2, setSpo2] = useState("");
  const [heartSounds, setHeartSounds] = useState(""); const [heartOther, setHeartOther] = useState("");
  const [lungAusc, setLungAusc] = useState(""); const [lungOther, setLungOther] = useState("");
  const [otherFindings, setOtherFindings] = useState("");

  // Test results
  const [testResults, setTestResults] = useState<TestResultsData>(DEFAULT_TEST_RESULTS);

  // Lung function
  const [lungRows, setLungRows] = useState<LungRow[]>([]);

  // Pictures
  const [pictures, setPictures] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inhalers
  const [inhalers, setInhalers] = useState<InhalerEntry[]>([]);
  const [inhalerSearch, setInhalerSearch] = useState("");
  const [inhalerDropdown, setInhalerDropdown] = useState(false);
  const [inhalerResults, setInhalerResults] = useState<Array<{name:string;imageUrl:string;pageUrl:string}>>([]);
  const [inhalerSearching, setInhalerSearching] = useState(false);
  const [inhalerSearchError, setInhalerSearchError] = useState("");

  // Translation loading / error states — per item/section/step
  const [translatingDiag,    setTranslatingDiag]    = useState<string | null>(null);
  const [diagTxErrors,       setDiagTxErrors]       = useState<Record<string, string>>({});
  const [translatingSection, setTranslatingSection] = useState<string | null>(null);
  const [sectionTxErrors,    setSectionTxErrors]    = useState<Record<string, string>>({});
  const [translatingPlan,    setTranslatingPlan]    = useState<string | null>(null);
  const [planTxErrors,       setPlanTxErrors]       = useState<Record<string, string>>({});
  const inhalerRef = useRef<HTMLDivElement>(null);

  // Guards the auto-save effect from firing before the initial restore is complete
  const [initialized, setInitialized] = useState(false);
  const [isUpdateMode, setIsUpdateMode] = useState(false);
  const [approvedStatus, setApprovedStatus] = useState<string>("");
  // Pending translate-overwrite confirmation (per item/section/step)
  const [txConfirm, setTxConfirm] = useState<
    | { type: "diagItem";  itemId: string }
    | { type: "summary";   sectionId: string }
    | { type: "planStep";  stepId: string }
    | null
  >(null);
  const [sendingToAnat, setSendingToAnat] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [saveDraftError, setSaveDraftError] = useState("");

  // Supabase IDs — stored as refs to avoid triggering re-renders / auto-save
  const supabasePatientIdRef = useRef<string | null>(null);
  const supabaseLetterIdRef  = useRef<string | null>(null);

  // ── Restore draft on mount ────────────────────────────────────────────────
  // Supabase is now the source of truth for patients and letters.
  // Temporary storage is used as a fallback during development.
  useEffect(() => {
    const run = async () => {
    const fromNewPatient = sessionStorage.getItem("draft_patient");

    if (fromNewPatient) {
      // Arrived from the New Patient / New Letter page — prefill patient fields,
      // start a clean letter, and capture the Supabase patient UUID for linking.
      try {
        const p = JSON.parse(fromNewPatient);
        if (p.supabase_patient_id) supabasePatientIdRef.current = p.supabase_patient_id;
        if (p.name)       setName(p.name);
        if (p.id)         setPatId(p.id);
        if (p.day)        setBDay(p.day);
        if (p.month)      setBMonth(p.month);
        if (p.year)       setBYear(p.year);
        if (p.gender)     setGender(p.gender);
        if (p.email)      setEmail(p.email);
        if (p.phone)      setPhone(p.phone);
        if (p.smoking)    setSmoking(p.smoking);
        if (p.pets)       setPets(p.pets);
        if (p.occupation) setOccupation(p.occupation);
        if (p.referredBy) setReferredBy(p.referredBy);
        if (p.location)   setLocation(p.location);
        if (p.dateDay)    setDateDay(p.dateDay);
        if (p.dateMonth)  setDateMonth(p.dateMonth);
        if (p.dateYear)   setDateYear(p.dateYear);
      } catch { /* malformed — ignore */ }
      sessionStorage.removeItem("draft_patient");
      // Restore any existing Supabase letter ID (editing an existing letter for this patient)
      const sid = sessionStorage.getItem("letter_supabase_id");
      if (sid) supabaseLetterIdRef.current = sid;
    } else {
      // If opened from Drafts / Review with load_from_supabase flag, fetch fresh from DB.
      if (sessionStorage.getItem("load_from_supabase") === "1") {
        sessionStorage.removeItem("load_from_supabase");
        const supabaseId = sessionStorage.getItem("letter_supabase_id");
        if (supabaseId) {
          supabaseLetterIdRef.current = supabaseId;
          try {
            const supabase = createClient();
            const letter = await getLetterById(supabase, supabaseId);
            if (letter) {
              if (letter.patient_id) supabasePatientIdRef.current = letter.patient_id;
              const stored = supabaseLetterToStoredLetter(letter);
              if (stored.data) {
                // Write into sessionStorage so the restoration block below can use it.
                sessionStorage.setItem("letter_draft", JSON.stringify(stored.data));
              }
            }
          } catch { /* Supabase unavailable — fall through to sessionStorage */ }
        }
      }

      // Returning to the editor (e.g. Back from Preview, or just loaded from Supabase above).
      // Restore Supabase letter ID so future saves go to the correct row.
      const sid = sessionStorage.getItem("letter_supabase_id");
      if (sid && !supabaseLetterIdRef.current) supabaseLetterIdRef.current = sid;

      // Restore full draft.
      const raw = sessionStorage.getItem("letter_draft");
      if (raw) {
        try {
          const d = JSON.parse(raw);
          if (d.name)         setName(d.name);
          if (d.patId)        setPatId(d.patId);
          if (d.bDay)         setBDay(d.bDay);
          if (d.bMonth)       setBMonth(d.bMonth);
          if (d.bYear)        setBYear(d.bYear);
          if (d.gender)       setGender(d.gender);
          if (d.email)        setEmail(d.email);
          if (d.phone)        setPhone(d.phone);
          if (d.smoking)      setSmoking(d.smoking);
          if (d.pets)         setPets(d.pets);
          if (d.occupation)   setOccupation(d.occupation);
          if (d.referredBy)   setReferredBy(d.referredBy);
          if (d.location)     setLocation(d.location);
          if (d.dateDay)      setDateDay(d.dateDay);
          if (d.dateMonth)    setDateMonth(d.dateMonth);
          if (d.dateYear)     setDateYear(d.dateYear);
          // Restore diagnosis items (fall back to splitting old flat fields)
          if (d.diagItems?.length) {
            setDiagItems(d.diagItems as DiagnosisItem[]);
          } else if (d.diagEN || d.diagHE) {
            setDiagItems(flatToDiagItems(
              (d.diagEN as string) || "",
              (d.diagHE as string) || ""
            ));
          }
          // Restore summary sections
          if (d.summarySections?.length) {
            setSummarySections(d.summarySections as SummarySection[]);
          } else if (d.sumEN || d.sumHE) {
            const lettDate = [d.dateDay, d.dateMonth, d.dateYear].filter(Boolean).join("/");
            setSummarySections([{
              id: newSectionId(),
              date: lettDate || "",
              textEN: (d.sumEN as string) || "",
              textHE: (d.sumHE as string) || "",
              source: "copied",
            }]);
          }
          // Restore plan steps (fall back to combining old parallel arrays)
          if (d.planSteps?.length) {
            setPlanSteps(d.planSteps as PlanStep[]);
          } else {
            const en = Array.isArray(d.planStepsEN) ? d.planStepsEN
                       : d.planEN ? [d.planEN as string] : [""];
            const he = Array.isArray(d.planStepsHE) ? d.planStepsHE
                       : d.planHE ? [d.planHE as string] : [];
            setPlanSteps(flatToPlanSteps(en as string[], he as string[]));
          }
          if (d.medHistory)   setMedHistory(d.medHistory);
          if (d.famHistory)   setFamHistory(d.famHistory);
          if (d.medications?.length)  setMedications(d.medications);
          if (d.allergies?.length)    setAllergies(d.allergies);
          if (d.vaccinations?.length) setVaccinations(d.vaccinations);
          if (d.appearance)   setAppearance(d.appearance);
          if (d.clubbing)     setClubbing(d.clubbing);
          if (d.lymph)        setLymph(d.lymph);
          if (d.bp)           setBp(d.bp);
          if (d.pulse)        setPulse(d.pulse);
          if (d.rr)           setRr(d.rr);
          if (d.spo2)         setSpo2(d.spo2);
          if (d.heartSounds)  setHeartSounds(d.heartSounds);
          if (d.heartOther)   setHeartOther(d.heartOther);
          if (d.lungAusc)     setLungAusc(d.lungAusc);
          if (d.lungOther)    setLungOther(d.lungOther);
          if (d.otherFindings) setOtherFindings(d.otherFindings);
          if (d.testResults) setTestResults(migrateTestResults(d.testResults));
          if (d.lungRows?.length) setLungRows(d.lungRows);
          if (d.pictures?.length) setPictures(d.pictures);
          if (d.inhalerSearch)   setInhalerSearch(d.inhalerSearch);
          if (Array.isArray(d.inhalers)) setInhalers(d.inhalers);
          else if (d.inhalerName) setInhalers([{ id: newInhalerId(), name: d.inhalerName as string, link: (d.inhalerLink as string) || "", imageUrl: (d.inhalerImageUrl as string) || "" }]);
        } catch { /* malformed — ignore */ }
      }
    }

    // Detect update mode — set by All Letters → Create Update Letter
    if (sessionStorage.getItem("is_update_mode") === "1") {
      setIsUpdateMode(true);
      sessionStorage.removeItem("is_update_mode");
    }

    // Detect if we're editing a letter that was already approved / sent
    const approvedSt = sessionStorage.getItem("edit_from_approved_status");
    if (approvedSt) {
      setApprovedStatus(approvedSt);
      sessionStorage.removeItem("edit_from_approved_status");
    }

    setInitialized(true);
    }; // end run()
    run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-save draft on every field change ─────────────────────────────────
  // Letters are now saved to Supabase. Temporary storage is only fallback for unsaved draft state.
  useEffect(() => {
    if (!initialized) return;
    sessionStorage.setItem("letter_draft", JSON.stringify({
      name, patId, bDay, bMonth, bYear, gender, email, phone,
      smoking, pets, occupation, referredBy, location,
      dateDay, dateMonth, dateYear,
      diagItems,
      diagEN: diagItemsToEN(diagItems),
      diagHE: diagItemsToHE(diagItems),
      summarySections,
      sumEN: sectionsToSumEN(summarySections),
      sumHE: sectionsToSumHE(summarySections),
      planSteps,
      planStepsEN: planStepsToENArr(planSteps),
      planStepsHE: planStepsToHEArr(planSteps),
      medHistory, famHistory,
      medications, allergies, vaccinations,
      appearance, clubbing, lymph, bp, pulse, rr, spo2,
      heartSounds, heartOther, lungAusc, lungOther, otherFindings,
      testResults, lungRows, pictures,
      inhalerSearch, inhalers,
    }));
  }, [
    initialized,
    name, patId, bDay, bMonth, bYear, gender, email, phone,
    smoking, pets, occupation, referredBy, location,
    dateDay, dateMonth, dateYear,
    diagItems, summarySections, planSteps,
    medHistory, famHistory,
    medications, allergies, vaccinations,
    appearance, clubbing, lymph, bp, pulse, rr, spo2,
    heartSounds, heartOther, lungAusc, lungOther, otherFindings,
    testResults, lungRows, pictures,
    inhalerSearch, inhalers,
  ]);

  // Close inhaler dropdown on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (inhalerRef.current && !inhalerRef.current.contains(e.target as Node)) setInhalerDropdown(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Date input refs for auto-advance
  const bMonthRef    = useRef<HTMLInputElement>(null);
  const bYearRef     = useRef<HTMLInputElement>(null);
  const dMonthRef    = useRef<HTMLInputElement>(null);
  const dYearRef     = useRef<HTMLInputElement>(null);
  const phoneRestRef = useRef<HTMLInputElement>(null);

  // Examination Enter-key navigation refs
  const bpRef    = useRef<HTMLInputElement>(null);
  const pulseRef = useRef<HTMLInputElement>(null);
  const rrRef    = useRef<HTMLInputElement>(null);
  const spo2Ref  = useRef<HTMLInputElement>(null);

  const age = calcAge(bDay, bMonth, bYear);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  // Lung function Enter-key: focuses the next input inside the same row container.
  const handleLungKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowId: number) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const container = document.querySelector(`[data-lung-row="${rowId}"]`);
    if (!container) return;
    const inputs = Array.from(container.querySelectorAll<HTMLInputElement>("input"));
    const idx = inputs.indexOf(e.currentTarget);
    if (idx >= 0 && idx < inputs.length - 1) inputs[idx + 1].focus();
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = e => {
        if (e.target?.result) setPictures(prev => [...prev, e.target!.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleInhalerSearch = async () => {
    const q = inhalerSearch.trim();
    if (!q) return;
    setInhalerSearching(true);
    setInhalerSearchError("");
    setInhalerResults([]);
    setInhalerDropdown(false);
    try {
      const res = await fetch("/api/rightbreathe-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const json = await res.json();
      if (json.error && (!json.results || json.results.length === 0)) {
        setInhalerSearchError(json.error);
      } else if (!json.results || json.results.length === 0) {
        setInhalerSearchError("No inhalers found. Please add manually.");
      } else {
        setInhalerResults(json.results);
        setInhalerDropdown(true);
      }
    } catch {
      setInhalerSearchError("Could not search RightBreathe. Please add inhaler manually.");
    } finally {
      setInhalerSearching(false);
    }
  };

  const handlePreview = async () => {
    // Save/update the draft to Supabase before opening the preview so the preview shows the latest data.
    try { await handleSaveDraft(); } catch { /* don't block preview on save failure */ }

    const _diagEN = diagItemsToEN(diagItems);
    const _diagHE = diagItemsToHE(diagItems);
    const _sumEN  = sectionsToSumEN(summarySections);
    const _sumHE  = sectionsToSumHE(summarySections);
    const _planEN = planStepsToENArr(planSteps);
    const _planHE = planStepsToHEArr(planSteps);
    localStorage.setItem("letter_preview", JSON.stringify({
      name, patId, bDay, bMonth, bYear, gender,
      email, phone, smoking, pets, occupation, referredBy, location,
      dateDay, dateMonth, dateYear,
      diagItems, diagEN: _diagEN, diagHE: _diagHE,
      summarySections, sumEN: _sumEN, sumHE: _sumHE,
      planSteps, planStepsEN: _planEN, planStepsHE: _planHE,
      medHistory, famHistory,
      medications, allergies, vaccinations,
      appearance, clubbing, lymph, bp, pulse, rr, spo2,
      heartSounds, heartOther, lungAusc, lungOther, otherFindings,
      testResults, lungRows,
      pictures, inhalers,
    }));
    // Pass Supabase letter ID to the preview so it can update status on Send to Anat.
    if (supabaseLetterIdRef.current) {
      localStorage.setItem("letter_current_supabase_id", supabaseLetterIdRef.current);
    }
    localStorage.setItem("letter_status", "Draft");
    router.push("/workspace/letter-preview");
  };

  const handleSaveDraft = async () => {
    const letterDate = [dateDay, dateMonth, dateYear].filter(Boolean).join("/");
    let letterId = sessionStorage.getItem("letter_draft_id");
    if (!letterId) {
      letterId = `letter-${Date.now().toString(36)}`;
      sessionStorage.setItem("letter_draft_id", letterId);
    }
    localStorage.setItem("letter_current_id", letterId);

    const letterData = {
      name, patId, bDay, bMonth, bYear, gender,
      email, phone, smoking, pets, occupation, referredBy, location,
      dateDay, dateMonth, dateYear,
      diagItems,
      diagEN: diagItemsToEN(diagItems),
      diagHE: diagItemsToHE(diagItems),
      summarySections,
      sumEN: sectionsToSumEN(summarySections),
      sumHE: sectionsToSumHE(summarySections),
      planSteps,
      planStepsEN: planStepsToENArr(planSteps),
      planStepsHE: planStepsToHEArr(planSteps),
      medHistory, famHistory,
      medications, allergies, vaccinations,
      appearance, clubbing, lymph, bp, pulse, rr, spo2,
      heartSounds, heartOther, lungAusc, lungOther, otherFindings,
      testResults, lungRows,
      pictures, inhalers,
    };

    // localStorage fallback (always runs — silent backup)
    if (!letterId) {
      letterId = `letter-${Date.now().toString(36)}`;
      sessionStorage.setItem("letter_draft_id", letterId);
    }
    localStorage.setItem("letter_current_id", letterId);
    upsertLetter({
      id: letterId,
      patientName: name || "Unnamed Patient",
      patientId: patId || "",
      letterDate,
      status: "Draft",
      savedAt: new Date().toISOString(),
      data: letterData as Record<string, unknown>,
    });

    // Save to Supabase (primary source of truth)
    try {
      setSaveDraftError("");
      const supabase = createClient();
      const saved = await saveLetterToSupabase(supabase, {
        letterId:   supabaseLetterIdRef.current  ?? undefined,
        patientId:  supabasePatientIdRef.current ?? undefined,
        status:     "Draft",
        letterDate,
        letterData: letterData as Record<string, unknown>,
      });
      supabaseLetterIdRef.current = saved.id;
      sessionStorage.setItem("letter_supabase_id", saved.id);
      localStorage.setItem("letter_current_supabase_id", saved.id);
      if (approvedStatus) setApprovedStatus("");
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 2500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[handleSaveDraft] Supabase error:", err);
      setSaveDraftError(`Save failed: ${msg}`);
      setTimeout(() => setSaveDraftError(""), 6000);
    }
  };

  const handleSendToAnat = async () => {
    if (sendingToAnat) return;
    setSendingToAnat(true);

    const letterDate = [dateDay, dateMonth, dateYear].filter(Boolean).join("/");
    const letterData = {
      name, patId, bDay, bMonth, bYear, gender,
      email, phone, smoking, pets, occupation, referredBy, location,
      dateDay, dateMonth, dateYear,
      diagItems,
      diagEN: diagItemsToEN(diagItems),
      diagHE: diagItemsToHE(diagItems),
      summarySections,
      sumEN: sectionsToSumEN(summarySections),
      sumHE: sectionsToSumHE(summarySections),
      planSteps,
      planStepsEN: planStepsToENArr(planSteps),
      planStepsHE: planStepsToHEArr(planSteps),
      medHistory, famHistory,
      medications, allergies, vaccinations,
      appearance, clubbing, lymph, bp, pulse, rr, spo2,
      heartSounds, heartOther, lungAusc, lungOther, otherFindings,
      testResults, lungRows,
      pictures, inhalers,
    };
    localStorage.setItem("letter_preview", JSON.stringify(letterData));

    // Save to Supabase with "Waiting for Anat" status (primary source of truth)
    try {
      const supabase = createClient();
      const saved = await saveLetterToSupabase(supabase, {
        letterId:     supabaseLetterIdRef.current  ?? undefined,
        patientId:    supabasePatientIdRef.current ?? undefined,
        status:       "Waiting for Anat",
        letterDate,
        letterData:   letterData as Record<string, unknown>,
        sentToAnatAt: new Date().toISOString(),
      });
      if (saved?.id) {
        supabaseLetterIdRef.current = saved.id;
        sessionStorage.setItem("letter_supabase_id", saved.id);
        localStorage.setItem("letter_current_supabase_id", saved.id);
        // Letter is now in Supabase — clear the local copy of full letter data.
        localStorage.removeItem("letter_preview");
      }
    } catch (err) {
      console.warn("Supabase save failed, using localStorage fallback:", err);
    }

    // localStorage fallback
    let letterId = sessionStorage.getItem("letter_draft_id");
    if (!letterId) {
      letterId = `letter-${Date.now().toString(36)}`;
      sessionStorage.setItem("letter_draft_id", letterId);
    }
    localStorage.setItem("letter_current_id", letterId);
    upsertLetter({
      id: letterId,
      patientName: name || "Unnamed Patient",
      patientId: patId || "",
      letterDate,
      status: "Waiting for Anat",
      savedAt: new Date().toISOString(),
      data: letterData as Record<string, unknown>,
    });

    // Later this action will send an email notification to Anat with a secure link.
    localStorage.setItem("letter_just_sent", "1");
    setSendingToAnat(false);
    router.push("/workspace/anat-review");
  };

  const toggleTRSubField = (
    key: 'bronchWash' | 'bronchBiopsy' | 'ebus' | 'pleuralFluid' | 'pleuralBiopsy',
    id: string,
    field: string,
  ) => {
    type SubE = { id: string; selected: string[]; [k: string]: unknown };
    setTestResults(prev => ({
      ...prev,
      [key]: (prev[key] as unknown as SubE[]).map(e => {
        if (e.id !== id) return e;
        const on = e.selected.includes(field);
        return { ...e, selected: on ? e.selected.filter(f => f !== field) : [...e.selected, field], ...(on ? { [field]: "" } : {}) };
      }),
    }));
  };

  // Privacy rule: Do not send patient identifiers to AI.
  // Only send the selected text section and patient gender.
  const apiGender = (gender || "other").toLowerCase() as "male" | "female" | "other";

  async function callTranslate(body: Record<string, unknown>) {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceLanguage: "en", targetLanguage: "he", gender: apiGender, ...body }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Translation failed. Please try again.");
    return json;
  }

  // ── Summary section handlers ──────────────────────────────────────────────────

  const addSummarySection = () => {
    setSummarySections(prev => [
      ...prev,
      { id: newSectionId(), date: todaySectionDate(), textEN: "", textHE: "", source: "new" },
    ]);
  };

  const updateSummarySection = (id: string, updates: Partial<SummarySection>) => {
    setSummarySections(prev => prev.map(s => {
      if (s.id !== id) return s;
      const becameEdited =
        updates.textEN !== undefined && updates.textEN !== s.textEN && s.source === "copied";
      return { ...s, ...updates, source: becameEdited ? "edited" : s.source };
    }));
  };

  const removeSummarySection = (id: string) => {
    setSummarySections(prev => prev.filter(s => s.id !== id));
  };

  // ── Per-item/step translate workers ──────────────────────────────────────────

  const doTranslateDiagItem = async (id: string) => {
    const item = diagItems.find(i => i.id === id);
    if (!item?.textEN.trim()) return;
    if (item.source === "copied") return;
    setTranslatingDiag(id);
    setDiagTxErrors(prev => ({ ...prev, [id]: "" }));
    try {
      const { translatedText } = await callTranslate({ sectionType: "diagnosis", text: item.textEN });
      setDiagItems(prev => prev.map(i => i.id === id ? { ...i, textHE: translatedText } : i));
    } catch (e) {
      setDiagTxErrors(prev => ({ ...prev, [id]: e instanceof Error ? e.message : "Translation failed." }));
    } finally {
      setTranslatingDiag(null);
    }
  };

  const doTranslatePlanStep = async (id: string) => {
    const step = planSteps.find(s => s.id === id);
    if (!step?.textEN.trim()) return;
    if (step.source === "copied") return;
    setTranslatingPlan(id);
    setPlanTxErrors(prev => ({ ...prev, [id]: "" }));
    try {
      const { translatedSteps } = await callTranslate({ sectionType: "plan", planSteps: [step.textEN] });
      setPlanSteps(prev => prev.map(s => s.id === id ? { ...s, textHE: translatedSteps[0] ?? "" } : s));
    } catch (e) {
      setPlanTxErrors(prev => ({ ...prev, [id]: e instanceof Error ? e.message : "Translation failed." }));
    } finally {
      setTranslatingPlan(null);
    }
  };

  const doTranslateSummarySection = async (id: string) => {
    const section = summarySections.find(s => s.id === id);
    if (!section?.textEN.trim()) return;
    if (section.source === "copied") return;
    setTranslatingSection(id);
    setSectionTxErrors(prev => ({ ...prev, [id]: "" }));
    try {
      const { translatedText } = await callTranslate({ sectionType: "summary", text: section.textEN });
      setSummarySections(prev => prev.map(s => s.id === id ? { ...s, textHE: translatedText } : s));
    } catch (e) {
      setSectionTxErrors(prev => ({
        ...prev,
        [id]: e instanceof Error ? e.message : "Translation failed. Please try again.",
      }));
    } finally {
      setTranslatingSection(null);
    }
  };

  // ── Public translate wrappers — guard existing Hebrew before overwriting ──────

  const translateDiagItem = (id: string) => {
    const item = diagItems.find(i => i.id === id);
    if (!item?.textEN.trim()) return;
    if (item.source === "copied") return;
    if (item.textHE.trim()) { setTxConfirm({ type: "diagItem", itemId: id }); return; }
    doTranslateDiagItem(id);
  };

  const translateSummarySection = (id: string) => {
    const section = summarySections.find(s => s.id === id);
    if (!section?.textEN.trim()) return;
    if (section.source === "copied") return;
    if (section.textHE.trim()) { setTxConfirm({ type: "summary", sectionId: id }); return; }
    doTranslateSummarySection(id);
  };

  const translatePlanStep = (id: string) => {
    const step = planSteps.find(s => s.id === id);
    if (!step?.textEN.trim()) return;
    if (step.source === "copied") return;
    if (step.textHE.trim()) { setTxConfirm({ type: "planStep", stepId: id }); return; }
    doTranslatePlanStep(id);
  };

  const confirmTranslate = () => {
    const confirm = txConfirm;
    setTxConfirm(null);
    if (!confirm) return;
    if (confirm.type === "diagItem")  doTranslateDiagItem(confirm.itemId);
    else if (confirm.type === "summary")  doTranslateSummarySection(confirm.sectionId);
    else if (confirm.type === "planStep") doTranslatePlanStep(confirm.stepId);
  };

  // ── Diagnosis item handlers ───────────────────────────────────────────────────
  const addDiagItem = () => setDiagItems(prev => [...prev, { id: newItemId(), textEN: "", textHE: "", source: "new" }]);
  const updateDiagItemEN = (id: string, textEN: string) => setDiagItems(prev => prev.map(i => {
    if (i.id !== id) return i;
    return { ...i, textEN, source: i.source === "copied" ? "edited" : i.source };
  }));
  const updateDiagItemHE = (id: string, textHE: string) => setDiagItems(prev => prev.map(i =>
    i.id === id ? { ...i, textHE } : i
  ));
  const removeDiagItem = (id: string) => setDiagItems(prev => prev.filter(i => i.id !== id));

  // ── Plan step handlers ────────────────────────────────────────────────────────
  const updatePlanStepEN = (id: string, textEN: string) => setPlanSteps(prev => prev.map(s => {
    if (s.id !== id) return s;
    return { ...s, textEN, source: s.source === "copied" ? "edited" : s.source };
  }));
  const updatePlanStepHE = (id: string, textHE: string) => setPlanSteps(prev => prev.map(s =>
    s.id === id ? { ...s, textHE } : s
  ));
  const removePlanStep = (id: string) => setPlanSteps(prev => prev.filter(s => s.id !== id));
  const addPlanStep    = () => setPlanSteps(prev => [...prev, { id: newStepId(), textEN: "", textHE: "", source: "new" }]);

  const addMed = () => { if (medInput.trim()) { setMedications(m => [...m, medInput.trim()]); setMedInput(""); } };
  const removeMed = (i: number) => setMedications(m => m.filter((_, idx) => idx !== i));
  const addAllergy = () => { if (allergyInput.trim()) { setAllergies(a => [...a, allergyInput.trim()]); setAllergyInput(""); } };
  const removeAllergy = (i: number) => setAllergies(a => a.filter((_, idx) => idx !== i));

  const toggleVax = (v: string) => {
    if (v === "None") { setVaccinations(["None"]); return; }
    setVaccinations(prev => {
      const without = prev.filter(x => x !== "None");
      return without.includes(v) ? without.filter(x => x !== v) : [...without, v];
    });
  };

  const addLungRow = () => setLungRows(rows => [...rows, { id: Date.now(), date:"", fev1l:"", fev1p:"", fvcl:"", fvcp:"", ratio:"", fef:"", tlcl:"", tlc:"", rvl:"", rv:"", dlco:"", kco:"", feno:"", meta:"", walk:"", hwbmi:"" }]);
  const setLungCell = (id: number, key: keyof LungRow, value: string) =>
    setLungRows(rows => rows.map(r => r.id === id ? { ...r, [key]: value } : r));

  // Split date input helper
  const splitInput = (
    placeholder: string, maxLen: number, value: string,
    onChange: (v: string) => void, nextRef?: React.RefObject<HTMLInputElement | null>
  ) => (
    <input inputMode="numeric" placeholder={placeholder} maxLength={maxLen} value={value}
      onChange={e => { const v = e.target.value.replace(/\D/g,"").slice(0,maxLen); onChange(v); if(v.length===maxLen && nextRef?.current) nextRef.current.focus(); }}
      className={`${maxLen===4?"w-20":"w-14"} px-3 py-2.5 rounded-xl border bg-white text-sm text-center focus:outline-none transition-colors duration-150`}
      style={is} />
  );

  // ─── Section renders ──────────────────────────────────────────────────────────

  const renderSection = (): React.ReactNode => {
    switch (active) {

      case "patient": return (
        <SectionCard title="Patient Details">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
            <F label="Name"><input className={ic} style={is} value={name} onChange={e => setName(e.target.value)} placeholder="Patient full name" /></F>
            <F label="ID"><input className={ic} style={is} value={patId} onChange={e => setPatId(e.target.value)} placeholder="National ID or passport" /></F>
            <F label="Birthdate">
              <div className="flex items-center gap-2">
                {splitInput("DD",2,bDay,setBDay,bMonthRef)}
                <span style={{color:"#CBD5E1"}}>/</span>
                <input ref={bMonthRef} inputMode="numeric" placeholder="MM" maxLength={2} value={bMonth}
                  onChange={e=>{const v=e.target.value.replace(/\D/g,"").slice(0,2);setBMonth(v);if(v.length===2)bYearRef.current?.focus();}}
                  className="w-14 px-3 py-2.5 rounded-xl border bg-white text-sm text-center focus:outline-none" style={is}/>
                <span style={{color:"#CBD5E1"}}>/</span>
                <input ref={bYearRef} inputMode="numeric" placeholder="YYYY" maxLength={4} value={bYear}
                  onChange={e=>setBYear(e.target.value.replace(/\D/g,"").slice(0,4))}
                  className="w-20 px-3 py-2.5 rounded-xl border bg-white text-sm text-center focus:outline-none" style={is}/>
              </div>
              {(() => {
                if (!bDay || !bMonth || !bYear || bYear.length < 4) return null;
                const d = new Date(parseInt(bYear), parseInt(bMonth) - 1, parseInt(bDay));
                if (d.getMonth() !== parseInt(bMonth) - 1)
                  return <p className="text-xs mt-1.5 font-medium" style={{color:"#BE123C"}}>This date does not exist (e.g. 31 February).</p>;
                if (d > new Date())
                  return <p className="text-xs mt-1.5 font-medium" style={{color:"#BE123C"}}>Birthdate cannot be in the future.</p>;
                return null;
              })()}
            </F>
            <F label="Age / Gender">
              <div className="flex gap-3">
                <div className="flex-1 px-4 py-2.5 rounded-xl border bg-white text-sm flex items-center" style={{borderColor:"#E2E8F0",color:age?"#1A2B4A":"#CBD5E1"}}>
                  {age||"Auto-calculated"}
                </div>
                <div className="flex-1"><NavySelect value={gender} onChange={setGender} options={["Male","Female","Other"]} placeholder="Gender"/></div>
              </div>
            </F>
            <F label="Email"><input type="email" className={ic} style={is} value={email} onChange={e=>setEmail(e.target.value)} placeholder="Patient email address"/></F>
            <F label="Phone">
              {/* Structure: 05 [X] - [XXXXXXX]  →  saved as e.g. 050-5004009 */}
              <div className="flex items-center rounded-xl border overflow-hidden" style={{borderColor:"#E2E8F0"}}>
                {/* Fixed prefix */}
                <span className="px-3 py-2.5 bg-white text-sm font-semibold flex-shrink-0"
                  style={{color:"#94A3B8", borderRight:"1px solid #F4F6F9"}}>05</span>
                {/* 3rd digit — operator code (1 char, auto-advances) */}
                <input
                  inputMode="numeric"
                  maxLength={1}
                  value={phone.replace(/\D/g,"").slice(2,3)}
                  onChange={e => {
                    const d1 = e.target.value.replace(/\D/g,"").slice(0,1);
                    const d2 = phone.replace(/\D/g,"").slice(3,10);
                    setPhone(d1 ? ("05"+d1+(d2 ? "-"+d2 : "")) : "");
                    if (d1) phoneRestRef.current?.focus();
                  }}
                  className="w-9 py-2.5 bg-white text-sm focus:outline-none text-center"
                  style={{color:"#1A2B4A"}}
                  placeholder="0"
                />
                {/* Visual dash separator */}
                <span className="text-sm select-none" style={{color:"#94A3B8"}}>-</span>
                {/* Remaining 7 digits */}
                <input
                  ref={phoneRestRef}
                  inputMode="numeric"
                  maxLength={7}
                  value={phone.replace(/\D/g,"").slice(3,10)}
                  onChange={e => {
                    const d2 = e.target.value.replace(/\D/g,"").slice(0,7);
                    const d1 = phone.replace(/\D/g,"").slice(2,3);
                    setPhone(d1 ? ("05"+d1+"-"+d2) : ("05"+d2));
                  }}
                  className="flex-1 px-2 py-2.5 bg-white text-sm focus:outline-none"
                  style={{color:"#1A2B4A"}}
                  placeholder="0000000"
                />
              </div>
              {phone.replace(/\D/g,"").length > 2 && phone.replace(/\D/g,"").length < 10 && (
                <p className="text-xs mt-1.5 font-medium" style={{color:"#BE123C"}}>
                  Phone must be 10 digits (e.g. 050-5004009).
                </p>
              )}
            </F>
            <F label="Smoking / Vaping"><input className={ic} style={is} value={smoking} onChange={e=>setSmoking(e.target.value)} placeholder="e.g. Non-smoker, 10/day"/></F>
            <F label="Pets"><input className={ic} style={is} value={pets} onChange={e=>setPets(e.target.value)} placeholder="e.g. Dog, Cat, None"/></F>
            <F label="Occupation"><input className={ic} style={is} value={occupation} onChange={e=>setOccupation(e.target.value)} placeholder="e.g. Teacher, Retired"/></F>
            <F label="Referred By"><NavySelect value={referredBy} onChange={setReferredBy} options={["Private","Assuta","Raphael","Harel","Bwell"]}/></F>
            <F label="Location"><NavySelect value={location} onChange={setLocation} options={["HMC","Alliance Clinic TLV","TeleConsult","Update"]}/></F>
            <F label="Date">
              <div className="flex items-center gap-2">
                {splitInput("DD",2,dateDay,setDateDay,dMonthRef)}
                <span style={{color:"#CBD5E1"}}>/</span>
                <input ref={dMonthRef} inputMode="numeric" placeholder="MM" maxLength={2} value={dateMonth}
                  onChange={e=>{const v=e.target.value.replace(/\D/g,"").slice(0,2);setDateMonth(v);if(v.length===2)dYearRef.current?.focus();}}
                  className="w-14 px-3 py-2.5 rounded-xl border bg-white text-sm text-center focus:outline-none" style={is}/>
                <span style={{color:"#CBD5E1"}}>/</span>
                <input ref={dYearRef} inputMode="numeric" placeholder="YYYY" maxLength={4} value={dateYear}
                  onChange={e=>setDateYear(e.target.value.replace(/\D/g,"").slice(0,4))}
                  className="w-20 px-3 py-2.5 rounded-xl border bg-white text-sm text-center focus:outline-none" style={is}/>
              </div>
            </F>
          </div>
        </SectionCard>
      );

      case "clinical": return (
        <div className="space-y-5">

          {/* ── Diagnosis ── */}
          <SectionCard title="Diagnosis" titleHe="אבחנה">
            <div className="space-y-3">
              {diagItems.map((item) => {
                const isCopied = item.source === "copied";
                const hasMultiple = diagItems.length > 1;
                return (
                  <div key={item.id} className="space-y-2">
                    {/* Header row — only shown when there are multiple blocks */}
                    {hasMultiple && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={isCopied
                            ? { backgroundColor: "#F1F5F9", color: "#94A3B8" }
                            : { backgroundColor: "#EDE9FE", color: "#7C3AED" }}>
                          {isCopied ? "Previous" : "New Diagnosis"}
                        </span>
                        {!isCopied && (
                          <button type="button" onClick={() => removeDiagItem(item.id)}
                            className="ml-auto text-xs transition-colors duration-150"
                            style={{ color: "#CBD5E1" }}
                            onMouseEnter={e => (e.currentTarget.style.color = "#BE123C")}
                            onMouseLeave={e => (e.currentTarget.style.color = "#CBD5E1")}>
                            Remove
                          </button>
                        )}
                      </div>
                    )}
                    {/* English */}
                    {isCopied ? (
                      <div className="rounded-xl px-4 py-3" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#475569" }}>
                          {item.textEN || "—"}
                        </p>
                      </div>
                    ) : (
                      <textarea className={ta} style={is} rows={5}
                        value={item.textEN}
                        onChange={e => updateDiagItemEN(item.id, e.target.value)}
                        placeholder="Enter full diagnosis in English" />
                    )}
                    {/* Translate button */}
                    {!isCopied && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <TranslateBtn
                          onClick={() => translateDiagItem(item.id)}
                          disabled={!item.textEN.trim()}
                          loading={translatingDiag === item.id}
                          label={item.textHE.trim() ? "Retranslate to Hebrew" : "Translate to Hebrew"}
                        />
                        {item.textHE.trim() && translatingDiag !== item.id && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: "#FEF9C3", color: "#92400E" }}>
                            Hebrew exists — will ask before replacing
                          </span>
                        )}
                        {diagTxErrors[item.id] && (
                          <p className="text-xs font-medium" style={{ color: "#BE123C" }}>{diagTxErrors[item.id]}</p>
                        )}
                      </div>
                    )}
                    {/* Hebrew */}
                    {isCopied ? (
                      <div className="rounded-xl px-4 py-3" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap"
                          style={{ color: "#1A2B4A", direction: "rtl", textAlign: "right" }}>
                          {item.textHE || "—"}
                        </p>
                      </div>
                    ) : (
                      <textarea className={ta} style={{ ...is, direction: "rtl", textAlign: "right" }} rows={4}
                        value={item.textHE}
                        onChange={e => updateDiagItemHE(item.id, e.target.value)}
                        placeholder="אבחנה בעברית — לאחר תרגום" />
                    )}
                  </div>
                );
              })}
              {/* Add Diagnosis — only when all current items are copied (update mode) */}
              {diagItems.every(i => i.source === "copied") && (
                <button type="button" onClick={addDiagItem}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-150 hover:-translate-y-px"
                  style={{ borderColor: "#1A2B4A", color: "#1A2B4A" }}>
                  + Add Diagnosis
                </button>
              )}
              <p className="text-xs" style={{ color: "#94A3B8" }}>AI translation is a draft — review before finalising.</p>
            </div>
          </SectionCard>

          {/* ── Summary ── */}
          <SectionCard title="Summary" titleHe="סיכום">
            <div className="space-y-4">
              {summarySections.map((section, idx) => {
                const isCopied = section.source === "copied";
                const srcColor = section.source === "new"
                  ? { bg: "#F5F3FF", border: "#DDD6FE", badge: "#EDE9FE", badgeText: "#7C3AED", label: "New" }
                  : section.source === "edited"
                    ? { bg: "#FFFBEB", border: "#FDE68A", badge: "#FEF3C7", badgeText: "#D97706", label: "Edited" }
                    : { bg: "#F8FAFC", border: "#E2E8F0", badge: "#F1F5F9", badgeText: "#94A3B8", label: "Previous" };
                return (
                  <div key={section.id} className="rounded-2xl p-4 space-y-3"
                    style={{ border: `1px solid ${srcColor.border}`, backgroundColor: srcColor.bg }}>

                    {/* Section header: date + badge + remove */}
                    <div className="flex items-center gap-3 pb-3" style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <div className="flex items-center gap-2 flex-1 flex-wrap">
                        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#64748B" }}>
                          {isCopied ? "Previous visit" : "Review Date"}
                        </span>
                        {isCopied ? (
                          <span className="text-xs font-bold" style={{ color: "#1A2B4A" }}>{section.date || "—"}</span>
                        ) : (
                          <SplitDateInput
                            value={section.date}
                            onChange={date => updateSummarySection(section.id, { date })}
                          />
                        )}
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: srcColor.badge, color: srcColor.badgeText }}>
                        {isCopied ? "Previous — Read-only" : srcColor.label}
                      </span>
                      {!isCopied && (
                        <button type="button" onClick={() => removeSummarySection(section.id)}
                          className="text-xs flex-shrink-0 transition-colors duration-150"
                          style={{ color: "#CBD5E1" }}
                          onMouseEnter={e => (e.currentTarget.style.color = "#BE123C")}
                          onMouseLeave={e => (e.currentTarget.style.color = "#CBD5E1")}>
                          Remove
                        </button>
                      )}
                    </div>

                    {/* English */}
                    {isCopied ? (
                      <div>
                        <label className={lc} style={{ ...ls, color: "#94A3B8" }}>
                          {`Summary (English) — visit ${idx + 1}`}
                        </label>
                        <p className="text-sm px-1 py-1 leading-relaxed whitespace-pre-wrap" style={{ color: "#475569" }}>
                          {section.textEN || "—"}
                        </p>
                      </div>
                    ) : (
                      <F label={`Summary (English)${idx > 0 ? ` — visit ${idx + 1}` : ""}`}>
                        <textarea className={ta} style={is} rows={4}
                          value={section.textEN}
                          onChange={e => updateSummarySection(section.id, { textEN: e.target.value })}
                          placeholder="Enter summary for this review date" />
                      </F>
                    )}

                    {/* Translate button — only for non-locked sections */}
                    {!isCopied && (
                      <>
                        <div className="flex items-center gap-3 flex-wrap">
                          <TranslateBtn
                            onClick={() => translateSummarySection(section.id)}
                            disabled={!section.textEN.trim()}
                            loading={translatingSection === section.id}
                            label={section.textHE.trim() ? "Retranslate Section" : "Translate Section"}
                          />
                          {section.textHE.trim() && translatingSection !== section.id && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: "#FEF9C3", color: "#92400E" }}>
                              Hebrew exists — will ask before replacing
                            </span>
                          )}
                          {sectionTxErrors[section.id] && (
                            <p className="text-xs font-medium" style={{ color: "#BE123C" }}>{sectionTxErrors[section.id]}</p>
                          )}
                        </div>
                        <p className="text-xs" style={{ color: "#94A3B8" }}>AI translation is a draft — review before finalising.</p>
                      </>
                    )}

                    {/* Hebrew */}
                    {isCopied ? (
                      <div>
                        <label className={lc} style={{ ...ls, color: "#94A3B8" }}>סיכום — Summary (Hebrew) — locked</label>
                        <p className="text-sm px-1 py-1 leading-relaxed whitespace-pre-wrap"
                          style={{ color: "#1A2B4A", direction: "rtl", textAlign: "right" }}>
                          {section.textHE || "—"}
                        </p>
                      </div>
                    ) : (
                      <F label="סיכום — Summary (Hebrew)">
                        <textarea className={ta} style={{ ...is, direction: "rtl", textAlign: "right" }} rows={4}
                          value={section.textHE}
                          onChange={e => updateSummarySection(section.id, { textHE: e.target.value })}
                          placeholder="יופיע כאן לאחר תרגום — ניתן לערוך" />
                      </F>
                    )}
                  </div>
                );
              })}

              <button type="button" onClick={addSummarySection}
                className="w-full py-2.5 rounded-xl border text-xs font-semibold transition-all duration-150 hover:-translate-y-px"
                style={{ borderColor: "#DDD6FE", color: "#7C3AED", backgroundColor: "#F5F3FF" }}>
                + Add Summary Section for New Visit
              </button>
            </div>
          </SectionCard>

          {/* ── Plan ── */}
          <SectionCard title="Plan" titleHe="תכנית">
            <div className="space-y-3">
              {planSteps.map((step, idx) => {
                const srcStyle = step.source === "new"
                  ? { bg: "#F5F3FF", border: "#DDD6FE", badge: "#EDE9FE", badgeText: "#7C3AED", label: "New" }
                  : step.source === "edited"
                    ? { bg: "#FFFBEB", border: "#FDE68A", badge: "#FEF3C7", badgeText: "#D97706", label: "Edited" }
                    : { bg: "#F8FAFC", border: "#E2E8F0", badge: "#F1F5F9", badgeText: "#94A3B8", label: "Previous" };
                return (
                  <div key={step.id} className="rounded-xl p-3 space-y-2"
                    style={{ border: `1px solid ${srcStyle.border}`, backgroundColor: srcStyle.bg }}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-400 flex-shrink-0">{idx + 1}.</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: srcStyle.badge, color: srcStyle.badgeText }}>
                        {srcStyle.label}
                      </span>
                      <button type="button" onClick={() => removePlanStep(step.id)}
                        className="ml-auto text-xs flex-shrink-0 transition-colors duration-150"
                        style={{ color: "#CBD5E1" }}
                        onMouseEnter={e => (e.currentTarget.style.color = "#BE123C")}
                        onMouseLeave={e => (e.currentTarget.style.color = "#CBD5E1")}>Remove</button>
                    </div>
                    <input className={`w-full ${ic}`} style={is}
                      value={step.textEN}
                      onChange={e => updatePlanStepEN(step.id, e.target.value)}
                      placeholder={`Plan step ${idx + 1}`} />
                    {step.source !== "copied" && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <TranslateBtn
                          onClick={() => translatePlanStep(step.id)}
                          disabled={!step.textEN.trim()}
                          loading={translatingPlan === step.id}
                          label={step.textHE.trim() ? "Retranslate Step" : "Translate Step"}
                        />
                        {step.textHE.trim() && translatingPlan !== step.id && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: "#FEF9C3", color: "#92400E" }}>
                            Hebrew exists — will ask before replacing
                          </span>
                        )}
                        {planTxErrors[step.id] && (
                          <p className="text-xs font-medium" style={{ color: "#BE123C" }}>{planTxErrors[step.id]}</p>
                        )}
                      </div>
                    )}
                    <input className={`w-full ${ic}`} style={{ ...is, direction: "rtl", textAlign: "right" }}
                      value={step.textHE}
                      onChange={e => updatePlanStepHE(step.id, e.target.value)}
                      placeholder={`שלב ${idx + 1}`} />
                  </div>
                );
              })}
              <button type="button" onClick={addPlanStep}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-150 hover:-translate-y-px"
                style={{ borderColor: "#1A2B4A", color: "#1A2B4A" }}>
                + Add Step
              </button>
              <p className="text-xs" style={{ color: "#94A3B8" }}>AI translation is a draft — review before finalising.</p>
            </div>
          </SectionCard>
          <SectionCard title="Medical History">
            <F label="Medical History"><textarea className={ta} style={is} rows={8} value={medHistory} onChange={e=>setMedHistory(e.target.value)} placeholder="Enter relevant medical history"/></F>
          </SectionCard>
          <SectionCard title="Family History">
            <F label="Family History"><textarea className={ta} style={is} rows={8} value={famHistory} onChange={e=>setFamHistory(e.target.value)} placeholder="Enter relevant family history"/></F>
          </SectionCard>
          <SectionCard title="Medications">
            <div className="space-y-2 mb-5">
              {medications.length === 0 && <p className="text-sm py-4 text-center" style={{color:"#CBD5E1"}}>No medications added yet.</p>}
              {medications.map((m, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5 rounded-xl border bg-white" style={{borderColor:"#E2E8F0"}}>
                  <span className="flex-1 text-sm" style={{color:"#1A2B4A"}}>{m}</span>
                  <button onClick={()=>removeMed(i)} className="text-xs transition-colors duration-150" style={{color:"#CBD5E1"}}
                    onMouseEnter={e=>(e.currentTarget.style.color="#BE123C")} onMouseLeave={e=>(e.currentTarget.style.color="#CBD5E1")}>Remove</button>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <input className={`flex-1 ${ic}`} style={is} value={medInput} onChange={e=>setMedInput(e.target.value)}
                placeholder="Medication name and dose" onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addMed();}}}/>
              <button onClick={addMed} className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 hover:-translate-y-px" style={{backgroundColor:"#1A2B4A",color:"#fff"}}>+ Add</button>
            </div>
          </SectionCard>
        </div>
      );

      case "allergies": return (
        <SectionCard title="Allergies">
          <div className="space-y-2 mb-5">
            {allergies.length === 0 && <p className="text-sm py-4 text-center" style={{color:"#CBD5E1"}}>No allergies added yet.</p>}
            {allergies.map((a, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 rounded-xl border bg-white" style={{borderColor:"#E2E8F0"}}>
                <span className="flex-1 text-sm" style={{color:"#1A2B4A"}}>{a}</span>
                <button onClick={()=>removeAllergy(i)} className="text-xs transition-colors duration-150" style={{color:"#CBD5E1"}}
                  onMouseEnter={e=>(e.currentTarget.style.color="#BE123C")} onMouseLeave={e=>(e.currentTarget.style.color="#CBD5E1")}>Remove</button>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <input className={`flex-1 ${ic}`} style={is} value={allergyInput} onChange={e=>setAllergyInput(e.target.value)}
              placeholder="Enter allergy" onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addAllergy();}}}/>
            <button onClick={addAllergy} className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 hover:-translate-y-px" style={{backgroundColor:"#1A2B4A",color:"#fff"}}>+ Add</button>
          </div>
        </SectionCard>
      );

      case "vaccinations": return (
        <SectionCard title="Vaccinations">
          <div className="flex flex-wrap gap-3">
            {VAX_OPTIONS.map(v => {
              const sel = vaccinations.includes(v);
              return (
                <button key={v} type="button" onClick={()=>toggleVax(v)}
                  className="px-5 py-2.5 rounded-xl border text-sm font-medium transition-all duration-150 hover:-translate-y-px"
                  style={{borderColor:sel?"#1A2B4A":"#E2E8F0",backgroundColor:sel?"#1A2B4A":"white",color:sel?"white":"#64748B"}}>
                  {v}
                </button>
              );
            })}
          </div>
          {vaccinations.length > 0 && (
            <p className="text-xs mt-5" style={{color:"#94A3B8"}}>Selected: {vaccinations.join(", ")}</p>
          )}
        </SectionCard>
      );

      case "examination": return (
        <SectionCard title="Examination">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
            <F label="Appearance" full><NavySelect value={appearance} onChange={setAppearance} options={["Comfortable at rest","Breathless at rest","Breathless with activity"]}/></F>
            <F label="Fingernail Clubbing"><YesNo value={clubbing} onChange={setClubbing}/></F>
            <F label="Cervical Lymphadenopathy"><YesNo value={lymph} onChange={setLymph}/></F>
            <F label="Blood Pressure"><input ref={bpRef} className={ic} style={is} value={bp} onChange={e=>setBp(e.target.value)} placeholder="e.g. 120/80" onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();pulseRef.current?.focus();}}}/></F>
            <F label="Pulse"><input ref={pulseRef} className={ic} style={is} value={pulse} onChange={e=>setPulse(e.target.value)} placeholder="bpm" onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();rrRef.current?.focus();}}}/></F>
            <F label="Respiratory Rate"><input ref={rrRef} className={ic} style={is} value={rr} onChange={e=>setRr(e.target.value)} placeholder="breaths/min" onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();spo2Ref.current?.focus();}}}/></F>
            <F label="SpO2 (%)"><input ref={spo2Ref} className={ic} style={is} value={spo2} onChange={e=>setSpo2(e.target.value)} placeholder="1–100" type="number" min={1} max={100}/></F>
            <F label="Heart Sounds">
              <NavySelect value={heartSounds} onChange={setHeartSounds} options={["Normal","Other"]}/>
            </F>
            {heartSounds==="Other" && <F label="Heart Sounds — Details"><input className={ic} style={is} value={heartOther} onChange={e=>setHeartOther(e.target.value)} placeholder="Describe"/></F>}
            <F label="Lung Auscultation">
              <NavySelect value={lungAusc} onChange={setLungAusc} options={["Clear","Other"]}/>
            </F>
            {lungAusc==="Other" && <F label="Lung Auscultation — Details"><input className={ic} style={is} value={lungOther} onChange={e=>setLungOther(e.target.value)} placeholder="Describe"/></F>}
            <F label="Other Findings" full><textarea className={ta} style={is} rows={3} value={otherFindings} onChange={e=>setOtherFindings(e.target.value)} placeholder="Additional examination findings"/></F>
          </div>
        </SectionCard>
      );

      case "tests": {
        const entryCard = { backgroundColor: "#FAFBFF", borderColor: "#E2E8F0" };
        const addFirstBtn = (label: string, onClick: () => void) => (
          <button type="button" onClick={onClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all duration-150"
            style={{ borderColor: "#E2E8F0", color: "#94A3B8" }}>
            + {label}
          </button>
        );
        const addMoreBtn = (label: string, onClick: () => void) => (
          <button type="button" onClick={onClick}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all duration-150 hover:-translate-y-px"
            style={{ borderColor: "#1A2B4A", color: "#1A2B4A" }}>
            + {label}
          </button>
        );
        const removeBtn = (onClick: () => void) => (
          <button type="button" onClick={onClick}
            className="text-xs transition-colors duration-150" style={{ color: "#CBD5E1" }}
            onMouseEnter={ev => (ev.currentTarget.style.color = "#BE123C")}
            onMouseLeave={ev => (ev.currentTarget.style.color = "#CBD5E1")}>
            Remove
          </button>
        );
        const entryHeader = (count: number, idx: number, onRemove: () => void) => (
          <div className="flex items-center justify-between mb-3">
            {count > 1 ? <span className="text-xs font-semibold" style={{ color: "#64748B" }}>Entry {idx + 1}</span> : <span />}
            {removeBtn(onRemove)}
          </div>
        );
        const dateRow = (value: string, onChange: (v: string) => void) => (
          <div className="flex items-start gap-3 mb-3">
            <span className="text-xs font-semibold mt-2.5 flex-shrink-0" style={{ color: "#64748B" }}>Date</span>
            <SplitDateInput value={value} validateFuture onChange={onChange} />
          </div>
        );

        return (
          <SectionCard title="Test Results">
            <div className="space-y-5">

              {/* 1. EKG */}
              <TestGroup title="EKG">
                {testResults.ekg.length === 0
                  ? addFirstBtn("Add EKG", () => setTestResults(prev => ({ ...prev, ekg: [...prev.ekg, newEkgEntry()] })))
                  : (
                    <div className="space-y-3">
                      {testResults.ekg.map((entry, idx) => (
                        <div key={entry.id} className="rounded-xl border p-4" style={entryCard}>
                          {entryHeader(testResults.ekg.length, idx, () => setTestResults(prev => ({ ...prev, ekg: prev.ekg.filter(e => e.id !== entry.id) })))}
                          {dateRow(entry.date, v => setTestResults(prev => ({ ...prev, ekg: prev.ekg.map(e => e.id === entry.id ? { ...e, date: v } : e) })))}
                          <label className={lc} style={ls}>Result</label>
                          <textarea className={ta} style={is} rows={2} value={entry.result}
                            onChange={ev => setTestResults(prev => ({ ...prev, ekg: prev.ekg.map(e => e.id === entry.id ? { ...e, result: ev.target.value } : e) }))}
                            placeholder="e.g. Normal sinus rhythm" />
                        </div>
                      ))}
                      {addMoreBtn("Add another EKG", () => setTestResults(prev => ({ ...prev, ekg: [...prev.ekg, newEkgEntry()] })))}
                    </div>
                  )}
              </TestGroup>

              {/* 2. Echocardiogram */}
              <TestGroup title="Echocardiogram">
                {testResults.echo.length === 0
                  ? addFirstBtn("Add Echocardiogram", () => setTestResults(prev => ({ ...prev, echo: [...prev.echo, newEchoEntry()] })))
                  : (
                    <div className="space-y-3">
                      {testResults.echo.map((entry, idx) => (
                        <div key={entry.id} className="rounded-xl border p-4" style={entryCard}>
                          {entryHeader(testResults.echo.length, idx, () => setTestResults(prev => ({ ...prev, echo: prev.echo.filter(e => e.id !== entry.id) })))}
                          {dateRow(entry.date, v => setTestResults(prev => ({ ...prev, echo: prev.echo.map(e => e.id === entry.id ? { ...e, date: v } : e) })))}
                          <label className={lc} style={ls}>Result</label>
                          <textarea className={ta} style={is} rows={2} value={entry.result}
                            onChange={ev => setTestResults(prev => ({ ...prev, echo: prev.echo.map(e => e.id === entry.id ? { ...e, result: ev.target.value } : e) }))}
                            placeholder="e.g. Normal LV function, EF 60%" />
                        </div>
                      ))}
                      {addMoreBtn("Add another Echocardiogram", () => setTestResults(prev => ({ ...prev, echo: [...prev.echo, newEchoEntry()] })))}
                    </div>
                  )}
              </TestGroup>

              {/* 3. Blood Tests */}
              <TestGroup title="Blood Tests">
                {testResults.blood.length === 0
                  ? addFirstBtn("Add Blood Tests", () => setTestResults(prev => ({ ...prev, blood: [...prev.blood, newBloodEntry()] })))
                  : (
                    <div className="space-y-3">
                      {testResults.blood.map((entry, idx) => (
                        <div key={entry.id} className="rounded-xl border p-4" style={entryCard}>
                          {entryHeader(testResults.blood.length, idx, () => setTestResults(prev => ({ ...prev, blood: prev.blood.filter(e => e.id !== entry.id) })))}
                          {dateRow(entry.date, v => setTestResults(prev => ({ ...prev, blood: prev.blood.map(e => e.id === entry.id ? { ...e, date: v } : e) })))}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <F label="Test Type / Name">
                              <input className={ic} style={is} value={entry.testType}
                                onChange={ev => setTestResults(prev => ({ ...prev, blood: prev.blood.map(e => e.id === entry.id ? { ...e, testType: ev.target.value } : e) }))}
                                placeholder="e.g. FBC, Eosinophils, Total IgE" />
                            </F>
                            <F label="Result / Details" full>
                              <textarea className={ta} style={is} rows={2} value={entry.details}
                                onChange={ev => setTestResults(prev => ({ ...prev, blood: prev.blood.map(e => e.id === entry.id ? { ...e, details: ev.target.value } : e) }))}
                                placeholder="e.g. Eosinophils 0.4 × 10⁹/L, Total IgE 225 IU/mL" />
                            </F>
                          </div>
                        </div>
                      ))}
                      {addMoreBtn("Add another Blood Test", () => setTestResults(prev => ({ ...prev, blood: [...prev.blood, newBloodEntry()] })))}
                    </div>
                  )}
              </TestGroup>

              {/* 4. Bronchoscopy Washing */}
              <TestGroup title="Bronchoscopy Washing">
                {testResults.bronchWash.length === 0
                  ? addFirstBtn("Add Bronchoscopy Washing", () => setTestResults(prev => ({ ...prev, bronchWash: [...prev.bronchWash, newBronchWashEntry()] })))
                  : (
                    <div className="space-y-3">
                      {testResults.bronchWash.map((entry, idx) => (
                        <div key={entry.id} className="rounded-xl border p-4" style={entryCard}>
                          {entryHeader(testResults.bronchWash.length, idx, () => setTestResults(prev => ({ ...prev, bronchWash: prev.bronchWash.filter(e => e.id !== entry.id) })))}
                          {dateRow(entry.date, v => setTestResults(prev => ({ ...prev, bronchWash: prev.bronchWash.map(e => e.id === entry.id ? { ...e, date: v } : e) })))}
                          <SubToggle
                            fields={GROUP_FIELDS.bronchWash}
                            selected={entry.selected}
                            values={{ microbiology: entry.microbiology, cytology: entry.cytology, cellCounts: entry.cellCounts }}
                            onToggle={f => toggleTRSubField("bronchWash", entry.id, f)}
                            onChange={(f, v) => setTestResults(prev => ({ ...prev, bronchWash: prev.bronchWash.map(e => e.id === entry.id ? { ...e, [f]: v } : e) }))}
                          />
                        </div>
                      ))}
                      {addMoreBtn("Add another Bronchoscopy Washing", () => setTestResults(prev => ({ ...prev, bronchWash: [...prev.bronchWash, newBronchWashEntry()] })))}
                    </div>
                  )}
              </TestGroup>

              {/* 5. Bronchoscopy Biopsy */}
              <TestGroup title="Bronchoscopy Biopsy">
                {testResults.bronchBiopsy.length === 0
                  ? addFirstBtn("Add Bronchoscopy Biopsy", () => setTestResults(prev => ({ ...prev, bronchBiopsy: [...prev.bronchBiopsy, newBronchBiopsyEntry()] })))
                  : (
                    <div className="space-y-3">
                      {testResults.bronchBiopsy.map((entry, idx) => (
                        <div key={entry.id} className="rounded-xl border p-4" style={entryCard}>
                          {entryHeader(testResults.bronchBiopsy.length, idx, () => setTestResults(prev => ({ ...prev, bronchBiopsy: prev.bronchBiopsy.filter(e => e.id !== entry.id) })))}
                          {dateRow(entry.date, v => setTestResults(prev => ({ ...prev, bronchBiopsy: prev.bronchBiopsy.map(e => e.id === entry.id ? { ...e, date: v } : e) })))}
                          <SubToggle
                            fields={GROUP_FIELDS.bronchBiopsy}
                            selected={entry.selected}
                            values={{ pathology: entry.pathology, microbiology: entry.microbiology }}
                            onToggle={f => toggleTRSubField("bronchBiopsy", entry.id, f)}
                            onChange={(f, v) => setTestResults(prev => ({ ...prev, bronchBiopsy: prev.bronchBiopsy.map(e => e.id === entry.id ? { ...e, [f]: v } : e) }))}
                          />
                        </div>
                      ))}
                      {addMoreBtn("Add another Bronchoscopy Biopsy", () => setTestResults(prev => ({ ...prev, bronchBiopsy: [...prev.bronchBiopsy, newBronchBiopsyEntry()] })))}
                    </div>
                  )}
              </TestGroup>

              {/* 6. EBUS */}
              <TestGroup title="EBUS">
                {testResults.ebus.length === 0
                  ? addFirstBtn("Add EBUS", () => setTestResults(prev => ({ ...prev, ebus: [...prev.ebus, newEbusEntry()] })))
                  : (
                    <div className="space-y-3">
                      {testResults.ebus.map((entry, idx) => (
                        <div key={entry.id} className="rounded-xl border p-4" style={entryCard}>
                          {entryHeader(testResults.ebus.length, idx, () => setTestResults(prev => ({ ...prev, ebus: prev.ebus.filter(e => e.id !== entry.id) })))}
                          {dateRow(entry.date, v => setTestResults(prev => ({ ...prev, ebus: prev.ebus.map(e => e.id === entry.id ? { ...e, date: v } : e) })))}
                          <SubToggle
                            fields={GROUP_FIELDS.ebus}
                            selected={entry.selected}
                            values={{ cytology: entry.cytology }}
                            onToggle={f => toggleTRSubField("ebus", entry.id, f)}
                            onChange={(f, v) => setTestResults(prev => ({ ...prev, ebus: prev.ebus.map(e => e.id === entry.id ? { ...e, [f]: v } : e) }))}
                          />
                        </div>
                      ))}
                      {addMoreBtn("Add another EBUS", () => setTestResults(prev => ({ ...prev, ebus: [...prev.ebus, newEbusEntry()] })))}
                    </div>
                  )}
              </TestGroup>

              {/* 7. Pleural Fluid */}
              <TestGroup title="Pleural Fluid">
                {testResults.pleuralFluid.length === 0
                  ? addFirstBtn("Add Pleural Fluid", () => setTestResults(prev => ({ ...prev, pleuralFluid: [...prev.pleuralFluid, newPleuralFluidEntry()] })))
                  : (
                    <div className="space-y-3">
                      {testResults.pleuralFluid.map((entry, idx) => (
                        <div key={entry.id} className="rounded-xl border p-4" style={entryCard}>
                          {entryHeader(testResults.pleuralFluid.length, idx, () => setTestResults(prev => ({ ...prev, pleuralFluid: prev.pleuralFluid.filter(e => e.id !== entry.id) })))}
                          {dateRow(entry.date, v => setTestResults(prev => ({ ...prev, pleuralFluid: prev.pleuralFluid.map(e => e.id === entry.id ? { ...e, date: v } : e) })))}
                          <SubToggle
                            fields={GROUP_FIELDS.pleuralFluid}
                            selected={entry.selected}
                            values={{ cytology: entry.cytology, microbiology: entry.microbiology, biochemistry: entry.biochemistry, cellCounts: entry.cellCounts }}
                            onToggle={f => toggleTRSubField("pleuralFluid", entry.id, f)}
                            onChange={(f, v) => setTestResults(prev => ({ ...prev, pleuralFluid: prev.pleuralFluid.map(e => e.id === entry.id ? { ...e, [f]: v } : e) }))}
                          />
                        </div>
                      ))}
                      {addMoreBtn("Add another Pleural Fluid", () => setTestResults(prev => ({ ...prev, pleuralFluid: [...prev.pleuralFluid, newPleuralFluidEntry()] })))}
                    </div>
                  )}
              </TestGroup>

              {/* 8. Pleural Biopsy */}
              <TestGroup title="Pleural Biopsy">
                {testResults.pleuralBiopsy.length === 0
                  ? addFirstBtn("Add Pleural Biopsy", () => setTestResults(prev => ({ ...prev, pleuralBiopsy: [...prev.pleuralBiopsy, newPleuralBiopsyEntry()] })))
                  : (
                    <div className="space-y-3">
                      {testResults.pleuralBiopsy.map((entry, idx) => (
                        <div key={entry.id} className="rounded-xl border p-4" style={entryCard}>
                          {entryHeader(testResults.pleuralBiopsy.length, idx, () => setTestResults(prev => ({ ...prev, pleuralBiopsy: prev.pleuralBiopsy.filter(e => e.id !== entry.id) })))}
                          {dateRow(entry.date, v => setTestResults(prev => ({ ...prev, pleuralBiopsy: prev.pleuralBiopsy.map(e => e.id === entry.id ? { ...e, date: v } : e) })))}
                          <SubToggle
                            fields={GROUP_FIELDS.pleuralBiopsy}
                            selected={entry.selected}
                            values={{ pathology: entry.pathology, microbiology: entry.microbiology }}
                            onToggle={f => toggleTRSubField("pleuralBiopsy", entry.id, f)}
                            onChange={(f, v) => setTestResults(prev => ({ ...prev, pleuralBiopsy: prev.pleuralBiopsy.map(e => e.id === entry.id ? { ...e, [f]: v } : e) }))}
                          />
                        </div>
                      ))}
                      {addMoreBtn("Add another Pleural Biopsy", () => setTestResults(prev => ({ ...prev, pleuralBiopsy: [...prev.pleuralBiopsy, newPleuralBiopsyEntry()] })))}
                    </div>
                  )}
              </TestGroup>

              {/* 9. Other Test */}
              <TestGroup title="Other Test" last>
                {testResults.otherTests.length === 0
                  ? addFirstBtn("Add Other Test", () => setTestResults(prev => ({ ...prev, otherTests: [...prev.otherTests, newOtherTestEntry()] })))
                  : (
                    <div className="space-y-3">
                      {testResults.otherTests.map((entry, idx) => (
                        <div key={entry.id} className="rounded-xl border p-4" style={entryCard}>
                          {entryHeader(testResults.otherTests.length, idx, () => setTestResults(prev => ({ ...prev, otherTests: prev.otherTests.filter(e => e.id !== entry.id) })))}
                          {dateRow(entry.date, v => setTestResults(prev => ({ ...prev, otherTests: prev.otherTests.map(e => e.id === entry.id ? { ...e, date: v } : e) })))}
                          <div className="space-y-3">
                            <F label="Test Name">
                              <input className={ic} style={is} value={entry.testName}
                                onChange={ev => setTestResults(prev => ({ ...prev, otherTests: prev.otherTests.map(e => e.id === entry.id ? { ...e, testName: ev.target.value } : e) }))}
                                placeholder="e.g. CT Chest, Sleep Study" />
                            </F>
                            <F label="Result" full>
                              <textarea className={ta} style={is} rows={3} value={entry.result}
                                onChange={ev => setTestResults(prev => ({ ...prev, otherTests: prev.otherTests.map(e => e.id === entry.id ? { ...e, result: ev.target.value } : e) }))}
                                placeholder="Any other test or result not listed above" />
                            </F>
                          </div>
                        </div>
                      ))}
                      {addMoreBtn("Add another Other Test", () => setTestResults(prev => ({ ...prev, otherTests: [...prev.otherTests, newOtherTestEntry()] })))}
                    </div>
                  )}
              </TestGroup>

            </div>
          </SectionCard>
        );
      }

      case "lung": return (
        <SectionCard title="Lung Function" titleHe="תפקוד ריאות">
          {lungRows.length === 0
            ? <p className="text-sm text-center py-8" style={{color:"#94A3B8"}}>No lung function tests added yet.</p>
            : (
              <div className="space-y-4 mb-5">
                {lungRows.map(row => (
                  <div key={row.id} data-lung-row={row.id} className="rounded-2xl border p-4" style={{borderColor:"#E2E8F0",backgroundColor:"#FAFBFF"}}>

                    {/* Date + Remove */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-start gap-3">
                        <span className="text-xs font-semibold mt-2.5 flex-shrink-0" style={{color:"#64748B"}}>Date</span>
                        <SplitDateInput
                          value={row.date}
                          onChange={v => setLungCell(row.id, "date", v)}
                          validateFuture
                          onEnterFromLast={(from) => {
                            const container = document.querySelector(`[data-lung-row="${row.id}"]`);
                            if (!container) return;
                            const inputs = Array.from(container.querySelectorAll<HTMLInputElement>("input"));
                            const idx = inputs.indexOf(from);
                            if (idx >= 0 && idx < inputs.length - 1) inputs[idx + 1].focus();
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setLungRows(r => r.filter(x => x.id !== row.id))}
                        className="text-xs transition-colors duration-150"
                        style={{color:"#CBD5E1"}}
                        onMouseEnter={e => (e.currentTarget.style.color = "#BE123C")}
                        onMouseLeave={e => (e.currentTarget.style.color = "#CBD5E1")}>
                        Remove Test
                      </button>
                    </div>

                    {/* Row 1: Main Spirometry — 6 columns */}
                    <div className="mb-1">
                      <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:3}}>
                        {LUNG_MAIN.map(([label,key]) => (
                          <div key={key}>
                            <p className="text-center mb-1" style={{fontSize:9,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.04em",lineHeight:1.2}}>{label}</p>
                            <input
                              value={String(row[key])}
                              onChange={e => setLungCell(row.id, key, e.target.value)}
                              onKeyDown={e => handleLungKeyDown(e, row.id)}
                              className="w-full px-1 py-1.5 rounded-lg border bg-white focus:outline-none text-center"
                              style={{...is,fontSize:12}}
                              placeholder="—"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Row 2: Additional — 5 columns × 2 rows */}
                    <div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:3}}>
                        {LUNG_EXTRA.map(([label,key]) => (
                          <div key={key}>
                            <p className="text-center mb-1" style={{fontSize:9,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.04em",lineHeight:1.2}}>{label}</p>
                            <input
                              value={String(row[key])}
                              onChange={e => setLungCell(row.id, key, e.target.value)}
                              onKeyDown={e => handleLungKeyDown(e, row.id)}
                              className="w-full px-1 py-1.5 rounded-lg border bg-white focus:outline-none text-center"
                              style={{...is,fontSize:12}}
                              placeholder="—"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            )}
          <button
            onClick={addLungRow}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all duration-150 hover:-translate-y-px"
            style={{borderColor:"#1A2B4A",color:"#1A2B4A"}}>
            + Add Lung Function Test
          </button>
        </SectionCard>
      );

      case "pictures": return (
        <SectionCard title="Pictures" titleHe="תמונות">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={e => handleFiles(e.target.files)}
          />

          {/* Drop zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
            className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-150"
            style={{
              borderColor: isDragging ? "#1A2B4A" : "#CBD5E1",
              backgroundColor: isDragging ? "#EBF3FB" : "#FAFAFA",
              padding: pictures.length > 0 ? "24px 20px" : "48px 20px",
            }}
          >
            <svg viewBox="0 0 40 36" fill="none" stroke={isDragging ? "#1A2B4A" : "#CBD5E1"} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
              style={{ width: 40, height: 36, marginBottom: 12 }}>
              <rect x="2" y="6" width="36" height="26" rx="4"/>
              <circle cx="14" cy="17" r="4"/>
              <path d="M2 28l10-9 7 7 5-5 14 10"/>
              <path d="M26 2l5 5M31 2l-5 5" strokeWidth={2}/>
            </svg>
            <p className="text-sm font-medium mb-1" style={{ color: isDragging ? "#1A2B4A" : "#64748B" }}>
              {isDragging ? "Drop images to upload" : "Drag & drop images here"}
            </p>
            <p className="text-xs" style={{ color: "#94A3B8" }}>
              or <span style={{ color: "#4A90D9", fontWeight: 600 }}>click to browse</span> · PNG, JPG, HEIC
            </p>
          </div>

          {/* Image previews */}
          {pictures.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 20 }}>
              {pictures.map((src, i) => (
                <div key={i} style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: "1px solid #E2E8F0", aspectRatio: "4/3", backgroundColor: "#F4F6F9" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Image ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setPictures(prev => prev.filter((_, idx) => idx !== i)); }}
                    style={{
                      position: "absolute", top: 6, right: 6,
                      width: 22, height: 22, borderRadius: "50%",
                      backgroundColor: "rgba(26,43,74,0.7)", color: "white",
                      border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
                    }}>
                    ×
                  </button>
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "4px 8px", background: "linear-gradient(transparent, rgba(26,43,74,0.45))" }}>
                    <span style={{ fontSize: 10, color: "white", fontWeight: 500 }}>Image {i + 1}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {pictures.length > 0 && (
            <p className="text-xs mt-3" style={{ color: "#94A3B8" }}>
              {pictures.length} image{pictures.length !== 1 ? "s" : ""} added · Images will appear in the letter preview
            </p>
          )}
        </SectionCard>
      );

      case "inhalers": return (
        <SectionCard title="Inhalers" titleHe="משאפים">
          <p className="text-sm mb-5" style={{ color: "#64748B" }}>
            Search RightBreathe to find the correct inhaler, then select it. You can also add details manually.
          </p>

          <div className="space-y-5">
            {/* ── Search bar ── */}
            <div ref={inhalerRef}>
              <label className={lc} style={ls}>Search RightBreathe</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <svg viewBox="0 0 20 20" fill="none" stroke="#CBD5E1" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none">
                    <circle cx="9" cy="9" r="6"/><path d="M17 17l-3.5-3.5"/>
                  </svg>
                  <input
                    className={ic}
                    style={{ ...is, paddingLeft: "2.75rem" }}
                    value={inhalerSearch}
                    onChange={e => { setInhalerSearch(e.target.value); setInhalerDropdown(false); setInhalerSearchError(""); }}
                    onKeyDown={e => { if (e.key === "Enter") handleInhalerSearch(); }}
                    placeholder="Type inhaler name, e.g. Ventolin..."
                  />
                </div>
                <button
                  type="button"
                  onClick={handleInhalerSearch}
                  disabled={inhalerSearching || !inhalerSearch.trim()}
                  className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150"
                  style={{
                    backgroundColor: inhalerSearching || !inhalerSearch.trim() ? "#F4F6F9" : "#1A2B4A",
                    color: inhalerSearching || !inhalerSearch.trim() ? "#94A3B8" : "#fff",
                    border: "1px solid",
                    borderColor: inhalerSearching || !inhalerSearch.trim() ? "#E2E8F0" : "#1A2B4A",
                    cursor: inhalerSearching || !inhalerSearch.trim() ? "default" : "pointer",
                  }}>
                  {inhalerSearching ? "Searching…" : "Search"}
                </button>
              </div>

              {/* Search error */}
              {inhalerSearchError && (
                <p className="text-xs mt-2" style={{ color: "#BE123C" }}>{inhalerSearchError}</p>
              )}

              {/* Search results dropdown */}
              {inhalerDropdown && inhalerResults.length > 0 && (
                <div className="mt-2 rounded-xl overflow-x-hidden"
                  style={{ border: "1px solid #E2E8F0", boxShadow: "0 4px 6px -1px rgb(0 0 0/0.07), 0 8px 24px rgb(26 43 74/0.10)" }}>
                  {inhalerResults.map((r, i) => (
                    <div key={r.pageUrl}
                      className="flex items-center gap-3 px-4 py-3 bg-white transition-colors duration-100"
                      style={{ borderTop: i > 0 ? "1px solid #F4F6F9" : "none" }}>
                      {/* Image or placeholder */}
                      <div className="flex-shrink-0 rounded-lg overflow-hidden flex items-center justify-center"
                        style={{ width: 44, height: 44, backgroundColor: "#F4F6F9", border: "1px solid #E2E8F0" }}>
                        {r.imageUrl
                          /* eslint-disable-next-line @next/next/no-img-element */
                          ? <img src={r.imageUrl} alt={r.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                          : <InhalerIcon />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: "#1A2B4A", wordBreak: "break-word" }}>{r.name}</p>
                        <a href={r.pageUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs" style={{ color: "#4A90D9" }}
                          onClick={e => e.stopPropagation()}>
                          View on RightBreathe ↗
                        </a>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setInhalers(prev => [...prev, { id: newInhalerId(), name: r.name, link: r.pageUrl, imageUrl: r.imageUrl }]);
                          setInhalerSearch("");
                          setInhalerDropdown(false);
                          setInhalerResults([]);
                        }}
                        className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
                        style={{ backgroundColor: "#1A2B4A", color: "#fff", border: "none", cursor: "pointer", alignSelf: "center" }}>
                        Select
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Added inhalers list ── */}
            {inhalers.length > 0 && (
              <div className="space-y-3">
                {inhalers.map((inh, idx) => (
                  <div key={inh.id} className="rounded-2xl border p-4" style={{ borderColor: "#E2E8F0", backgroundColor: "#FAFBFF" }}>
                    <div className="flex items-center justify-between mb-3">
                      {inhalers.length > 1 && <span className="text-xs font-semibold" style={{ color: "#64748B" }}>Inhaler {idx + 1}</span>}
                      {inhalers.length === 1 && <span />}
                      <button type="button"
                        className="text-xs transition-colors duration-150" style={{ color: "#CBD5E1" }}
                        onMouseEnter={e => (e.currentTarget.style.color = "#BE123C")}
                        onMouseLeave={e => (e.currentTarget.style.color = "#CBD5E1")}
                        onClick={() => setInhalers(prev => prev.filter(i => i.id !== inh.id))}>
                        Remove
                      </button>
                    </div>
                    <div className="flex gap-4 items-start">
                      <div className="flex-shrink-0 rounded-xl overflow-hidden flex items-center justify-center"
                        style={{ width: 72, height: 72, backgroundColor: "#EBF3FB", border: "1px solid #E2E8F0" }}>
                        {inh.imageUrl
                          /* eslint-disable-next-line @next/next/no-img-element */
                          ? <img src={inh.imageUrl} alt={inh.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                          : <InhalerIcon />
                        }
                      </div>
                      <div className="flex-1 min-w-0 space-y-3">
                        <div>
                          <label className={lc} style={ls}>Inhaler Name</label>
                          <input className={ic} style={is} value={inh.name}
                            onChange={e => setInhalers(prev => prev.map(i => i.id === inh.id ? { ...i, name: e.target.value } : i))}
                            placeholder="Inhaler name" />
                        </div>
                        <div>
                          <label className={lc} style={ls}>RightBreathe Link</label>
                          <input className={ic} style={is} value={inh.link}
                            onChange={e => setInhalers(prev => prev.map(i => i.id === inh.id ? { ...i, link: e.target.value } : i))}
                            placeholder="https://www.rightbreathe.com/medicines/..." />
                        </div>
                        <div>
                          <label className={lc} style={ls}>Image URL (optional)</label>
                          <input className={ic} style={is} value={inh.imageUrl}
                            onChange={e => setInhalers(prev => prev.map(i => i.id === inh.id ? { ...i, imageUrl: e.target.value } : i))}
                            placeholder="https://..." />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Add manually button ── */}
            <button type="button"
              onClick={() => setInhalers(prev => [...prev, newInhalerEntry()])}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all duration-150"
              style={{ borderColor: "#E2E8F0", color: "#64748B" }}>
              + Add inhaler manually
            </button>
          </div>
        </SectionCard>
      );

      case "review": return (
        <SectionCard title="Review">
          <p className="text-sm mb-6" style={{color:"#64748B"}}>Review the completed letter before sending.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button onClick={handlePreview} type="button"
              className="flex flex-col items-start text-left px-5 py-4 rounded-xl border transition-all duration-150 hover:-translate-y-px"
              style={{borderColor:"#0D9488",backgroundColor:"white"}}>
              <span className="text-sm font-semibold" style={{color:"#0D9488"}}>Preview Letter</span>
              <span className="text-xs mt-1" style={{color:"#64748B"}}>View the full formatted letter</span>
            </button>
            <button onClick={handleSendToAnat} type="button" disabled={sendingToAnat}
              className="flex flex-col items-start text-left px-5 py-4 rounded-xl border transition-all duration-150 hover:-translate-y-px"
              style={{borderColor:"#7C3AED",backgroundColor:"white",opacity:sendingToAnat?0.7:1,cursor:sendingToAnat?"default":"pointer"}}>
              <span className="text-sm font-semibold" style={{color:"#7C3AED"}}>
                {sendingToAnat ? "Preparing file…" : "Send to Anat"}
              </span>
              <span className="text-xs mt-1" style={{color:"#64748B"}}>
                Downloads editable .docx for Anat to review
              </span>
            </button>
          </div>
        </SectionCard>
      );

      default: return null;
    }
  };

  // ─── Layout ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-white flex-shrink-0"
        style={{borderBottom:"1px solid #E2E8F0"}}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.length > 1 ? router.back() : router.push("/workspace")}
            className="inline-flex items-center gap-1.5 text-xs font-medium"
            style={{color:"#94A3B8", background:"none", border:"none", cursor:"pointer", padding:0}}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <path d="M10 12L6 8l4-4"/>
            </svg>
            Back
          </button>
          <span style={{color:"#E2E8F0"}}>›</span>
          <h1 className="text-sm font-bold" style={{color:"#1A2B4A"}}>Clinic Letter Editor</h1>
        </div>
        <span className="text-xs px-3 py-1 rounded-full font-semibold" style={{backgroundColor:"#EBF3FB",color:"#4A90D9"}}>Draft</span>
      </div>

      {/* Update mode banner */}
      {isUpdateMode && (
        <div className="flex items-center gap-3 px-5 py-2.5 flex-shrink-0"
          style={{ backgroundColor: "#FFFBEB", borderBottom: "1px solid #FDE68A" }}>
          <svg viewBox="0 0 16 16" fill="none" stroke="#D97706" strokeWidth={1.75}
            strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 flex-shrink-0">
            <circle cx="8" cy="8" r="7"/>
            <path d="M8 5v3M8 11h.01"/>
          </svg>
          <p className="text-xs font-semibold flex-1" style={{ color: "#92400E" }}>
            Update Letter — new version based on a previous visit. Date set to today. Edit the sections you need to change.
          </p>
          <button onClick={() => setActive("patient")}
            className="text-xs px-2.5 py-1 rounded-lg border flex-shrink-0 transition-all hover:-translate-y-px"
            style={{ borderColor: "#D97706", color: "#92400E", backgroundColor: "white" }}>
            Patient Details
          </button>
          <button onClick={() => setActive("clinical")}
            className="text-xs px-2.5 py-1 rounded-lg border flex-shrink-0 transition-all hover:-translate-y-px"
            style={{ borderColor: "#D97706", color: "#92400E", backgroundColor: "white" }}>
            Clinical
          </button>
        </div>
      )}

      {/* Approved-letter edit warning banner */}
      {approvedStatus === "Sent to Patient" && (
        <div className="flex items-center gap-3 px-5 py-2.5 flex-shrink-0"
          style={{ backgroundColor: "#FEF2F2", borderBottom: "1px solid #FECACA" }}>
          <svg viewBox="0 0 16 16" fill="none" stroke="#BE123C" strokeWidth={1.75}
            strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 flex-shrink-0">
            <circle cx="8" cy="8" r="7"/><path d="M8 5v3M8 11h.01"/>
          </svg>
          <p className="text-xs font-semibold flex-1" style={{ color: "#BE123C" }}>
            This letter was already sent to the patient. Changes will not affect the sent email — re-export the PDF after editing if needed.
          </p>
        </div>
      )}
      {approvedStatus === "Ready for Patient" && (
        <div className="flex items-center gap-3 px-5 py-2.5 flex-shrink-0"
          style={{ backgroundColor: "#FFFBEB", borderBottom: "1px solid #FDE68A" }}>
          <svg viewBox="0 0 16 16" fill="none" stroke="#D97706" strokeWidth={1.75}
            strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 flex-shrink-0">
            <circle cx="8" cy="8" r="7"/><path d="M8 5v3M8 11h.01"/>
          </svg>
          <p className="text-xs font-semibold flex-1" style={{ color: "#92400E" }}>
            This letter was already approved. Please re-preview and re-export the PDF after making changes.
          </p>
        </div>
      )}

      {/* 3-panel */}
      <div className="flex flex-1">
        {/* Left section nav — sticky */}
        <aside className="w-44 flex-shrink-0 bg-white overflow-y-auto"
          style={{borderRight:"1px solid #E2E8F0", position:"sticky", top:0, height:"100vh"}}>
          <nav className="py-3 px-2 flex flex-col gap-0.5">
            {SECTIONS.map(s => {
              const isUpdatePriority = isUpdateMode && ["patient","clinical"].includes(s.id) && active !== s.id;
              return (
                <button key={s.id} onClick={() => setActive(s.id)}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs transition-all duration-150 flex items-center justify-between"
                  style={{ backgroundColor: active===s.id?"#1A2B4A":"transparent", color: active===s.id?"#ffffff":"#64748B", fontWeight: active===s.id?600:400 }}>
                  <span>{s.label}</span>
                  {isUpdatePriority && (
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: "#F59E0B" }} />
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-5 min-h-screen" style={{backgroundColor:"#F4F6F9"}}>
          {renderSection()}
        </main>

        {/* Right panel — sticky */}
        <aside className="w-52 flex-shrink-0 bg-white overflow-y-auto p-5"
          style={{borderLeft:"1px solid #E2E8F0", position:"sticky", top:0, height:"100vh"}}>
          {/* Status */}
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-wide mb-2.5" style={{color:"#94A3B8"}}>Status</p>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{backgroundColor:"#EBF3FB"}}>
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor:"#4A90D9"}}/>
              <span className="text-sm font-semibold" style={{color:"#4A90D9"}}>Draft</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2.5 mb-7">
            {draftSaved && (
              <p className="text-xs font-semibold text-center" style={{color:"#0D9488"}}>
                Draft saved ✓
              </p>
            )}
            {saveDraftError && (
              <p className="text-xs font-semibold text-center" style={{color:"#BE123C"}}>
                {saveDraftError}
              </p>
            )}
            <button onClick={handleSaveDraft}
              className="w-full py-2.5 rounded-xl text-xs font-semibold border transition-all duration-150 hover:-translate-y-px"
              style={{backgroundColor:"#1A2B4A",color:"#fff",borderColor:"#1A2B4A"}}>
              Save Draft
            </button>
            <button onClick={handlePreview}
              className="w-full py-2.5 rounded-xl text-xs font-semibold border transition-all duration-150 hover:-translate-y-px"
              style={{borderColor:"#0D9488",color:"#0D9488",backgroundColor:"white"}}>
              Preview Letter
            </button>
            <button onClick={handleSendToAnat} disabled={sendingToAnat}
              className="w-full py-2.5 rounded-xl text-xs font-semibold border transition-all duration-150 hover:-translate-y-px"
              style={{borderColor:"#7C3AED",color:"#7C3AED",backgroundColor:"white",opacity:sendingToAnat?0.7:1,cursor:sendingToAnat?"default":"pointer"}}>
              {sendingToAnat ? "Preparing file…" : "Send to Anat"}
            </button>
          </div>

          {/* Section list */}
          <p className="text-xs font-semibold uppercase tracking-wide mb-2.5" style={{color:"#94A3B8"}}>Sections</p>
          <div className="flex flex-col gap-0.5">
            {SECTIONS.map(s=>(
              <button key={s.id} onClick={()=>setActive(s.id)}
                className="flex items-center gap-2 text-xs py-1.5 w-full text-left px-1 rounded-lg transition-colors duration-150"
                style={{color:active===s.id?"#1A2B4A":"#94A3B8",fontWeight:active===s.id?600:400}}>
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{backgroundColor:active===s.id?"#1A2B4A":"#E2E8F0"}}/>
                {s.label}
              </button>
            ))}
          </div>
        </aside>
      </div>

      {/* ── Hebrew overwrite confirmation modal ─────────────────────────────── */}
      {txConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setTxConfirm(null); }}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full"
            style={{ boxShadow: "0 8px 40px rgb(0 0 0/0.18), 0 2px 8px rgb(0 0 0/0.08)", border: "1px solid #E2E8F0" }}>

            {/* Icon + title */}
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ backgroundColor: "#FEF2F2" }}>
                <svg viewBox="0 0 16 16" fill="none" stroke="#DC2626" strokeWidth={2}
                  strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <path d="M7.13 2.14 1.44 12A1 1 0 0 0 2.3 13.5h11.4a1 1 0 0 0 .87-1.5L9.87 2.14a1 1 0 0 0-1.74 0z"/>
                  <path d="M8 6v3M8 11h.01"/>
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold mb-0.5" style={{ color: "#1A2B4A" }}>
                  Replace Hebrew Translation?
                </h3>
                <p className="text-xs" style={{ color: "#64748B" }}>
                  {txConfirm?.type === "diagItem" ? "Diagnosis item" : txConfirm?.type === "planStep" ? "Plan step" : "Summary section"}
                </p>
              </div>
            </div>

            <p className="text-xs leading-relaxed mb-4" style={{ color: "#475569" }}>
              The <strong style={{ color: "#1A2B4A" }}>
                {txConfirm?.type === "diagItem"  ? "Diagnosis item" :
                 txConfirm?.type === "planStep"  ? "Plan step" :
                 "Summary section"}
              </strong> already contains Hebrew text — possibly Anat&apos;s reviewed and corrected translation.
            </p>

            <div className="px-3 py-2.5 rounded-xl mb-5 text-xs leading-relaxed font-medium"
              style={{ backgroundColor: "#FEF9C3", color: "#854D0E" }}>
              Replacing it will permanently overwrite the existing Hebrew text and any corrections Anat made. This cannot be undone.
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setTxConfirm(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all duration-150 hover:-translate-y-px active:scale-95"
                style={{ borderColor: "#E2E8F0", color: "#475569", backgroundColor: "white" }}>
                Cancel
              </button>
              <button
                onClick={confirmTranslate}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 hover:-translate-y-px active:scale-95"
                style={{ backgroundColor: "#DC2626", color: "#fff" }}>
                Replace Hebrew
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
