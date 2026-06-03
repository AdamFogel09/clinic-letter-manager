// Generates an editable .docx clinic letter.
// Apple Pages can open and edit .docx files — this is the practical editable-master
// workflow until native .pages generation is added.
//
// Later, when database/storage is added, every completed letter should save both:
//   - editable DOCX master file  (this output)
//   - final PDF patient file
// Each letter record should store: patient info, letter status, editable file,
// reviewed file, final PDF, date, and version history if needed later.

import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  Table, TableRow, TableCell, WidthType,
  Header, Footer, ImageRun, ShadingType, ExternalHyperlink,
} from "docx";

type LD = Record<string, unknown>;
type Block = Paragraph | Table;

// ─── Low-level helpers ────────────────────────────────────────────────────────

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function arr(v: unknown): string[] {
  return Array.isArray(v) ? (v as unknown[]).map((x) => s(x)).filter(Boolean) : [];
}

function gap(size = 80): Paragraph {
  return new Paragraph({ children: [], spacing: { after: size } });
}

function bodyLine(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, font: "Arial" })],
    spacing: { after: 60 },
  });
}

function rtlLine(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, font: "Arial" })],
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    spacing: { after: 60 },
  });
}

function lv(label: string, value: string): Paragraph | null {
  if (!value) return null;
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}:  `, bold: true, size: 22, font: "Arial" }),
      new TextRun({ text: value, size: 22, font: "Arial" }),
    ],
    spacing: { after: 60 },
  });
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 30, color: "1A2B4A", font: "Arial" })],
    spacing: { before: 360, after: 120 },
    border: { bottom: { style: "single" as const, size: 4, color: "160B5C", space: 4 } },
  });
}

function hebrewHeading(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 30, color: "1A2B4A", font: "Arial" })],
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    spacing: { before: 200, after: 80 },
  });
}

function subLabel(text: string, color = "475569"): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 18, bold: true, color, font: "Arial" })],
    spacing: { before: 80, after: 40 },
  });
}

// ─── Lung function two-row table ──────────────────────────────────────────────

interface LungRowRaw {
  date?: string;
  fev1l?: string; fev1p?: string; fvcl?: string; fvcp?: string;
  ratio?: string; fef?: string;
  tlcl?: string; tlc?: string; rvl?: string; rv?: string;
  dlco?: string; kco?: string; feno?: string; meta?: string; walk?: string; hwbmi?: string;
}

function makeTable(labels: string[], values: string[]): Table {
  const headerCells = labels.map(
    (label) =>
      new TableCell({
        children: [
          new Paragraph({
            children: [new TextRun({ text: label, size: 17, bold: true, color: "334155", font: "Arial" })],
            alignment: AlignmentType.CENTER,
          }),
        ],
      })
  );
  const valueCells = values.map(
    (val) =>
      new TableCell({
        children: [
          new Paragraph({
            children: [new TextRun({ text: val?.trim() || "—", size: 22, bold: true, color: "1A2B4A", font: "Arial" })],
            alignment: AlignmentType.CENTER,
          }),
        ],
      })
  );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: headerCells }),
      new TableRow({ children: valueCells }),
    ],
  });
}

function lungFunctionBlocks(data: LD): Block[] {
  const rows = Array.isArray(data.lungRows) ? (data.lungRows as LungRowRaw[]) : [];
  if (rows.length === 0) return [];

  const blocks: Block[] = [sectionHeading("Lung Function  /  תפקוד ריאות")];

  for (const row of rows) {
    if (row.date) {
      blocks.push(
        new Paragraph({
          children: [new TextRun({ text: `  Date: ${row.date}  `, bold: true, size: 20, color: "160B5C", font: "Arial" })],
          shading: { type: ShadingType.SOLID, fill: "F2A56B", color: "F2A56B" },
          spacing: { before: 200, after: 60 },
        })
      );
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

    blocks.push(gap(120));
  }

  return blocks;
}

// ─── Test results (simplified) ────────────────────────────────────────────────

function testResultsBlocks(data: LD): Block[] {
  const tr = (data.testResults ?? {}) as Record<string, unknown>;
  const blocks: Block[] = [];
  let hasAny = false;

  const push = (...items: (Block | null)[]) => {
    items.forEach((b) => { if (b) { blocks.push(b); hasAny = true; } });
  };

  // EKG
  const ekgVal = s((tr.ekg as Record<string, string>)?.value);
  const ekgDet = s((tr.ekg as Record<string, string>)?.details);
  if (ekgVal) {
    blocks.push(subLabel("EKG"));
    push(bodyLine(ekgVal === "Other" ? ekgDet : ekgVal));
  }

  // Echo
  if (s(tr.echo as string)) { blocks.push(subLabel("Echocardiogram")); push(bodyLine(s(tr.echo as string))); }

  // Blood tests
  const bl = tr.blood as Record<string, string> ?? {};
  if (bl.date || bl.testType || bl.details) {
    blocks.push(subLabel("Blood Tests"));
    push(lv("Date", s(bl.date)), lv("Type", s(bl.testType)), lv("Results", s(bl.details)));
  }

  // Sub-field groups
  const subGroups: [string, string, Record<string, string>][] = [
    ["Bronchoscopy Washing", "bronchWash", tr.bronchWash as Record<string, string>],
    ["Bronchoscopy Biopsy", "bronchBiopsy", tr.bronchBiopsy as Record<string, string>],
    ["EBUS", "ebus", tr.ebus as Record<string, string>],
    ["Pleural Fluid", "pleuralFluid", tr.pleuralFluid as Record<string, string>],
    ["Pleural Biopsy", "pleuralBiopsy", tr.pleuralBiopsy as Record<string, string>],
  ];
  for (const [label, , groupData] of subGroups) {
    if (!groupData) continue;
    const entries = Object.entries(groupData).filter(([, v]) => s(v));
    if (entries.length > 0) {
      blocks.push(subLabel(label));
      entries.forEach(([k, v]) => push(lv(k.charAt(0).toUpperCase() + k.slice(1), s(v))));
    }
  }

  // Other test
  if (s(tr.otherTest as string)) { blocks.push(subLabel("Other Test")); push(bodyLine(s(tr.otherTest as string))); }

  if (!hasAny) return [];
  return [sectionHeading("Test Results"), ...blocks, gap()];
}

// ─── Image fetch ──────────────────────────────────────────────────────────────

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

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateLetterDocx(
  data: LD,
  mode: "review" | "final" = "review"
): Promise<Blob> {
  const [logoData, stampData] = await Promise.all([
    fetchImage("/clinic-logo.png"),
    mode === "final" ? fetchImage("/stamp.png") : Promise.resolve(null),
  ]);

  // ── Page header (logo on every page) ─────────────────────────────────
  let headerPara: Paragraph;
  if (logoData) {
    try {
      headerPara = new Paragraph({
        children: [
          new ImageRun({
            data: new Uint8Array(logoData),
            transformation: { width: 280, height: 84 },
            type: "png",
          }),
        ],
        alignment: AlignmentType.CENTER,
        border: { bottom: { style: "single" as const, size: 8, color: "1A2B4A", space: 4 } },
        spacing: { after: 0 },
      });
    } catch {
      headerPara = new Paragraph({
        children: [new TextRun({ text: "DR. SUMIT CHATTERJI  —  CLINIC", bold: true, size: 28, color: "1A2B4A", font: "Arial" })],
        alignment: AlignmentType.CENTER,
        border: { bottom: { style: "single" as const, size: 8, color: "1A2B4A", space: 4 } },
      });
    }
  } else {
    headerPara = new Paragraph({
      children: [new TextRun({ text: "DR. SUMIT CHATTERJI  —  CLINIC", bold: true, size: 28, color: "1A2B4A", font: "Arial" })],
      alignment: AlignmentType.CENTER,
      border: { bottom: { style: "single" as const, size: 8, color: "1A2B4A", space: 4 } },
    });
  }
  const docHeader = new Header({ children: [headerPara] });

  // ── Page footer (contact details on every page) ────────────────────────
  const footerNoBorder = { style: "none" as const, size: 0, color: "FFFFFF", space: 0 };
  const footerCellBorders = { top: footerNoBorder, bottom: footerNoBorder, left: footerNoBorder, right: footerNoBorder };
  const docFooter = new Footer({
    children: [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 60, type: WidthType.PERCENTAGE },
                borders: footerCellBorders,
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: "Israel Medical Licence 1-143320", bold: true, size: 15, color: "1A2B4A", font: "Arial" })],
                    border: { top: { style: "single" as const, size: 12, color: "1A2B4A", space: 4 } },
                    spacing: { before: 40, after: 20 },
                  }),
                  new Paragraph({
                    children: [new TextRun({ text: "General Medical Council (UK) Licence 4630182", bold: true, size: 15, color: "1A2B4A", font: "Arial" })],
                    spacing: { after: 20 },
                  }),
                  new Paragraph({
                    children: [new TextRun({ text: "Internal Medicine and Pulmonology", bold: true, size: 15, color: "1A2B4A", font: "Arial" })],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 40, type: WidthType.PERCENTAGE },
                borders: footerCellBorders,
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: "Email: lungdrsumit@gmail.com", bold: true, size: 15, color: "1A2B4A", font: "Arial" })],
                    alignment: AlignmentType.RIGHT,
                    border: { top: { style: "single" as const, size: 12, color: "1A2B4A", space: 4 } },
                    spacing: { before: 40, after: 20 },
                  }),
                  new Paragraph({
                    children: [new TextRun({ text: "Telephone: +972 53 3065358", bold: true, size: 15, color: "1A2B4A", font: "Arial" })],
                    alignment: AlignmentType.RIGHT,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // ── Document body ──────────────────────────────────────────────────────
  const children: Block[] = [];

  // Letter date + mode banner
  const letterDate = [s(data.dateDay), s(data.dateMonth), s(data.dateYear)].filter(Boolean).join(" / ");
  if (letterDate) {
    children.push(new Paragraph({
      children: [new TextRun({ text: `Date:  ${letterDate}`, size: 22, color: "64748B", font: "Arial" })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: mode === "review" ? 200 : 320 },
    }));
  }

  if (mode === "review") {
    children.push(new Paragraph({
      children: [new TextRun({ text: "REVIEW DRAFT  —  Prepared for Anat. Please edit and return.", size: 20, color: "BE123C", italics: true, font: "Arial" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }));
  }

  // Patient details — two-column layout matching the Letter Preview
  children.push(sectionHeading("Patient Details"));

  // Compute age
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

  const noBorder = { style: "none" as const, size: 0, color: "FFFFFF", space: 0 };
  const cellBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

  const leftPatientFields  = [lv("Name", s(data.name)), lv("ID", s(data.patId)), lv("Date of Birth", dob), lv("Age / Gender", ageGender), lv("Email", s(data.email)), lv("Phone", s(data.phone))].filter(Boolean) as Paragraph[];
  const rightPatientFields = [lv("Smoking / Vaping", s(data.smoking)), lv("Pets", s(data.pets)), lv("Occupation", s(data.occupation)), lv("Referred By", s(data.referredBy)), lv("Location", s(data.location)), lv("Date", letterDate)].filter(Boolean) as Paragraph[];

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({
      children: [
        new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, borders: cellBorders, children: leftPatientFields.length  ? leftPatientFields  : [new Paragraph({ children: [] })] }),
        new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, borders: cellBorders, children: rightPatientFields.length ? rightPatientFields : [new Paragraph({ children: [] })] }),
      ],
    })],
  }));
  children.push(gap());

  // Hebrew section (RTL)
  const diagHE = s(data.diagHE);
  const sumHE  = s(data.sumHE);
  const planHE = arr(data.planStepsHE);
  if (diagHE || sumHE || planHE.length > 0) {
    children.push(sectionHeading("Hebrew  /  עברית"));
    if (diagHE) {
      children.push(hebrewHeading("אבחנה  —  Diagnosis"));
      diagHE.split("\n").filter(Boolean).forEach((l) => children.push(rtlLine(l)));
      children.push(gap());
    }
    if (sumHE) {
      children.push(hebrewHeading("סיכום  —  Summary"));
      sumHE.split("\n").filter(Boolean).forEach((l) => children.push(rtlLine(l)));
      children.push(gap());
    }
    if (planHE.length > 0) {
      children.push(hebrewHeading("תכנית  —  Plan"));
      planHE.forEach((step, i) => children.push(rtlLine(`${i + 1}.  ${step}`)));
      children.push(gap());
    }
  }

  // English clinical
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
    planEN.forEach((step, i) => children.push(bodyLine(`${i + 1}.  ${step}`)));
    children.push(gap());
  }

  // History
  const medH = s(data.medHistory);
  if (medH) { children.push(sectionHeading("Medical History")); medH.split("\n").filter(Boolean).forEach((l) => children.push(bodyLine(l))); children.push(gap()); }
  const famH = s(data.famHistory);
  if (famH) { children.push(sectionHeading("Family History")); famH.split("\n").filter(Boolean).forEach((l) => children.push(bodyLine(l))); children.push(gap()); }

  // Medications / Allergies / Vaccinations
  const meds = arr(data.medications);
  if (meds.length > 0) { children.push(sectionHeading("Medications")); meds.forEach((m) => children.push(bodyLine(`•  ${m}`))); children.push(gap()); }
  const allergies = arr(data.allergies);
  if (allergies.length > 0) { children.push(sectionHeading("Allergies")); allergies.forEach((a) => children.push(bodyLine(`•  ${a}`))); children.push(gap()); }
  const vaccinations = arr(data.vaccinations);
  if (vaccinations.length > 0) { children.push(sectionHeading("Vaccinations")); children.push(bodyLine(vaccinations.join(",  "))); children.push(gap()); }

  // Examination
  const examFields: [string, string][] = [
    ["Appearance",         s(data.appearance)],
    ["Fingernail Clubbing",s(data.clubbing)],
    ["Lymphadenopathy",    s(data.lymph)],
    ["Blood Pressure",     s(data.bp)],
    ["Pulse",              s(data.pulse) ? `${s(data.pulse)} bpm` : ""],
    ["Respiratory Rate",   s(data.rr) ? `${s(data.rr)} breaths/min` : ""],
    ["SpO2",               s(data.spo2) ? `${s(data.spo2)}%` : ""],
    ["Heart Sounds",       s(data.heartSounds)],
    ["Lung Auscultation",  s(data.lungAusc)],
    ["Other Findings",     s(data.otherFindings)],
  ].filter(([, v]) => !!v) as [string, string][];
  if (examFields.length > 0) {
    children.push(sectionHeading("Examination"));
    examFields.forEach(([label, value]) => { const p = lv(label, value); if (p) children.push(p); });
    children.push(gap());
  }

  // Test results
  testResultsBlocks(data).forEach((b) => children.push(b));

  // Lung function
  lungFunctionBlocks(data).forEach((b) => children.push(b));

  // Inhaler
  const inhalerName = s(data.inhalerName);
  if (inhalerName) {
    children.push(sectionHeading("Inhaler — Patient to Purchase"));
    children.push(bodyLine(inhalerName));
    const inhalerLink = s(data.inhalerLink);
    if (inhalerLink) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: "Video guide: ", size: 22, font: "Arial" }),
          new ExternalHyperlink({
            link: inhalerLink,
            children: [
              new TextRun({
                text: "Watch video guide on RightBreathe",
                size: 22, font: "Arial",
                color: "4A90D9", underline: {},
              }),
            ],
          }),
        ],
        spacing: { after: 60 },
      }));
    }
    children.push(gap());
  }

  // Important notes (Hebrew, RTL) + stamp — always at the end, inside a light-purple framed box
  const importantNoteTexts = [
    "מכתב זה הוא מסמך סודי המיועד רק למטופל, או למטפל מועמד ואנשי מקצוע בתחום הבריאות המעורבים בטיפול הרפואי הישיר במטופל. אם מסמך זה התקבל בטעות, אנא החזר אותו מיד לכתובת: lungdrsumit@gmail.com .",
    "יש להעביר מכתב זה לרופא המשפחה כדי לעיין בתוכנית הניהול והחקירה.",
    "כל ביקור במרפאה (כולל ביקורות מעקב ולאחר בדיקות) נדרשות בתשלום.",
  ];

  const purpleBorder  = { style: "single" as const, size: 12, color: "7C3AED", space: 4 };
  const invisBorder   = { style: "none"   as const, size: 0,  color: "FFFFFF", space: 0 };
  const purpleCellBorders = { top: purpleBorder,   bottom: purpleBorder,   left: purpleBorder,   right: purpleBorder };
  const noCellBorders     = { top: invisBorder, bottom: invisBorder, left: invisBorder, right: invisBorder };
  const whiteShading  = { type: ShadingType.SOLID, fill: "FFFFFF", color: "FFFFFF" };

  const headingPara = new Paragraph({
    children: [new TextRun({ text: "נקודות חשובות", bold: true, size: 28, color: "160B5C", font: "Arial" })],
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    border: { bottom: { style: "single" as const, size: 6, color: "7C3AED", space: 4 } },
    spacing: { before: 80, after: 160 },
    shading: whiteShading,
  });

  // ‏ = Right-to-Left Mark — anchors the number to the right side in Word's bidi engine
  const noteParas = importantNoteTexts.map((note, i) =>
    new Paragraph({
      children: [new TextRun({ text: `‏${i + 1}.  ${note}`, size: 22, color: i === 2 ? "DC2626" : "160B5C", font: "Arial" })],
      bidirectional: true,
      alignment: AlignmentType.RIGHT,
      spacing: { after: 100 },
      shading: whiteShading,
    })
  );

  if (mode === "final" && stampData) {
    // Stamp (left, no border) | Important Notes box (right, purple border) — row kept together
    let stampImg: Paragraph;
    try {
      stampImg = new Paragraph({
        children: [new ImageRun({ data: new Uint8Array(stampData), transformation: { width: 160, height: 160 }, type: "png" })],
        alignment: AlignmentType.CENTER,
        shading: whiteShading,
      });
    } catch {
      stampImg = new Paragraph({
        children: [new TextRun({ text: "[ Stamp ]", size: 22, font: "Arial" })],
        alignment: AlignmentType.CENTER,
        shading: whiteShading,
      });
    }
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            borders: noCellBorders,
            shading: whiteShading,
            children: [stampImg],
          }),
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            borders: purpleCellBorders,
            shading: whiteShading,
            children: [headingPara, ...noteParas],
          }),
        ],
      })],
    }));
  } else {
    // No stamp: full-width purple-bordered box
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            borders: purpleCellBorders,
            shading: whiteShading,
            children: [headingPara, ...noteParas],
          }),
        ],
      })],
    }));
  }
  children.push(gap(240));

  const doc = new Document({
    sections: [{
      properties: {},
      headers: { default: docHeader },
      footers: { default: docFooter },
      children,
    }],
  });

  return Packer.toBlob(doc);
}

// ─── Download helper ──────────────────────────────────────────────────────────

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
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
  // Converts DD/MM/YYYY → DD-MM-YYYY, or falls back to today
  if (date && /\d{1,2}\/\d{1,2}\/\d{4}/.test(date)) return date.replace(/\//g, "-");
  return new Date().toLocaleDateString("en-GB").replace(/\//g, "-"); // DD-MM-YYYY
}

function buildFilename(patId: string, fullName: string, location: string, date: string, ext: string): string {
  const id   = (patId    || "").replace(/[^a-zA-Z0-9]/g, "") || "NoID";
  const parts = (fullName || "").trim().split(/\s+/);
  const surname = safePart(parts[parts.length - 1] || "UnknownSurname").toUpperCase();
  const loc  = safePart(location || "NoLocation");
  const d    = safeDate(date);
  return `${id}_${surname}_${loc}_${d}.${ext}`;
}

// Final "Ready for Patient" DOCX — [ID]_[SURNAME]_[LOCATION]_[DATE].docx
export function finalDocxFilename(patId: string, fullName: string, location: string, date: string): string {
  return buildFilename(patId, fullName, location, date, "docx");
}

// Final PDF — [ID]_[SURNAME]_[LOCATION]_[DATE].pdf
export function finalPdfFilename(patId: string, fullName: string, location: string, date: string): string {
  return buildFilename(patId, fullName, location, date, "pdf");
}
