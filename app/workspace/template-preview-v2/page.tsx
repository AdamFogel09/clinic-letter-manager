"use client";

import Link from "next/link";
import LetterHeader from "@/components/letter/LetterHeader";
import LetterFooter from "@/components/letter/LetterFooter";

// ─── Sample letter data ───────────────────────────────────────────────────────

const S = {
  name: "Jonathan Smith",        patId: "IL-8847231",
  dob: "14 / 03 / 1971",        age: "55 years, 2 months",
  gender: "Male",                email: "jonathan.smith@email.com",
  phone: "+972 50 123 4567",     smoking: "Non-smoker",
  pets: "Dog",                   occupation: "Accountant",
  referredBy: "Private",         location: "HMC",
  date: "30 / 05 / 2026",

  diagEN: "Essential hypertension (I10).\nMild asthma, well-controlled (J45.20).",
  diagHE: "יתר לחץ דם חיוני (I10).\nאסתמה קלה, מבוקרת היטב (J45.20).",

  sumEN:
    "Mr Jonathan Smith attended the clinic on 30 May 2026 for a routine review appointment. He reports an overall improvement in his general wellbeing. Blood pressure remains well-controlled on current therapy. Asthma symptoms are minimal and are not limiting his daily activities. Spirometry performed today shows stable lung function compared to the previous test in March 2026.",
  sumHE:
    "מר ג'ונתן סמית' הגיע למרפאה ב-30 במאי 2026 לביקור מעקב שגרתי. הוא מדווח על שיפור כללי ברווחתו. לחץ הדם נשאר מבוקר היטב תחת הטיפול הנוכחי. תסמיני האסתמה מינימליים ואינם מגבילים את פעילויות יומיומו.",

  medHistory:
    "Known essential hypertension diagnosed 2018, currently managed with Amlodipine. Mild intermittent asthma since childhood, well-controlled on short-acting bronchodilator. Hypercholesterolaemia, on statin therapy since 2021. No known cardiovascular events.",
  famHistory:
    "Father: ischaemic heart disease, deceased aged 71. Mother: type 2 diabetes mellitus, alive aged 76. No family history of malignancy reported.",

  medications: [
    "Salbutamol (Ventolin) 100mcg inhaler — 2 puffs PRN",
    "Amlodipine 5mg — once daily",
    "Atorvastatin 20mg — once daily at night",
  ],

  allergies: ["Penicillin — rash"],
  vaccinations: ["Influenza", "Covid 19"],

  examination: [
    ["Appearance",               "Comfortable at rest"],
    ["Fingernail Clubbing",      "No"],
    ["Cervical Lymphadenopathy", "No"],
    ["Blood Pressure",           "128/78"],
    ["Pulse",                    "72 bpm"],
    ["Respiratory Rate",         "14 breaths/min"],
    ["SpO2",                     "98%"],
    ["Heart Sounds",             "Normal"],
    ["Lung Auscultation",        "Clear"],
  ] as [string, string][],

  testResults: [
    { label: "EKG",         value: "Normal sinus rhythm. No acute changes." },
    { label: "Blood Tests", value: "FBC, U&E, LFTs — within normal limits. Total cholesterol 4.8 mmol/L. HbA1c 38 mmol/mol." },
  ],

  planEN:
    "1. Continue current antihypertensive medication. Blood pressure review in 3 months.\n2. Repeat spirometry in 6 months to monitor lung function trend.\n3. Annual influenza vaccination recommended.\n4. Referral for dietitian review.",
  planHE:
    "1. המשך תרופות נוכחיות ליתר לחץ דם. בדיקת לחץ דם בעוד 3 חודשים.\n2. חזרה על ספירומטריה בעוד 6 חודשים.\n3. חיסון שפעת שנתי מומלץ.\n4. הפניה לדיאטנית.",

  lungTests: [
    { date: "30/05/2026", fev1l: "3.42", fev1p: "94", fvcl: "4.18", fvcp: "96", ratio: "82", fef: "78", tlc: "91", rv: "88", dlco: "90", kco: "92", feno: "18", meta: "—", walk: "—", hwbmi: "178cm / 82kg / BMI 25.9" },
    { date: "15/03/2026", fev1l: "3.38", fev1p: "93", fvcl: "4.12", fvcp: "95", ratio: "82", fef: "76", tlc: "90", rv: "87", dlco: "89", kco: "91", feno: "20", meta: "—", walk: "—", hwbmi: "178cm / 83kg / BMI 26.2" },
  ],

  importantNotes: [
    "מסמך זה נועד לשימוש רפואי פרטי בלבד.",
    "המידע הכלול במסמך זה חסוי ומיועד לנמען בלבד.",
    "לכל שאלה יש לפנות ישירות לרופא המטפל.",
  ],
};

// ─── Layout primitives ────────────────────────────────────────────────────────

function A4Page({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{
      width: 794,
      minHeight: 1123,
      backgroundColor: "white",
      display: "flex",
      flexDirection: "column",
      boxShadow: "0 4px 6px -1px rgb(0 0 0/0.07), 0 20px 40px rgb(26 43 74/0.10)",
      marginBottom: last ? 0 : 28,
      breakAfter: last ? "auto" : "page",
      pageBreakAfter: last ? "auto" : "always",
    }}>
      <LetterHeader />
      <div style={{ flex: 1, padding: "20px 40px 28px" }}>
        {children}
      </div>
      <LetterFooter />
    </div>
  );
}

function DocSection({ title, titleHe, children }: {
  title: string; titleHe?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 14, breakInside: "avoid", pageBreakInside: "avoid" }}>
      <div style={{
        display: "flex",
        justifyContent: titleHe ? "space-between" : "flex-start",
        alignItems: "baseline",
        borderBottom: "2px solid #1A2B4A",
        paddingBottom: 5,
        marginBottom: 9,
      }}>
        <h3 style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#1A2B4A", margin: 0 }}>
          {title}
        </h3>
        {titleHe && (
          <span style={{ fontSize: 10, fontWeight: 700, color: "#1A2B4A", letterSpacing: "0.04em" }}>
            {titleHe}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function LV({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 3 }}>
      <span style={{ fontSize: 11, color: "#94A3B8", minWidth: 130, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 11, color: "#1A2B4A" }}>{value}</span>
    </div>
  );
}

function TextBlock({ text, rtl }: { text: string; rtl?: boolean }) {
  return (
    <p style={{
      fontSize: 11.5, color: "#1A2B4A", lineHeight: 1.65, margin: 0,
      direction: rtl ? "rtl" : "ltr", textAlign: rtl ? "right" : "left",
      whiteSpace: "pre-wrap",
    }}>
      {text}
    </p>
  );
}

function BiText({ en, he }: { en: string; he?: string }) {
  return (
    <>
      <TextBlock text={en} />
      {he && <div style={{ marginTop: 8 }}><TextBlock text={he} rtl /></div>}
    </>
  );
}

function LungCard({ t }: { t: typeof S.lungTests[0] }) {
  const row1: [string, string][] = [
    ["FEV1 L", t.fev1l], ["FEV1 %", t.fev1p], ["FVC L", t.fvcl],
    ["FVC %", t.fvcp], ["FEV1/FVC %", t.ratio], ["FEF 25-75 %", t.fef],
  ];
  const row2: [string, string][] = [
    ["TLC %", t.tlc], ["RV %", t.rv], ["DLCO %", t.dlco],
    ["KCO %", t.kco], ["FeNO", t.feno], ["Methacholine", t.meta], ["6 Min Walk", t.walk],
  ];
  const cell = (label: string, val: string, cols: number) => (
    <div key={label} style={{ textAlign: "center", gridColumn: `span 1` }}>
      <div style={{ fontSize: 8, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#1A2B4A" }}>{val || "—"}</div>
    </div>
  );
  return (
    <div style={{ border: "1px solid #E2E8F0", borderRadius: 8, overflow: "hidden", marginBottom: 10 }}>
      <div style={{ backgroundColor: "#F4F6F9", padding: "5px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#1A2B4A" }}>Date: {t.date}</span>
        <span style={{ fontSize: 10, color: "#64748B" }}>{t.hwbmi}</span>
      </div>
      <div style={{ padding: "8px 12px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: "4px 6px", marginBottom: 7 }}>
          {row1.map(([l, v]) => cell(l, v, 6))}
        </div>
        <div style={{ borderTop: "1px dashed #E2E8F0", marginBottom: 7 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "4px 6px" }}>
          {row2.map(([l, v]) => cell(l, v, 7))}
        </div>
      </div>
    </div>
  );
}

// ─── Print styles ─────────────────────────────────────────────────────────────

const printStyles = `
  @media print {
    body { margin: 0; background: white; }
    .no-print { display: none !important; }
    .a4-page { box-shadow: none !important; margin-bottom: 0 !important; }
    @page { size: A4; margin: 0; }
  }
`;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TemplatePreviewV2() {
  return (
    <>
      <style>{printStyles}</style>
      <div style={{ backgroundColor: "#F4F6F9", minHeight: "100vh", padding: "28px 16px" }}>

        {/* Toolbar */}
        <div className="no-print" style={{ maxWidth: 820, margin: "0 auto 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/workspace/letter-editor"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, color: "#64748B", textDecoration: "none" }}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
              <path d="M10 12L6 8l4-4" />
            </svg>
            Back to Editor
          </Link>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/workspace/letter-preview"
              style={{ fontSize: 12, fontWeight: 600, color: "#1A2B4A", backgroundColor: "white", border: "1px solid #E2E8F0", borderRadius: 10, padding: "8px 16px", textDecoration: "none" }}>
              Dynamic Preview
            </Link>
            <button onClick={() => window.print()}
              style={{ fontSize: 12, fontWeight: 600, color: "white", backgroundColor: "#1A2B4A", border: "none", borderRadius: 10, padding: "8px 16px", cursor: "pointer" }}>
              Print / Save PDF
            </button>
          </div>
        </div>

        {/* Pages */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>

          {/* ── PAGE 1: Patient · Diagnosis · Summary ── */}
          <div className="a4-page" style={{
            width: 794, minHeight: 1123, backgroundColor: "white", display: "flex", flexDirection: "column",
            boxShadow: "0 4px 6px -1px rgb(0 0 0/0.07), 0 20px 40px rgb(26 43 74/0.10)", marginBottom: 28,
            breakAfter: "page", pageBreakAfter: "always",
          }}>
            <LetterHeader />
            <div style={{ flex: 1, padding: "20px 40px 28px" }}>

              <DocSection title="Patient Details">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px 32px" }}>
                  <LV label="Name"           value={S.name} />
                  <LV label="ID"             value={S.patId} />
                  <LV label="Date of Birth"  value={S.dob} />
                  <LV label="Age"            value={S.age} />
                  <LV label="Gender"         value={S.gender} />
                  <LV label="Email"          value={S.email} />
                  <LV label="Phone"          value={S.phone} />
                  <LV label="Smoking / Vaping" value={S.smoking} />
                  <LV label="Pets"           value={S.pets} />
                  <LV label="Occupation"     value={S.occupation} />
                  <LV label="Referred By"    value={S.referredBy} />
                  <LV label="Location"       value={S.location} />
                  <LV label="Date"           value={S.date} />
                </div>
              </DocSection>

              <DocSection title="Diagnosis" titleHe="אבחנה">
                <BiText en={S.diagEN} he={S.diagHE} />
              </DocSection>

              <DocSection title="Summary" titleHe="סיכום">
                <BiText en={S.sumEN} he={S.sumHE} />
              </DocSection>

            </div>
            <LetterFooter />
          </div>

          {/* ── PAGE 2: History · Medications · Allergies · Vaccinations · Examination · Tests ── */}
          <div className="a4-page" style={{
            width: 794, minHeight: 1123, backgroundColor: "white", display: "flex", flexDirection: "column",
            boxShadow: "0 4px 6px -1px rgb(0 0 0/0.07), 0 20px 40px rgb(26 43 74/0.10)", marginBottom: 28,
            breakAfter: "page", pageBreakAfter: "always",
          }}>
            <LetterHeader />
            <div style={{ flex: 1, padding: "20px 40px 28px" }}>

              <DocSection title="Medical History" titleHe="היסטוריה רפואית">
                <TextBlock text={S.medHistory} />
              </DocSection>

              <DocSection title="Family History" titleHe="היסטוריה משפחתית">
                <TextBlock text={S.famHistory} />
              </DocSection>

              <DocSection title="Medications" titleHe="תרופות">
                <ul style={{ margin: 0, padding: "0 0 0 18px" }}>
                  {S.medications.map((m, i) => (
                    <li key={i} style={{ fontSize: 11.5, color: "#1A2B4A", lineHeight: 1.8 }}>{m}</li>
                  ))}
                </ul>
              </DocSection>

              <DocSection title="Allergies" titleHe="אלרגיות">
                <ul style={{ margin: 0, padding: "0 0 0 18px" }}>
                  {S.allergies.map((a, i) => (
                    <li key={i} style={{ fontSize: 11.5, color: "#1A2B4A", lineHeight: 1.8 }}>{a}</li>
                  ))}
                </ul>
              </DocSection>

              <DocSection title="Vaccinations" titleHe="חיסונים">
                <p style={{ fontSize: 11.5, color: "#1A2B4A", margin: 0 }}>{S.vaccinations.join(", ")}</p>
              </DocSection>

              <DocSection title="Examination" titleHe="בדיקה גופנית">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px 32px" }}>
                  {S.examination.map(([label, value]) => (
                    <LV key={label} label={label} value={value} />
                  ))}
                </div>
              </DocSection>

              <DocSection title="Test Results" titleHe="תוצאות בדיקות">
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {S.testResults.map(({ label, value }) => (
                    <div key={label}>
                      <p style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 2px" }}>{label}</p>
                      <p style={{ fontSize: 11.5, color: "#1A2B4A", margin: 0, lineHeight: 1.6 }}>{value}</p>
                    </div>
                  ))}
                </div>
              </DocSection>

            </div>
            <LetterFooter />
          </div>

          {/* ── PAGE 3: Plan · Lung Function ── */}
          <div className="a4-page" style={{
            width: 794, minHeight: 1123, backgroundColor: "white", display: "flex", flexDirection: "column",
            boxShadow: "0 4px 6px -1px rgb(0 0 0/0.07), 0 20px 40px rgb(26 43 74/0.10)", marginBottom: 28,
            breakAfter: "page", pageBreakAfter: "always",
          }}>
            <LetterHeader />
            <div style={{ flex: 1, padding: "20px 40px 28px" }}>

              <DocSection title="Plan" titleHe="תכנית">
                <BiText en={S.planEN} he={S.planHE} />
              </DocSection>

              <DocSection title="Lung Function" titleHe="תפקוד ריאות">
                {S.lungTests.map(t => <LungCard key={t.date} t={t} />)}
              </DocSection>

            </div>
            <LetterFooter />
          </div>

          {/* ── PAGE 4 (last): Important Notes · Stamp ── */}
          <div className="a4-page" style={{
            width: 794, minHeight: 1123, backgroundColor: "white", display: "flex", flexDirection: "column",
            boxShadow: "0 4px 6px -1px rgb(0 0 0/0.07), 0 20px 40px rgb(26 43 74/0.10)",
          }}>
            <LetterHeader />
            <div style={{ flex: 1, padding: "20px 40px 28px" }}>

              <DocSection title="Important Notes" titleHe="נקודות חשובות">
                <div style={{ direction: "rtl", textAlign: "right" }}>
                  <ol style={{ margin: 0, padding: "0 18px 0 0", listStyleType: "decimal" }}>
                    {S.importantNotes.map((text, i) => (
                      <li key={i} style={{ fontSize: 11.5, color: "#1A2B4A", lineHeight: 1.8, marginBottom: 4 }}>{text}</li>
                    ))}
                  </ol>
                </div>
              </DocSection>

              {/* Stamp */}
              <div style={{ marginTop: 32 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/stamp.png" alt="Stamp" style={{ height: 100, objectFit: "contain", display: "block" }} />
              </div>

            </div>
            <LetterFooter />
          </div>

        </div>
      </div>
    </>
  );
}
