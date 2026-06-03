import Link from "next/link";
import LetterHeader from "@/components/letter/LetterHeader";
import LetterFooter from "@/components/letter/LetterFooter";

// ─── Style constants ──────────────────────────────────────────────────────────

const S: React.CSSProperties = { fontSize: 12, color: "#1A2B4A", lineHeight: 1.75, margin: 0 };
const L: React.CSSProperties = { fontSize: 10, color: "#94A3B8", minWidth: 126, flexShrink: 0 };

const TH: React.CSSProperties = {
  padding: "5px 8px", textAlign: "left", fontWeight: 700,
  color: "#64748B", fontSize: 9.5, whiteSpace: "nowrap",
  borderBottom: "1px solid #E2E8F0", backgroundColor: "#F4F6F9",
};
const TD: React.CSSProperties = {
  padding: "5px 8px", color: "#1A2B4A", fontSize: 9.5,
  whiteSpace: "nowrap", borderBottom: "1px solid #F8FAFC",
};

// ─── Section components ───────────────────────────────────────────────────────

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ borderBottom: "1px solid #E2E8F0", marginBottom: 10, paddingBottom: 5 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#1A2B4A" }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function BiSec({ en, he, children }: { en: string; he: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "2px solid #1A2B4A", marginBottom: 12, paddingBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#1A2B4A" }}>{en}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#1A2B4A" }}>{he}</span>
      </div>
      {children}
    </div>
  );
}

function LV({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
      <span style={L}>{label}</span>
      <span style={S}>{value}</span>
    </div>
  );
}

// ─── A4 page block ────────────────────────────────────────────────────────────

function Page({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{
      backgroundColor: "white", borderRadius: 4, overflow: "hidden",
      boxShadow: "0 4px 6px -1px rgb(0 0 0/0.07), 0 20px 60px rgb(26 43 74/0.12)",
    }}>
      <LetterHeader />
      <div style={{ padding: "28px 40px", minHeight: last ? undefined : 880 }}>
        {children}
      </div>
      <LetterFooter />
    </div>
  );
}

// ─── Lung function sub-table ──────────────────────────────────────────────────

function LungTable({ cols, vals, widths }: { cols: string[]; vals: string[]; widths: string[] }) {
  return (
    <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed", marginBottom: 6 }}>
      <colgroup>
        {widths.map((w, i) => <col key={i} style={{ width: w }} />)}
      </colgroup>
      <thead>
        <tr>{cols.map(c => <th key={c} style={TH}>{c}</th>)}</tr>
      </thead>
      <tbody>
        <tr>{vals.map((v, i) => <td key={i} style={TD}>{v}</td>)}</tr>
      </tbody>
    </table>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TemplatePreviewPage() {
  return (
    <div style={{ backgroundColor: "#F4F6F9", minHeight: "100vh", padding: "32px 16px" }}>

      {/* Toolbar */}
      <div style={{ maxWidth: 794, margin: "0 auto 20px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Link href="/workspace/letter-editor"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, color: "#64748B", textDecoration: "none", marginRight: "auto" }}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
            <path d="M10 12L6 8l4-4" />
          </svg>
          Back to Editor
        </Link>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#1A2B4A" }}>Letter Preview</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {["Export Word", "Export PDF"].map(label => (
            <button key={label} disabled
              style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", backgroundColor: "white", border: "1px solid #E2E8F0", borderRadius: 10, padding: "7px 14px", cursor: "not-allowed", opacity: 0.6 }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Pages */}
      <div style={{ maxWidth: 794, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* ── PAGE 1: Patient Details · Hebrew only (Diagnosis · Summary · Plan) ── */}
        <Page>
          <BiSec en="Patient Details" he="פרטי המטופל">
            <div style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: "14px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px 32px" }}>
              <LV label="Name"             value="Jonathan Smith" />
              <LV label="ID"               value="123456789" />
              <LV label="Date of Birth"    value="15 / 06 / 1982" />
              <LV label="Age"              value="43 years, 11 months" />
              <LV label="Gender"           value="Male" />
              <LV label="Email"            value="j.smith@email.com" />
              <LV label="Phone"            value="+972-50-123-4567" />
              <LV label="Smoking / Vaping" value="Non-smoker" />
              <LV label="Pets"             value="None" />
              <LV label="Occupation"       value="Retired teacher" />
              <LV label="Referred By"      value="Private" />
              <LV label="Location"         value="HMC" />
              <LV label="Date"             value="30 / 05 / 2026" />
            </div>
          </BiSec>

          {/* Diagnosis — Hebrew only */}
          <Sec title="אבחנה">
            <p style={{ ...S, direction: "rtl", textAlign: "right" }}>
              יתר לחץ דם חיוני (I10). אסתמה קלה, מבוקרת היטב (J45.20).
            </p>
          </Sec>

          {/* Summary — Hebrew only */}
          <Sec title="סיכום">
            <p style={{ ...S, direction: "rtl", textAlign: "right" }}>
              מר ג&apos;ונתן סמית הגיע לקליניקה ב-30 במאי 2026 לביקורת תקופתית.
              לחץ הדם בשליטה טובה תחת הטיפול הנוכחי. תסמיני האסתמה מינימליים ואינם מגבילים את פעילותו היומיומית.
            </p>
          </Sec>

          {/* Plan — Hebrew only */}
          <Sec title="תכנית">
            <ol dir="rtl" style={{ margin: 0, paddingRight: 18, paddingLeft: 0, textAlign: "right" }}>
              {[
                "המשך טיפול נוכחי ביתר לחץ דם. בדיקת לחץ דם חוזרת בעוד 3 חודשים.",
                "ספירומטריה חוזרת בעוד 6 חודשים לניטור מגמת תפקוד הריאות.",
                "חיסון שפעת שנתי מומלץ. הפניה לדיאטנית לשיפור תזונתי.",
              ].map((p, i) => <li key={i} style={{ ...S, direction: "rtl", marginBottom: 4 }}>{p}</li>)}
            </ol>
          </Sec>
        </Page>

        {/* ── PAGE 2: English only (Diagnosis · Summary · Plan) ── */}
        <Page>
          {/* Diagnosis — English only */}
          <Sec title="Diagnosis">
            <p style={S}>Essential hypertension (I10). Mild asthma, well-controlled (J45.20).</p>
          </Sec>

          {/* Summary — English only */}
          <Sec title="Summary">
            <p style={S}>
              Mr Jonathan Smith attended the clinic on 30 May 2026 for a routine review appointment.
              He reports an overall improvement in his general wellbeing. Blood pressure remains well-controlled
              on current therapy. Asthma symptoms are minimal and are not limiting his daily activities.
              Spirometry performed today shows stable lung function compared to the previous test in March 2026.
            </p>
          </Sec>

          {/* Plan — English only */}
          <Sec title="Plan">
            <ol style={{ margin: 0, paddingLeft: 18 }}>
              {[
                "Continue current antihypertensive medication. Blood pressure review in 3 months.",
                "Repeat spirometry in 6 months to monitor lung function trend.",
                "Annual influenza vaccination recommended. Referral for dietitian review.",
              ].map((p, i) => <li key={i} style={{ ...S, marginBottom: 4 }}>{p}</li>)}
            </ol>
          </Sec>
        </Page>

        {/* ── PAGE 2: Medical History · Family History · Medications · Allergies · Vaccinations · Examination ── */}
        <Page>
          <BiSec en="Medical History" he="היסטוריה רפואית">
            <p style={S}>
              Known essential hypertension diagnosed 2018, currently managed with Amlodipine.
              Mild intermittent asthma since childhood, well-controlled on short-acting bronchodilator.
              Hypercholesterolaemia, on statin therapy since 2021. No known cardiovascular events.
            </p>
          </BiSec>

          <BiSec en="Family History" he="היסטוריה משפחתית">
            <p style={S}>
              Father: ischaemic heart disease, deceased aged 71.
              Mother: type 2 diabetes mellitus, alive aged 76. No family history of malignancy reported.
            </p>
          </BiSec>

          <BiSec en="Medications" he="תרופות">
            <ol style={{ margin: 0, paddingLeft: 18 }}>
              {[
                "Salbutamol (Ventolin) 100mcg inhaler — 2 puffs PRN",
                "Amlodipine 5mg — once daily",
                "Atorvastatin 20mg — once daily at night",
              ].map((m, i) => <li key={i} style={{ ...S, marginBottom: 3 }}>{m}</li>)}
            </ol>
          </BiSec>

          <BiSec en="Allergies" he="אלרגיות">
            <p style={S}>Penicillin — rash. NSAIDs — mild gastrointestinal upset.</p>
          </BiSec>

          <BiSec en="Vaccinations" he="חיסונים">
            <p style={S}>Influenza (October 2025), Prevenar 13 (March 2024), Covid-19 booster (November 2024).</p>
          </BiSec>

          <BiSec en="Examination" he="בדיקה גופנית">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px 32px" }}>
              {[
                ["Appearance",              "Comfortable at rest"],
                ["Fingernail Clubbing",      "No"],
                ["Cervical Lymphadenopathy", "No"],
                ["Blood Pressure",           "132/84 mmHg"],
                ["Pulse",                    "74 bpm"],
                ["Respiratory Rate",         "16 breaths/min"],
                ["SpO2",                     "97%"],
                ["Heart Sounds",             "Normal"],
                ["Lung Auscultation",        "Clear bilaterally"],
              ].map(([label, value]) => <LV key={label} label={label} value={value} />)}
            </div>
          </BiSec>
        </Page>

        {/* ── PAGE 3: Test Results · Lung Function (both tables, same page) ── */}
        <Page>
          <BiSec en="Test Results" he="תוצאות בדיקות">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 32px" }}>
              {[
                ["EKG",         "Sinus rhythm. No acute changes. Normal axis."],
                ["Blood Tests", "FBC normal. HbA1c 5.8%. Creatinine 88 µmol/L. Cholesterol 4.2 mmol/L."],
              ].map(([label, value]) => (
                <div key={label}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 3px" }}>{label}</p>
                  <p style={S}>{value}</p>
                </div>
              ))}
            </div>
          </BiSec>

          {/* Lung Function — both tables under one heading, same page */}
          <BiSec en="Lung Function" he="תפקוד ריאות">
            <LungTable
              cols={["Date","FEV1 L","FEV1 %","FVC L","FVC %","FEV1/FVC %","FEF 25-75 %"]}
              vals={["15/03/2026","3.2","88","4.1","91","78","72"]}
              widths={["18%","12%","12%","12%","12%","14%","14%"]}
            />

            {/* Additional columns — no label, no Date column, sits directly below */}
            <LungTable
              cols={["TLC %","RV %","DLCO %","KCO %","FeNO","Metacholine","6 Min Walk","Ht/Wt/BMI"]}
              vals={["95","98","80","82","12","Negative","420m","172/78/26"]}
              widths={["10%","10%","11%","10%","10%","15%","15%","14%"]}
            />
          </BiSec>
        </Page>

        {/* ── PAGE 4 (last): Pictures · Inhalers · Hebrew Notes · Signature ── */}
        <Page last>
          <BiSec en="Pictures" he="תמונות">
            <div style={{ display: "flex", gap: 12 }}>
              {[1, 2, 3].map(n => (
                <div key={n} style={{ width: 150, height: 110, backgroundColor: "#F4F6F9", border: "1.5px dashed #CBD5E1", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 10, color: "#CBD5E1", fontWeight: 600 }}>Image {n}</span>
                </div>
              ))}
            </div>
          </BiSec>

          <BiSec en="Inhalers" he="סרטון המסביר איך להשתמש במשאף שלך">
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <LV label="Inhaler"     value="Salbutamol (Ventolin) 100mcg MDI" />
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <span style={L}>RightBreathe</span>
                  <span style={{ ...S, color: "#CBD5E1" }}>rightbreathe.com — link will be added here</span>
                </div>
              </div>
              <div style={{ width: 72, height: 72, backgroundColor: "#F4F6F9", border: "1.5px dashed #CBD5E1", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 9, color: "#CBD5E1", fontWeight: 600, textAlign: "center", lineHeight: 1.4 }}>Inhaler<br/>Image</span>
              </div>
            </div>
          </BiSec>

          {/* Hebrew Notes — always at end of letter */}
          <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: 24, marginTop: 12 }}>
            <div dir="rtl" style={{ textAlign: "right", marginBottom: 32 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: "#1A2B4A", margin: "0 0 10px" }}>נקודות חשובות</h3>
              {/* Placeholder — will be replaced with exact template text */}
              <ol style={{ margin: 0, padding: "0 18px 0 0" }}>
                {[
                  "מסמך זה נועד לשימוש רפואי פרטי בלבד.",
                  "המידע הכלול במסמך זה חסוי ומיועד לנמען בלבד.",
                  "לכל שאלה יש לפנות ישירות לרופא המטפל.",
                ].map((text, i) => (
                  <li key={i} style={{ ...S, direction: "rtl", marginBottom: 5 }}>{text}</li>
                ))}
              </ol>
            </div>

            {/* Signature / Stamp — last page only */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/stamp.png" alt="Stamp" style={{ height: 260, objectFit: "contain", display: "block", marginBottom: 8 }} />
          </div>
        </Page>

      </div>
    </div>
  );
}
