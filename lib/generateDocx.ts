// Editable .docx clinic letter — designed to open cleanly in Apple Pages and Microsoft Word.
// The DOCX is the editable master; the PDF is the polished patient copy.

import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  Table, TableRow, TableCell, WidthType, VerticalAlign,
  Header, Footer, ImageRun, ShadingType, ExternalHyperlink,
} from "docx";

type LD = Record<string, unknown>;
type Block = Paragraph | Table;

const RTL_MARK = "‏"; // anchors bidi numbers to the right edge in RTL paragraphs

// ─── Helpers ──────────────────────────────────────────────────────────────────

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function arr(v: unknown): string[] {
  return Array.isArray(v) ? (v as unknown[]).map((x) => s(x)).filter(Boolean) : [];
}

function gap(size = 50): Paragraph {
  return new Paragraph({ children: [], spacing: { after: size } });
}

function bodyLine(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 20, font: "Avenir Next" })],
    spacing: { after: 40 },
  });
}

function rtlLine(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 20, font: "Avenir Next" })],
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    spacing: { after: 40 },
  });
}

// English numbered item — hanging indent keeps wrapped lines aligned under text, not number
function numberedEN(num: number, text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: `${num}.`, bold: true, size: 20, font: "Avenir Next" }),
      new TextRun({ text: `  ${text}`, size: 20, font: "Avenir Next" }),
    ],
    indent: { left: 360, hanging: 360 },
    spacing: { after: 60 },
  });
}

// Hebrew numbered item — RTL mark anchors the number to the right edge
function numberedHE(num: number, text: string, color = "160B5C"): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: `${RTL_MARK}${num}.  ${text}`, size: 20, color, font: "Avenir Next" })],
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    spacing: { after: 60 },
  });
}

function lv(label: string, value: string): Paragraph | null {
  if (!value) return null;
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 20, font: "Avenir Next" }),
      new TextRun({ text: value, size: 20, font: "Avenir Next" }),
    ],
    spacing: { after: 40 },
  });
}

// Section heading — 14pt bold, dark purple, thin underline
function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 24, color: "1A2B4A", font: "Avenir Next" })],
    spacing: { before: 140, after: 60 },
    border: { bottom: { style: "single" as const, size: 4, color: "160B5C", space: 4 } },
  });
}

// Hebrew section heading (אבחנה / סיכום / תכנית) — full-width bar, brand lavender background
function hebrewHeading(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 26, color: "1E106E", font: "Avenir Next" })],
    bidirectional: true,
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 60 },
    shading: { type: ShadingType.SOLID, fill: "D8DEF6", color: "D8DEF6" },
    border: {
      top:    { style: "single" as const, size: 4, color: "000000", space: 4 },
      bottom: { style: "single" as const, size: 4, color: "000000", space: 4 },
      left:   { style: "single" as const, size: 4, color: "000000", space: 4 },
      right:  { style: "single" as const, size: 4, color: "000000", space: 4 },
    },
  });
}

function subLabel(text: string, color = "475569"): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 20, bold: true, color, font: "Avenir Next" })],
    spacing: { before: 60, after: 40 },
  });
}

// Invisible border — used for table cells that should have no visible lines
const INVIS = { style: "none" as const, size: 0, color: "FFFFFF", space: 0 };
const NO_BORDERS = { top: INVIS, bottom: INVIS, left: INVIS, right: INVIS };

// ─── Lung function table ──────────────────────────────────────────────────────

interface LungRowRaw {
  date?: string;
  fev1l?: string; fev1p?: string; fvcl?: string; fvcp?: string;
  ratio?: string; fef?: string;
  tlcl?: string; tlc?: string; rvl?: string; rv?: string;
  dlco?: string; kco?: string; feno?: string; meta?: string; walk?: string; hwbmi?: string;
}

function makeTable(labels: string[], values: string[]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: labels.map((label) => new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: label, size: 17, bold: true, color: "334155", font: "Avenir Next" })],
            alignment: AlignmentType.CENTER,
          })],
        })),
      }),
      new TableRow({
        children: values.map((val) => new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: val?.trim() || "—", size: 20, bold: true, color: "1A2B4A", font: "Avenir Next" })],
            alignment: AlignmentType.CENTER,
          })],
        })),
      }),
    ],
  });
}

function lungFunctionBlocks(data: LD): Block[] {
  const rows = Array.isArray(data.lungRows) ? (data.lungRows as LungRowRaw[]) : [];
  if (rows.length === 0) return [];

  const blocks: Block[] = [sectionHeading("Lung Function")];

  for (const row of rows) {
    if (row.date) {
      blocks.push(new Paragraph({
        children: [new TextRun({ text: `Date: ${row.date}`, bold: true, size: 20, color: "1A2B4A", font: "Avenir Next" })],
        spacing: { before: 120, after: 40 },
      }));
    }

    const mainLabels = ["FEV1 L", "FEV1 %", "FVC L", "FVC %", "FEV1/FVC %", "FEF 25-75 %"];
    const mainVals   = [row.fev1l, row.fev1p, row.fvcl, row.fvcp, row.ratio, row.fef];
    if (mainVals.some((v) => v?.trim())) {
      blocks.push(makeTable(mainLabels, mainVals.map(s)));
    }

    const extraPairs: [string, string][] = [
      ["TLC L", s(row.tlcl)], ["TLC %", s(row.tlc)],
      ["RV L", s(row.rvl)],   ["RV %", s(row.rv)],
      ["DLCO %", s(row.dlco)], ["KCO %", s(row.kco)],
      ["FeNO", s(row.feno)], ["Metacholine", s(row.meta)],
      ["6 Min Walk", s(row.walk)], ["Ht/Wt/BMI", s(row.hwbmi)],
    ].filter(([, v]) => v) as [string, string][];

    if (extraPairs.length > 0) {
      const chunkSize = 5;
      for (let i = 0; i < extraPairs.length; i += chunkSize) {
        const chunk = extraPairs.slice(i, i + chunkSize);
        blocks.push(makeTable(chunk.map(([l]) => l), chunk.map(([, v]) => v)));
      }
    }

    blocks.push(gap(100));
  }

  return blocks;
}

// ─── Test results ─────────────────────────────────────────────────────────────

function testResultsBlocks(data: LD): Block[] {
  const tr = (data.testResults ?? {}) as Record<string, unknown>;
  const blocks: Block[] = [];
  let hasAny = false;

  const push = (...items: (Block | null)[]) => {
    items.forEach((b) => { if (b) { blocks.push(b); hasAny = true; } });
  };

  type AnyEntry = Record<string, unknown>;

  // EKG — array of entries (new format) or legacy { value, details }
  const ekgEntries: AnyEntry[] = Array.isArray(tr.ekg) ? tr.ekg as AnyEntry[]
    : (tr.ekg && typeof tr.ekg === "object") ? (() => {
        const o = tr.ekg as { value?: string; details?: string };
        return o.value ? [{ result: o.value === "Other" ? (o.details || "") : o.value }] : [];
      })()
    : (typeof tr.ekg === "string" && s(tr.ekg as string)) ? [{ result: tr.ekg }] : [];
  if (ekgEntries.length > 0) {
    blocks.push(subLabel("EKG"));
    for (const e of ekgEntries) {
      if (s(e.date as string)) push(lv("Date", s(e.date as string)));
      if (s(e.result as string)) push(bodyLine(s(e.result as string)));
    }
  }

  // Echocardiogram — array of entries (new) or legacy string
  const echoEntries: AnyEntry[] = Array.isArray(tr.echo) ? tr.echo as AnyEntry[]
    : (typeof tr.echo === "string" && s(tr.echo as string)) ? [{ result: tr.echo }] : [];
  if (echoEntries.length > 0) {
    blocks.push(subLabel("Echocardiogram"));
    for (const e of echoEntries) {
      if (s(e.date as string)) push(lv("Date", s(e.date as string)));
      if (s(e.result as string)) push(bodyLine(s(e.result as string)));
    }
  }

  // Blood — array of entries (new) or legacy { date, testType, details }
  const bloodEntries: AnyEntry[] = Array.isArray(tr.blood) ? tr.blood as AnyEntry[]
    : (tr.blood && typeof tr.blood === "object") ? (() => {
        const o = tr.blood as { date?: string; testType?: string; details?: string };
        return (o.date || o.testType || o.details) ? [o as AnyEntry] : [];
      })() : [];
  if (bloodEntries.length > 0) {
    blocks.push(subLabel("Blood Tests"));
    for (const e of bloodEntries) {
      push(lv("Date", s(e.date as string)), lv("Type", s(e.testType as string)), lv("Results", s(e.details as string)));
    }
  }

  // Sub-groups: each supports array (new) or single object (legacy)
  const subGroupDefs: [string, string, [string, string][]][] = [
    ["Bronchoscopy Washing",  "bronchWash",   [["microbiology","Microbiology"],["cytology","Cytology"],["cellCounts","Cell Counts"]]],
    ["Bronchoscopy Biopsy",   "bronchBiopsy", [["pathology","Pathology"],["microbiology","Microbiology"]]],
    ["EBUS",                  "ebus",         [["cytology","Cytology"]]],
    ["Pleural Fluid",         "pleuralFluid", [["cytology","Cytology"],["microbiology","Microbiology"],["biochemistry","Biochemistry"],["cellCounts","Cell Counts"]]],
    ["Pleural Biopsy",        "pleuralBiopsy",[["pathology","Pathology"],["microbiology","Microbiology"]]],
  ];
  for (const [label, key, fields] of subGroupDefs) {
    const raw = tr[key];
    const entries: AnyEntry[] = Array.isArray(raw) ? raw as AnyEntry[]
      : (raw && typeof raw === "object") ? [raw as AnyEntry] : [];
    const hasContent = entries.some(e => fields.some(([f]) => s(e[f] as string)));
    if (!hasContent) continue;
    blocks.push(subLabel(label));
    for (const e of entries) {
      if (s(e.date as string)) push(lv("Date", s(e.date as string)));
      for (const [f, fl] of fields) {
        if (s(e[f] as string)) push(lv(fl, s(e[f] as string)));
      }
    }
  }

  // Other Tests — array (new) or legacy string "otherTest"
  const otherEntries: AnyEntry[] = Array.isArray(tr.otherTests) ? tr.otherTests as AnyEntry[]
    : (typeof tr.otherTest === "string" && s(tr.otherTest as string)) ? [{ result: tr.otherTest }] : [];
  if (otherEntries.length > 0) {
    blocks.push(subLabel("Other Test"));
    for (const e of otherEntries) {
      if (s(e.date as string)) push(lv("Date", s(e.date as string)));
      if (s(e.testName as string)) push(lv("Test", s(e.testName as string)));
      if (s(e.result as string)) push(bodyLine(s(e.result as string)));
    }
  }

  if (!hasAny) return [];
  return [sectionHeading("Test Results"), ...blocks, gap()];
}

// ─── Image helpers ────────────────────────────────────────────────────────────

async function fetchImage(path: string): Promise<ArrayBuffer | null> {
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(`${base}${path}`, { cache: "force-cache" });
    if (!res.ok) return null;
    return res.arrayBuffer();
  } catch {
    return null;
  }
}

async function fetchImageAny(url: string): Promise<{ data: ArrayBuffer; type: "png" | "jpg" | "gif" } | null> {
  try {
    if (!url || typeof url !== "string") return null;
    if (url.startsWith("data:")) {
      const comma = url.indexOf(",");
      if (comma === -1) return null;
      const header = url.slice(0, comma);
      const b64    = url.slice(comma + 1);
      const binary = atob(b64);
      const bytes  = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const type: "png" | "jpg" | "gif" = header.includes("png") ? "png" : header.includes("gif") ? "gif" : "jpg";
      return { data: bytes.buffer, type };
    }
    const base    = typeof window !== "undefined" ? window.location.origin : "";
    const fullUrl = url.startsWith("http") || url.startsWith("blob:") ? url : `${base}${url}`;
    const res     = await fetch(fullUrl, { cache: "force-cache" });
    if (!res.ok) return null;
    const data    = await res.arrayBuffer();
    const ct      = res.headers.get("content-type") ?? "";
    const type: "png" | "jpg" | "gif" = ct.includes("png") ? "png" : ct.includes("gif") ? "gif" : "jpg";
    return { data, type };
  } catch {
    return null;
  }
}

// ─── Main generator ───────────────────────────────────────────────────────────

export async function generateLetterDocx(
  data: LD,
  mode: "review" | "final" = "review"
): Promise<Blob> {
  const [logoData, stampData] = await Promise.all([
    fetchImage("/clinic-logo.png"),
    mode === "final" ? fetchImage("/stamp.png") : Promise.resolve(null),
  ]);

  // ── Header: logo smaller than PDF version for clean DOCX editing ──────
  let headerPara: Paragraph;
  if (logoData) {
    try {
      headerPara = new Paragraph({
        children: [new ImageRun({
          data: new Uint8Array(logoData),
          transformation: { width: 270, height: 81 },
          type: "png",
        })],
        alignment: AlignmentType.CENTER,
        border: { bottom: { style: "single" as const, size: 8, color: "1A2B4A", space: 4 } },
        spacing: { after: 0 },
      });
    } catch {
      headerPara = new Paragraph({
        children: [new TextRun({ text: "DR. SUMIT CHATTERJI  —  CLINIC", bold: true, size: 24, color: "1A2B4A", font: "Avenir Next" })],
        alignment: AlignmentType.CENTER,
        border: { bottom: { style: "single" as const, size: 8, color: "1A2B4A", space: 4 } },
      });
    }
  } else {
    headerPara = new Paragraph({
      children: [new TextRun({ text: "DR. SUMIT CHATTERJI  —  CLINIC", bold: true, size: 24, color: "1A2B4A", font: "Avenir Next" })],
      alignment: AlignmentType.CENTER,
      border: { bottom: { style: "single" as const, size: 8, color: "1A2B4A", space: 4 } },
    });
  }
  const subtitlePara = new Paragraph({
    children: [new TextRun({ text: "מרפאת ריאות", size: 22, color: "1E106E", font: "Avenir Next" })],
    alignment: AlignmentType.CENTER,
    bidirectional: true,
    spacing: { before: 20, after: 0 },
  });
  const docHeader = new Header({ children: [headerPara, subtitlePara] });

  // ── Footer: licenses left, contact right, dark-purple rule above ──────
  const docFooter = new Footer({
    children: [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [new TableRow({
          children: [
            new TableCell({
              width: { size: 60, type: WidthType.PERCENTAGE },
              borders: NO_BORDERS,
              children: [
                new Paragraph({
                  children: [new TextRun({ text: "Israel Medical Licence 1-143320", bold: true, size: 16, color: "1A2B4A", font: "Avenir Next" })],
                  border: { top: { style: "single" as const, size: 10, color: "1A2B4A", space: 4 } },
                  spacing: { before: 40, after: 20 },
                }),
                new Paragraph({
                  children: [new TextRun({ text: "General Medical Council (UK) Licence 4630182", bold: true, size: 16, color: "1A2B4A", font: "Avenir Next" })],
                  spacing: { after: 20 },
                }),
                new Paragraph({
                  children: [new TextRun({ text: "Internal Medicine and Pulmonology", bold: true, size: 16, color: "1A2B4A", font: "Avenir Next" })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 40, type: WidthType.PERCENTAGE },
              borders: NO_BORDERS,
              children: [
                new Paragraph({
                  children: [new TextRun({ text: "Email: lungdrsumit@gmail.com", bold: true, size: 16, color: "1A2B4A", font: "Avenir Next" })],
                  alignment: AlignmentType.RIGHT,
                  border: { top: { style: "single" as const, size: 10, color: "1A2B4A", space: 4 } },
                  spacing: { before: 40, after: 20 },
                }),
                new Paragraph({
                  children: [new TextRun({ text: "Telephone: +972 53 3065358", bold: true, size: 16, color: "1A2B4A", font: "Avenir Next" })],
                  alignment: AlignmentType.RIGHT,
                }),
              ],
            }),
          ],
        })],
      }),
    ],
  });

  // ── Document body ──────────────────────────────────────────────────────
  const children: Block[] = [];

  // Date banner
  const letterDate = [s(data.dateDay), s(data.dateMonth), s(data.dateYear)].filter(Boolean).join(" / ");
  if (letterDate) {
    children.push(new Paragraph({
      children: [new TextRun({ text: `Date:  ${letterDate}`, size: 20, color: "64748B", font: "Avenir Next" })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: mode === "review" ? 160 : 240 },
    }));
  }

  if (mode === "review") {
    children.push(new Paragraph({
      children: [new TextRun({ text: "REVIEW DRAFT  —  Prepared for Anat. Please edit and return.", size: 20, color: "BE123C", italics: true, font: "Avenir Next" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    }));
  }

  // ── Patient Details ────────────────────────────────────────────────────
  children.push(sectionHeading("Patient Details"));

  const _dy = parseInt(s(data.bDay)), _dm = parseInt(s(data.bMonth)), _dyr = parseInt(s(data.bYear));
  let ageDocx = "";
  if (_dy && _dm && _dyr && _dyr >= 1900) {
    const birth = new Date(_dyr, _dm - 1, _dy);
    if (!isNaN(birth.getTime())) {
      const now = new Date();
      let yrs = now.getFullYear() - birth.getFullYear();
      let mos = now.getMonth() - birth.getMonth();
      if (now.getDate() < birth.getDate()) mos--;
      if (mos < 0) { yrs--; mos += 12; }
      if (yrs >= 0) ageDocx = yrs === 0 ? `${mos} month${mos !== 1 ? "s" : ""}` : `${yrs} yr, ${mos} mo`;
    }
  }
  const ageGender = [ageDocx, s(data.gender)].filter(Boolean).join("  ·  ");
  const dob = [s(data.bDay), s(data.bMonth), s(data.bYear)].filter(Boolean).join(" / ");

  // 4-column grid: Label | Value | Label | Value — clean editable table
  const LABEL_BG   = { type: ShadingType.SOLID, fill: "F3F4F6", color: "F3F4F6" };
  const GB = { style: "single" as const, size: 2, color: "D1D5DB", space: 0 };
  const GRID_BORDERS = { top: GB, bottom: GB, left: GB, right: GB };

  const patientRows: [string, string, string, string][] = [
    ["Name",          s(data.name),          "Smoking / Vaping", s(data.smoking)],
    ["ID",            s(data.patId),          "Pets",             s(data.pets)],
    ["Date of Birth", dob,                    "Occupation",       s(data.occupation)],
    ["Age / Gender",  ageGender,              "Referred By",      s(data.referredBy)],
    ["Email",         s(data.email),          "Location",         s(data.location)],
    ["Phone",         s(data.phone),          "Date",             letterDate],
  ];

  const gridCell = (text: string, isLabel: boolean) => new TableCell({
    width: { size: isLabel ? 18 : 32, type: WidthType.PERCENTAGE },
    borders: GRID_BORDERS,
    shading: isLabel ? LABEL_BG : undefined,
    margins: { top: 50, bottom: 50, left: isLabel ? 80 : 60, right: isLabel ? 60 : 80 },
    children: [new Paragraph({
      children: [new TextRun({ text, size: 20, bold: isLabel, color: isLabel ? "1A2B4A" : "222222", font: "Avenir Next" })],
      spacing: { after: 0 },
    })],
  });

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: patientRows.map(([l1, v1, l2, v2]) => new TableRow({
      children: [gridCell(l1, true), gridCell(v1, false), gridCell(l2, true), gridCell(v2, false)],
    })),
  }));
  children.push(gap());

  // ── Hebrew section (RTL) ───────────────────────────────────────────────
  const diagHE = s(data.diagHE);
  const sumHE  = s(data.sumHE);
  const planHE = arr(data.planStepsHE);
  if (diagHE || sumHE || planHE.length > 0) {
    children.push(gap(80));
    if (diagHE) {
      children.push(hebrewHeading("אבחנה"));
      diagHE.split("\n").filter(Boolean).forEach((l) => children.push(rtlLine(l)));
      children.push(gap(60));
    }
    if (sumHE) {
      children.push(hebrewHeading("סיכום"));
      sumHE.split("\n").filter(Boolean).forEach((l) => children.push(rtlLine(l)));
      children.push(gap(60));
    }
    if (planHE.length > 0) {
      children.push(hebrewHeading("תכנית"));
      planHE.forEach((step, i) => children.push(numberedHE(i + 1, step)));
      children.push(gap(60));
    }
  }

  // ── English clinical ───────────────────────────────────────────────────
  const diagEN = s(data.diagEN);
  const sumEN  = s(data.sumEN);
  const planEN = arr(data.planStepsEN);
  if (diagEN) {
    children.push(sectionHeading("Diagnosis"));
    diagEN.split("\n").filter(Boolean).forEach((l) => children.push(bodyLine(l)));
    children.push(gap());
  }
  if (sumEN) {
    children.push(sectionHeading("Summary"));
    sumEN.split("\n").filter(Boolean).forEach((l) => children.push(bodyLine(l)));
    children.push(gap());
  }
  if (planEN.length > 0) {
    children.push(sectionHeading("Plan"));
    planEN.forEach((step, i) => children.push(numberedEN(i + 1, step)));
    children.push(gap());
  }

  // ── History ────────────────────────────────────────────────────────────
  const medH = s(data.medHistory);
  if (medH) { children.push(sectionHeading("Medical History")); medH.split("\n").filter(Boolean).forEach((l) => children.push(bodyLine(l))); children.push(gap()); }
  const famH = s(data.famHistory);
  if (famH) { children.push(sectionHeading("Family History")); famH.split("\n").filter(Boolean).forEach((l) => children.push(bodyLine(l))); children.push(gap()); }

  // ── Medications / Allergies / Vaccinations ─────────────────────────────
  const meds = arr(data.medications);
  if (meds.length > 0) { children.push(sectionHeading("Medications")); meds.forEach((m) => children.push(bodyLine(`•  ${m}`))); children.push(gap()); }
  const allergies = arr(data.allergies);
  if (allergies.length > 0) { children.push(sectionHeading("Allergies")); allergies.forEach((a) => children.push(bodyLine(`•  ${a}`))); children.push(gap()); }
  const vaccinations = arr(data.vaccinations);
  if (vaccinations.length > 0) { children.push(sectionHeading("Vaccinations")); children.push(bodyLine(vaccinations.join(",  "))); children.push(gap()); }

  // ── Examination ────────────────────────────────────────────────────────
  const examFields: [string, string][] = [
    ["Appearance",          s(data.appearance)],
    ["Fingernail Clubbing", s(data.clubbing)],
    ["Lymphadenopathy",     s(data.lymph)],
    ["Blood Pressure",      s(data.bp)],
    ["Pulse",               s(data.pulse) ? `${s(data.pulse)} bpm` : ""],
    ["Respiratory Rate",    s(data.rr) ? `${s(data.rr)} breaths/min` : ""],
    ["SpO2",                s(data.spo2) ? `${s(data.spo2)}%` : ""],
    ["Heart Sounds",        s(data.heartSounds)],
    ["Lung Auscultation",   s(data.lungAusc)],
    ["Other Findings",      s(data.otherFindings)],
  ].filter(([, v]) => !!v) as [string, string][];
  if (examFields.length > 0) {
    children.push(sectionHeading("Examination"));
    examFields.forEach(([label, value]) => { const p = lv(label, value); if (p) children.push(p); });
    children.push(gap());
  }

  // ── Test Results + Lung Function ───────────────────────────────────────
  testResultsBlocks(data).forEach((b) => children.push(b));
  lungFunctionBlocks(data).forEach((b) => children.push(b));

  // ── Pictures ───────────────────────────────────────────────────────────
  const pictures = arr(data.pictures);
  if (pictures.length > 0) {
    children.push(sectionHeading("Images"));
    for (let i = 0; i < pictures.length; i++) {
      children.push(new Paragraph({
        children: [new TextRun({ text: `IMAGE ${i + 1}`, bold: true, size: 22, color: "000000", font: "Avenir Next" })],
        spacing: { before: 100, after: 40 },
      }));
      const imgResult = await fetchImageAny(pictures[i]);
      if (imgResult) {
        try {
          children.push(new Paragraph({
            children: [new ImageRun({
              data: new Uint8Array(imgResult.data),
              transformation: { width: 380, height: 285 },
              type: imgResult.type,
            })],
            border: {
              top:    { style: "single" as const, size: 4, color: "000000", space: 2 },
              bottom: { style: "single" as const, size: 4, color: "000000", space: 2 },
              left:   { style: "single" as const, size: 4, color: "000000", space: 2 },
              right:  { style: "single" as const, size: 4, color: "000000", space: 2 },
            },
            spacing: { after: 80 },
          }));
        } catch {
          children.push(bodyLine(`[Image ${i + 1} — could not be embedded]`));
        }
      } else {
        children.push(bodyLine(`[Image ${i + 1} — not available]`));
      }
    }
    children.push(gap());
  }

  // ── Inhalers ────────────────────────────────────────────────────────────
  type InhEntry = { name?: string; link?: string; imageUrl?: string };
  const inhEntries: InhEntry[] = Array.isArray(data.inhalers) ? data.inhalers as InhEntry[]
    : s(data.inhalerName) ? [{ name: s(data.inhalerName), link: s(data.inhalerLink), imageUrl: s(data.inhalerImageUrl) }] : [];
  if (inhEntries.some(e => e.name)) {
    children.push(sectionHeading("Inhalers — Patient to Purchase"));
    for (const inh of inhEntries) {
      const nm = s(inh.name);
      if (!nm) continue;
      children.push(bodyLine(nm));
      const lnk = s(inh.link);
      if (lnk) {
        children.push(new Paragraph({
          children: [
            new TextRun({ text: "Video guide: ", size: 20, font: "Avenir Next" }),
            new ExternalHyperlink({
              link: lnk,
              children: [new TextRun({ text: "Watch video guide on RightBreathe", size: 20, font: "Avenir Next", color: "4A90D9", underline: {} })],
            }),
          ],
          spacing: { after: 40 },
        }));
      }
    }
    children.push(gap());
  }

  // ── Important Notes + stamp ────────────────────────────────────────────
  const importantNoteTexts = [
    "מכתב זה הוא מסמך סודי המיועד רק למטופל, או למטפל מועמד ואנשי מקצוע בתחום הבריאות המעורבים בטיפול הרפואי הישיר במטופל. אם מסמך זה התקבל בטעות, אנא החזר אותו מיד לכתובת: lungdrsumit@gmail.com .",
    "יש להעביר מכתב זה לרופא המשפחה כדי לעיין בתוכנית הניהול והחקירה.",
    "כל ביקור במרפאה (כולל ביקורות מעקב ולאחר בדיקות) נדרשות בתשלום.",
  ];

  const PURPLE_BORDER  = { style: "single" as const, size: 12, color: "7C3AED", space: 4 };
  const PURPLE_BORDERS = { top: PURPLE_BORDER, bottom: PURPLE_BORDER, left: PURPLE_BORDER, right: PURPLE_BORDER };
  const WHITE_SHADING  = { type: ShadingType.SOLID, fill: "FFFFFF", color: "FFFFFF" };

  const notesHeading = new Paragraph({
    children: [new TextRun({ text: "נקודות חשובות", bold: true, size: 24, color: "160B5C", font: "Avenir Next" })],
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    border: { bottom: { style: "single" as const, size: 4, color: "7C3AED", space: 4 } },
    spacing: { before: 60, after: 80 },
    shading: WHITE_SHADING,
  });

  const noteParas = importantNoteTexts.map((note, i) =>
    new Paragraph({
      children: [new TextRun({ text: `${RTL_MARK}${i + 1}.  ${note}`, size: 20, color: i === 2 ? "DC2626" : "160B5C", font: "Avenir Next" })],
      bidirectional: true,
      alignment: AlignmentType.RIGHT,
      spacing: { after: 80 },
      shading: WHITE_SHADING,
    })
  );

  if (mode === "final" && stampData) {
    let stampImg: Paragraph;
    try {
      stampImg = new Paragraph({
        children: [new ImageRun({ data: new Uint8Array(stampData), transformation: { width: 150, height: 150 }, type: "png" })],
        alignment: AlignmentType.CENTER,
        shading: WHITE_SHADING,
      });
    } catch {
      stampImg = new Paragraph({
        children: [new TextRun({ text: "[ Stamp ]", size: 20, font: "Avenir Next" })],
        alignment: AlignmentType.CENTER,
        shading: WHITE_SHADING,
      });
    }
    // Stamp left, important notes right — kept together with cantSplit
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: 38, type: WidthType.PERCENTAGE },
            borders: NO_BORDERS,
            shading: WHITE_SHADING,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 0, bottom: 0, left: 120, right: 120 },
            children: [stampImg],
          }),
          new TableCell({
            width: { size: 62, type: WidthType.PERCENTAGE },
            borders: PURPLE_BORDERS,
            shading: WHITE_SHADING,
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [notesHeading, ...noteParas],
          }),
        ],
      })],
    }));
  } else {
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            borders: PURPLE_BORDERS,
            shading: WHITE_SHADING,
            margins: { top: 80, bottom: 80, left: 160, right: 160 },
            children: [notesHeading, ...noteParas],
          }),
        ],
      })],
    }));
  }
  children.push(gap(200));

  // ── Build document — A4, 1-inch margins ───────────────────────────────
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 720, footer: 720 },
        },
      },
      headers:  { default: docHeader },
      footers:  { default: docFooter },
      children,
    }],
  });

  return Packer.toBlob(doc);
}

// ─── Download helper ──────────────────────────────────────────────────────────

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href    = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Filename helpers ─────────────────────────────────────────────────────────

function safePart(raw: string): string {
  return (raw || "").replace(/[^a-zA-Zא-ת0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "Unknown";
}

function safeDate(date: string): string {
  if (date && /\d{1,2}\/\d{1,2}\/\d{4}/.test(date)) return date.replace(/\//g, "-");
  return new Date().toLocaleDateString("en-GB").replace(/\//g, "-");
}

function buildFilename(patId: string, fullName: string, location: string, date: string, ext: string): string {
  const id      = (patId    || "").replace(/[^a-zA-Z0-9]/g, "") || "NoID";
  const parts   = (fullName || "").trim().split(/\s+/);
  const surname = safePart(parts[parts.length - 1] || "UnknownSurname").toUpperCase();
  const loc     = safePart(location || "NoLocation");
  const d       = safeDate(date);
  return `${id}_${surname}_${loc}_${d}.${ext}`;
}

export function finalDocxFilename(patId: string, fullName: string, location: string, date: string): string {
  return buildFilename(patId, fullName, location, date, "docx");
}

export function finalPdfFilename(patId: string, fullName: string, location: string, date: string): string {
  return buildFilename(patId, fullName, location, date, "pdf");
}
