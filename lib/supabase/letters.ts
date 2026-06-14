// Supabase is now the source of truth for patients and letters.
// Temporary storage should only be used as a fallback during development.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { StoredLetter, LetterStatus } from "@/lib/letterStore";

// ─── Types ────────────────────────────────────────────────────────────────────

/** One dated entry in the Summary section. Stored as JSONB in `summary_sections`. */
export interface SummarySection {
  id: string;
  date: string;                          // "DD/MM/YYYY"
  textEN: string;
  textHE: string;
  source: "copied" | "new" | "edited";
}

/** One item in the Diagnosis list. Stored as JSONB in `diagnosis_items`. */
export interface DiagnosisItem {
  id: string;
  textEN: string;
  textHE: string;
  source: "copied" | "new" | "edited";
}

/** One step in the Plan. Stored as JSONB in `plan_steps`. */
export interface PlanStep {
  id: string;
  textEN: string;
  textHE: string;
  source: "copied" | "new" | "edited";
}

// ─── Serialisers (structured → flat for backward-compat fields) ───────────────

export function sectionsToSumEN(sections: SummarySection[]): string {
  return sections
    .filter(s => s.textEN.trim())
    .map(s => s.date ? `${s.date}\n${s.textEN}` : s.textEN)
    .join("\n\n");
}

export function sectionsToSumHE(sections: SummarySection[]): string {
  return sections
    .filter(s => s.textHE.trim())
    .map(s => s.date ? `${s.date}\n${s.textHE}` : s.textHE)
    .join("\n\n");
}

export function diagItemsToEN(items: DiagnosisItem[]): string {
  return items.filter(i => i.textEN.trim()).map(i => i.textEN).join("\n");
}

export function diagItemsToHE(items: DiagnosisItem[]): string {
  return items.filter(i => i.textHE.trim()).map(i => i.textHE).join("\n");
}

export function planStepsToENArr(steps: PlanStep[]): string[] {
  return steps.map(s => s.textEN);
}

export function planStepsToHEArr(steps: PlanStep[]): string[] {
  return steps.map(s => s.textHE);
}

export interface SupabaseLetter {
  id: string;
  created_at: string;
  updated_at: string;
  patient_id: string;          // NOT NULL in schema — always required
  created_by: string;
  status: LetterStatus;
  letter_date: string | null;
  diagnosis_english: string | null;
  diagnosis_hebrew: string | null;
  summary_english: string | null;
  summary_hebrew: string | null;
  plan_english: string[];
  plan_hebrew: string[];
  medical_history: string | null;
  family_history: string | null;
  medications: string[];
  allergies: string[];
  vaccinations: string[];
  examination: Record<string, string>;
  test_results: Record<string, unknown>;
  lung_function_tests: Record<string, unknown>[];
  pictures: string[];
  inhaler: { name: string; link: string; image_url?: string };
  sent_to_anat_at: string | null;
  reviewed_at: string | null;
  approved_at: string | null;
  sent_to_patient_at: string | null;
  editable_docx_url: string | null;
  final_pdf_url: string | null;
  // File size tracking (bytes). Null until the relevant action has been performed.
  final_pdf_size_bytes:      number | null;
  editable_docx_size_bytes:  number | null;
  images_total_size_bytes:   number | null;
  total_storage_size_bytes:  number | null;
  summary_sections:  SummarySection[]   | null;
  diagnosis_items:   DiagnosisItem[]    | null;
  plan_steps:        PlanStep[]         | null;
  // Populated by Supabase join: .select("*, patients(*)")
  patients?: {
    full_name: string;
    patient_id_number: string;
    email: string;
    phone: string;
    gender: string;
    birthdate_day: string;
    birthdate_month: string;
    birthdate_year: string;
    smoking_vaping: string;
    pets: string;
    occupation: string;
    referred_by: string;
    location: string;
  } | null;
}

// Default test results shape — mirrors the letter editor's DEFAULT_TEST_RESULTS
const DEFAULT_TEST_RESULTS = {
  ekg:           [] as unknown[],
  echo:          [] as unknown[],
  blood:         [] as unknown[],
  bronchWash:    [] as unknown[],
  bronchBiopsy:  [] as unknown[],
  ebus:          [] as unknown[],
  pleuralFluid:  [] as unknown[],
  pleuralBiopsy: [] as unknown[],
  otherTests:    [] as unknown[],
};

// ─── Conversion ───────────────────────────────────────────────────────────────

/**
 * Convert a Supabase letter (with joined patient) to the StoredLetter shape
 * that all existing UI card components expect.
 */
export function supabaseLetterToStoredLetter(letter: SupabaseLetter): StoredLetter {
  const p    = letter.patients;
  const exam = (letter.examination || {}) as Record<string, string>;
  const inh  = (letter.inhaler    || {}) as Record<string, string>;
  const [dd, dm, dy] = (letter.letter_date || "").split("/");

  return {
    id:          letter.id,
    patientDbId: letter.patient_id,
    patientName: p?.full_name          || "",
    patientId:   p?.patient_id_number  || "",
    letterDate:  letter.letter_date    || "",
    status:      letter.status,
    savedAt:     letter.updated_at     || letter.created_at,
    reviewFileName:  letter.editable_docx_url
      ? letter.editable_docx_url.split("/").pop()
      : undefined,
    // Storage paths — present when the file has been uploaded to clinic-letters bucket
    finalPdfPath:      letter.final_pdf_url      || undefined,
    editableDocxPath:  letter.editable_docx_url?.includes("/")
      ? letter.editable_docx_url
      : undefined,
    finalPdfSizeBytes:     letter.final_pdf_size_bytes     ?? null,
    imagesTotalSizeBytes:  letter.images_total_size_bytes  ?? null,
    totalStorageSizeBytes: letter.total_storage_size_bytes ?? null,
    sentToEmail: undefined,
    data: {
      // Patient fields (from joined patient record)
      name:       p?.full_name         || "",
      patId:      p?.patient_id_number || "",
      bDay:       p?.birthdate_day     || "",
      bMonth:     p?.birthdate_month   || "",
      bYear:      p?.birthdate_year    || "",
      gender:     p?.gender            || "",
      email:      p?.email             || "",
      phone:      p?.phone             || "",
      smoking:    p?.smoking_vaping    || "",
      pets:       p?.pets              || "",
      occupation: p?.occupation        || "",
      referredBy: p?.referred_by       || "",
      location:   p?.location          || "",
      // Letter appointment date
      dateDay:   dd || "",
      dateMonth: dm || "",
      dateYear:  dy || "",
      // Clinical — flat fields kept for backward compat with preview/PDF
      diagEN:      letter.diagnosis_english || "",
      diagHE:      letter.diagnosis_hebrew  || "",
      sumEN:       letter.summary_english   || "",
      sumHE:       letter.summary_hebrew    || "",
      planStepsEN: letter.plan_english?.length ? letter.plan_english : [""],
      planStepsHE: letter.plan_hebrew?.length  ? letter.plan_hebrew  : [""],
      // Structured diagnosis items
      diagItems: letter.diagnosis_items?.length
        ? letter.diagnosis_items
        : (() => {
            const enLines = (letter.diagnosis_english || "").split("\n").filter(Boolean);
            const heLines = (letter.diagnosis_hebrew  || "").split("\n").filter(Boolean);
            if (!enLines.length && !heLines.length) return [];
            const len = Math.max(enLines.length, heLines.length, 1);
            return Array.from({ length: len }, (_, i) => ({
              id: `d-${letter.id.slice(0, 6)}-${i}`,
              textEN: enLines[i] || "",
              textHE: heLines[i] || "",
              source: "copied" as const,
            })) as DiagnosisItem[];
          })(),
      // Structured plan steps
      planSteps: letter.plan_steps?.length
        ? letter.plan_steps
        : (() => {
            const en = letter.plan_english?.length ? letter.plan_english : [""];
            const he = letter.plan_hebrew  || [];
            return en.map((textEN, i) => ({
              id: `p-${letter.id.slice(0, 6)}-${i}`,
              textEN,
              textHE: he[i] || "",
              source: "copied" as const,
            })) as PlanStep[];
          })(),
      // Structured summary sections
      summarySections: letter.summary_sections?.length
        ? letter.summary_sections
        : (letter.summary_english || letter.summary_hebrew)
          ? ([{
              id: `s-${letter.id.slice(0, 8)}`,
              date: letter.letter_date || "",
              textEN: letter.summary_english || "",
              textHE: letter.summary_hebrew  || "",
              source: "copied",
            }] as SummarySection[])
          : [],
      medHistory:  letter.medical_history   || "",
      famHistory:  letter.family_history    || "",
      medications: letter.medications       || [],
      allergies:   letter.allergies         || [],
      vaccinations: letter.vaccinations     || [],
      // Examination
      appearance:    exam.appearance    || "",
      clubbing:      exam.clubbing      || "",
      lymph:         exam.lymph         || "",
      bp:            exam.bp            || "",
      pulse:         exam.pulse         || "",
      rr:            exam.rr            || "",
      spo2:          exam.spo2          || "",
      heartSounds:   exam.heartSounds   || "",
      heartOther:    exam.heartOther    || "",
      lungAusc:      exam.lungAusc      || "",
      lungOther:     exam.lungOther     || "",
      otherFindings: exam.otherFindings || "",
      // Test / lung / pictures / inhalers
      testResults:        letter.test_results         || DEFAULT_TEST_RESULTS,
      lungRows:           letter.lung_function_tests  || [],
      pictures:           letter.pictures             || [],
      inhalers:           Array.isArray(letter.inhaler)
        ? letter.inhaler
        : (inh.name ? [{ id: "inh-0", name: inh.name, link: inh.link || "", imageUrl: inh.image_url || "" }] : []),
    } as Record<string, unknown>,
  };
}

// ─── Map editor state to Supabase column payload ──────────────────────────────

function editorDataToColumns(d: Record<string, unknown>, patientId?: string, status?: LetterStatus, date?: string) {
  // Structured items/steps → derive flat fields for backward compat
  const diagItems    = (d.diagItems    as DiagnosisItem[] | undefined) || [];
  const planSteps    = (d.planSteps    as PlanStep[]      | undefined) || [];
  const sumSections  = (d.summarySections as SummarySection[] | undefined) || [];

  const diagEN = diagItems.length > 0  ? diagItemsToEN(diagItems)        : ((d.diagEN      as string) || "");
  const diagHE = diagItems.length > 0  ? diagItemsToHE(diagItems)        : ((d.diagHE      as string) || "");
  const planEN = planSteps.length > 0  ? planStepsToENArr(planSteps)     : ((d.planStepsEN as string[]) || []);
  const planHE = planSteps.length > 0  ? planStepsToHEArr(planSteps)     : ((d.planStepsHE as string[]) || []);
  const sumEN  = sumSections.length > 0 ? sectionsToSumEN(sumSections)   : ((d.sumEN       as string) || "");
  const sumHE  = sumSections.length > 0 ? sectionsToSumHE(sumSections)   : ((d.sumHE       as string) || "");

  return {
    ...(patientId ? { patient_id: patientId } : {}),
    ...(status    ? { status }               : {}),
    letter_date:         date ?? (d.dateDay && d.dateMonth && d.dateYear
      ? `${d.dateDay}/${d.dateMonth}/${d.dateYear}` : ""),
    diagnosis_english:   diagEN,
    diagnosis_hebrew:    diagHE,
    summary_english:     sumEN,
    summary_hebrew:      sumHE,
    summary_sections:    sumSections,
    diagnosis_items:     diagItems,
    plan_steps:          planSteps,
    plan_english:        planEN,
    plan_hebrew:         planHE,
    medical_history:     (d.medHistory  as string) || "",
    family_history:      (d.famHistory  as string) || "",
    medications:         (d.medications as string[]) || [],
    allergies:           (d.allergies   as string[]) || [],
    vaccinations:        (d.vaccinations as string[]) || [],
    examination: {
      appearance:    (d.appearance    as string) || "",
      clubbing:      (d.clubbing      as string) || "",
      lymph:         (d.lymph         as string) || "",
      bp:            (d.bp            as string) || "",
      pulse:         (d.pulse         as string) || "",
      rr:            (d.rr            as string) || "",
      spo2:          (d.spo2          as string) || "",
      heartSounds:   (d.heartSounds   as string) || "",
      heartOther:    (d.heartOther    as string) || "",
      lungAusc:      (d.lungAusc      as string) || "",
      lungOther:     (d.lungOther     as string) || "",
      otherFindings: (d.otherFindings as string) || "",
    },
    test_results:        (d.testResults        as Record<string, unknown>) || {},
    lung_function_tests: (d.lungRows           as Record<string, unknown>[]) || [],
    pictures:            (d.pictures           as string[]) || [],
    inhaler:             (d.inhalers           as unknown[]) || [],
  };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

/**
 * Insert or update a letter. Throws on any error so callers can surface it.
 * If letterId is provided → UPDATE; otherwise → INSERT and return new UUID.
 */
export async function saveLetter(
  supabase: SupabaseClient,
  params: {
    letterId?:     string;
    patientId?:    string;
    status:        LetterStatus;
    letterDate:    string;
    letterData:    Record<string, unknown>;
    sentToAnatAt?: string;
  }
): Promise<{ id: string }> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Not authenticated — please log in and try again.");
  }

  const columns = {
    ...editorDataToColumns(
      params.letterData,
      params.patientId,
      params.status,
      params.letterDate,
    ),
    ...(params.sentToAnatAt ? { sent_to_anat_at: params.sentToAnatAt } : {}),
  };

  if (params.letterId) {
    const { data, error } = await supabase
      .from("letters")
      .update(columns)
      .eq("id", params.letterId)
      .eq("created_by", user.id)
      .select("id")
      .single();
    if (error) {
      console.error("[letters] update error:", error.code);
      throw new Error(error.message);
    }
    if (!data) throw new Error("Letter not found or permission denied.");
    return { id: data.id };
  } else {
    if (!params.patientId) {
      throw new Error("Cannot save letter: no patient selected. Please start from a patient.");
    }
    const { data, error } = await supabase
      .from("letters")
      .insert({ ...columns, created_by: user.id })
      .select("id")
      .single();
    if (error) {
      console.error("[letters] insert error:", error.code);
      throw new Error(error.message);
    }
    if (!data) throw new Error("Insert returned no data.");
    return { id: data.id };
  }
}

/** Fetch a single letter with its joined patient. */
export async function getLetterById(
  supabase: SupabaseClient,
  id: string
): Promise<SupabaseLetter | null> {
  const { data, error } = await supabase
    .from("letters")
    .select("*, patients(*)")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return data as SupabaseLetter;
}

/** Load letters by one or more statuses (joined with patient). Scoped to the logged-in user. */
export async function getLettersByStatus(
  supabase: SupabaseClient,
  statuses: LetterStatus[]
): Promise<StoredLetter[]> {
  const { data: { user } } = await supabase.auth.getUser();
  const baseQuery = supabase
    .from("letters")
    .select("*, patients(*)")
    .in("status", statuses)
    .order("updated_at", { ascending: false });
  const { data, error } = await (user
    ? baseQuery.eq("created_by", user.id)
    : baseQuery);
  if (error || !data) return [];
  return (data as SupabaseLetter[]).map(supabaseLetterToStoredLetter);
}

/** Load all letters (joined with patient). Returns StoredLetter[] for UI. */
export async function getAllLetters(
  supabase: SupabaseClient
): Promise<StoredLetter[]> {
  const { data, error } = await supabase
    .from("letters")
    .select("*, patients(*)")
    .order("updated_at", { ascending: false });
  if (error || !data) return [];
  return (data as SupabaseLetter[]).map(supabaseLetterToStoredLetter);
}

/** Update only status + optional timestamps. */
export async function updateLetterStatus(
  supabase: SupabaseClient,
  id: string,
  status: LetterStatus,
  extra?: {
    reviewedAt?:       string;
    approvedAt?:       string;
    sentToPatientAt?:  string;
    reviewFileName?:   string;
  }
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    console.error("[updateLetterStatus] No authenticated user.");
    return;
  }

  const payload: Record<string, unknown> = { status };
  if (extra?.reviewedAt)      payload.reviewed_at        = extra.reviewedAt;
  if (extra?.approvedAt)      payload.approved_at        = extra.approvedAt;
  if (extra?.sentToPatientAt) payload.sent_to_patient_at = extra.sentToPatientAt;
  if (extra?.reviewFileName)  payload.editable_docx_url  = extra.reviewFileName;

  const { data, error } = await supabase
    .from("letters")
    .update(payload)
    .eq("id", id)
    .eq("created_by", user.id)
    .select("id")
    .single();

  if (error) {
    console.error("[updateLetterStatus] error:", error.code, error.message);
    throw new Error(error.message || "Status update failed.");
  }
  if (!data) {
    console.error("[updateLetterStatus] Letter not found or permission denied.");
    throw new Error("Letter not found — it may have been deleted.");
  }
}

/** Anat saves only Hebrew translation fields — structured and flat. */
export async function updateLetterHebrew(
  supabase: SupabaseClient,
  id: string,
  hebrew: {
    diagHE: string;
    sumHE: string;
    planHE: string[];
    summarySections?: SummarySection[];
    diagItems?:       DiagnosisItem[];
    planSteps?:       PlanStep[];
  }
): Promise<void> {
  const payload: Record<string, unknown> = {
    diagnosis_hebrew: hebrew.diagHE,
    summary_hebrew:   hebrew.sumHE,
    plan_hebrew:      hebrew.planHE,
  };
  if (hebrew.summarySections) {
    payload.summary_sections = hebrew.summarySections;
    payload.summary_hebrew   = sectionsToSumHE(hebrew.summarySections) || hebrew.sumHE;
  }
  if (hebrew.diagItems) {
    payload.diagnosis_items  = hebrew.diagItems;
    payload.diagnosis_hebrew = diagItemsToHE(hebrew.diagItems) || hebrew.diagHE;
  }
  if (hebrew.planSteps) {
    payload.plan_steps  = hebrew.planSteps;
    payload.plan_hebrew = planStepsToHEArr(hebrew.planSteps);
  }
  const { error } = await supabase
    .from("letters")
    .update(payload)
    .eq("id", id);
  if (error) {
    console.error("Supabase Hebrew update error:", error);
    throw new Error(error.message || "Failed to save Hebrew translation.");
  }
}

/**
 * Update file size fields on a letters row.
 * Call after PDF export, image upload, or email send.
 * Only the fields you provide are written — undefined keys are skipped.
 * total_storage_size_bytes is always recomputed from the other three.
 */
export async function updateLetterFileSizes(
  supabase: SupabaseClient,
  letterId: string,
  sizes: {
    finalPdfSizeBytes?:     number;
    imagesSizeBytes?:       number;
    editableDocxSizeBytes?: number;
  }
): Promise<void> {
  // Fetch the current row so we can compute a correct total
  const { data: existing } = await supabase
    .from("letters")
    .select("final_pdf_size_bytes, images_total_size_bytes, editable_docx_size_bytes")
    .eq("id", letterId)
    .single();

  const pdfBytes  = sizes.finalPdfSizeBytes     ?? (existing?.final_pdf_size_bytes      ?? 0);
  const imgBytes  = sizes.imagesSizeBytes        ?? (existing?.images_total_size_bytes   ?? 0);
  const docxBytes = sizes.editableDocxSizeBytes  ?? (existing?.editable_docx_size_bytes  ?? 0);

  const payload: Record<string, number> = {
    total_storage_size_bytes: (pdfBytes || 0) + (imgBytes || 0) + (docxBytes || 0),
  };
  if (sizes.finalPdfSizeBytes     !== undefined) payload.final_pdf_size_bytes     = sizes.finalPdfSizeBytes;
  if (sizes.imagesSizeBytes       !== undefined) payload.images_total_size_bytes  = sizes.imagesSizeBytes;
  if (sizes.editableDocxSizeBytes !== undefined) payload.editable_docx_size_bytes = sizes.editableDocxSizeBytes;

  const { error } = await supabase.from("letters").update(payload).eq("id", letterId);
  if (error) {
    console.error("[updateLetterFileSizes]", error.message);
  } else {
    console.log(
      `[size] Updated letter ${letterId.slice(0, 8)}: PDF ${Math.round((pdfBytes||0)/1024)}KB · Images ${Math.round((imgBytes||0)/1024)}KB · Total ${Math.round(payload.total_storage_size_bytes/1024)}KB`
    );
  }
}

/**
 * Save Supabase Storage paths back to the letters row after file upload.
 * Pass only the fields you want to update — undefined keys are skipped.
 * Paths are relative to the "clinic-letters" bucket root.
 */
export async function updateLetterFileUrls(
  supabase: SupabaseClient,
  letterId: string,
  updates: { finalPdfUrl?: string; editableDocxUrl?: string }
): Promise<void> {
  const payload: Record<string, string> = {};
  if (updates.finalPdfUrl   !== undefined) payload.final_pdf_url      = updates.finalPdfUrl;
  if (updates.editableDocxUrl !== undefined) payload.editable_docx_url = updates.editableDocxUrl;
  if (!Object.keys(payload).length) return;
  const { error } = await supabase.from("letters").update(payload).eq("id", letterId);
  if (error) console.error("[updateLetterFileUrls]", error.message);
}

/**
 * Duplicate an existing letter into a new Draft for the same patient.
 * Copies all clinical content; sets status = Draft and letter_date = today.
 * The original letter is never modified.
 */
export async function duplicateLetter(
  supabase: SupabaseClient,
  sourceId: string
): Promise<{ id: string }> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated.");

  const source = await getLetterById(supabase, sourceId);
  if (!source) throw new Error("Source letter not found.");
  if (source.created_by !== user.id) throw new Error("Permission denied.");

  const now = new Date();
  const todayDate = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;

  // Build summary sections: mark previous ones as copied, add a new empty section for today
  const prevSections: SummarySection[] = source.summary_sections?.length
    ? source.summary_sections.map(s => ({ ...s, source: "copied" as const }))
    : (source.summary_english || source.summary_hebrew)
      ? [{ id: `s-${source.id.slice(0, 8)}`, date: source.letter_date || "", textEN: source.summary_english || "", textHE: source.summary_hebrew || "", source: "copied" as const }]
      : [];
  const newSections: SummarySection[] = [
    ...prevSections,
    { id: `s-new-${Date.now().toString(36)}`, date: todayDate, textEN: "", textHE: "", source: "new" },
  ];
  const newSumEN = sectionsToSumEN(newSections);
  const newSumHE = sectionsToSumHE(newSections);

  // Copy diagnosis as a single block (mark as copied)
  const copiedDiagItems: DiagnosisItem[] = source.diagnosis_items?.length
    ? [{ ...source.diagnosis_items[0], textEN: diagItemsToEN(source.diagnosis_items), textHE: diagItemsToHE(source.diagnosis_items), source: "copied" as const }]
    : (() => {
        const en = (source.diagnosis_english || "").trim();
        const he = (source.diagnosis_hebrew  || "").trim();
        if (!en && !he) return [];
        return [{ id: `d-dup-${Date.now().toString(36)}-0`, textEN: en, textHE: he, source: "copied" as const }];
      })();
  const newDiagEN = diagItemsToEN(copiedDiagItems) || source.diagnosis_english || "";
  const newDiagHE = diagItemsToHE(copiedDiagItems) || source.diagnosis_hebrew  || "";

  // Copy plan steps (mark as copied)
  const copiedPlanSteps: PlanStep[] = source.plan_steps?.length
    ? source.plan_steps.map(s => ({ ...s, source: "copied" as const }))
    : (() => {
        const en = source.plan_english || [];
        const he = source.plan_hebrew  || [];
        return en.map((textEN, i) => ({
          id: `p-dup-${Date.now().toString(36)}-${i}`,
          textEN, textHE: he[i] || "",
          source: "copied" as const,
        }));
      })();
  const newPlanEN = planStepsToENArr(copiedPlanSteps).length ? planStepsToENArr(copiedPlanSteps) : (source.plan_english || []);
  const newPlanHE = planStepsToHEArr(copiedPlanSteps).length ? planStepsToHEArr(copiedPlanSteps) : (source.plan_hebrew  || []);

  const { data, error } = await supabase
    .from("letters")
    .insert({
      patient_id:          source.patient_id,
      created_by:          user.id,
      status:              "Draft" as LetterStatus,
      letter_date:         todayDate,
      diagnosis_english:   newDiagEN,
      diagnosis_hebrew:    newDiagHE,
      diagnosis_items:     copiedDiagItems,
      summary_english:     newSumEN,
      summary_hebrew:      newSumHE,
      summary_sections:    newSections,
      plan_english:        newPlanEN,
      plan_hebrew:         newPlanHE,
      plan_steps:          copiedPlanSteps,
      medical_history:     source.medical_history     || "",
      family_history:      source.family_history      || "",
      medications:         source.medications         || [],
      allergies:           source.allergies           || [],
      vaccinations:        source.vaccinations        || [],
      examination:         source.examination         || {},
      test_results:        source.test_results        || {},
      lung_function_tests: source.lung_function_tests || [],
      pictures:            source.pictures            || [],
      inhaler:             source.inhaler             || [],
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message || "Failed to create update letter.");
  return { id: data.id };
}

/**
 * Delete all letters for a patient except the given one — both storage files
 * (PDF, DOCX) and the DB rows. Called immediately after duplicateLetter() so
 * only the new update draft survives.
 */
export async function deleteOldLettersForPatient(
  supabase: SupabaseClient,
  currentLetterId: string,
  patientUuid: string,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data, error } = await supabase
    .from("letters")
    .select("id, final_pdf_url, editable_docx_url")
    .eq("patient_id", patientUuid)
    .eq("created_by", user.id)
    .neq("id", currentLetterId);

  if (error || !data || data.length === 0) return;

  // Delete storage files for each old letter
  const storagePaths = (data as { id: string; final_pdf_url: string | null; editable_docx_url: string | null }[])
    .flatMap(r => [r.final_pdf_url, r.editable_docx_url].filter((p): p is string => !!p));

  if (storagePaths.length > 0) {
    const { error: storageErr } = await supabase.storage.from("clinic-letters").remove(storagePaths);
    if (storageErr) console.warn("[deleteOldLettersForPatient] Storage delete error:", storageErr.message);
  }

  // Delete the DB rows
  const oldIds = (data as { id: string }[]).map(r => r.id);
  const { error: deleteErr } = await supabase
    .from("letters")
    .delete()
    .in("id", oldIds)
    .eq("created_by", user.id);

  if (deleteErr) {
    console.warn("[deleteOldLettersForPatient] DB delete error:", deleteErr.message);
  } else {
    console.log(`[deleteOldLettersForPatient] Deleted ${oldIds.length} old letter(s) for patient ${patientUuid.slice(0, 8)}`);
  }
}

/**
 * After a new final PDF is successfully saved, delete old PDF and DOCX files from
 * Supabase Storage for every OTHER letter belonging to the same patient.
 * Safe: never touches the current letter. DB rows are only cleared after storage
 * deletion succeeds, so partial failures leave data consistent.
 */
export async function cleanupOldLetterFiles(
  supabase: SupabaseClient,
  currentLetterId: string,
  patientUuid: string
): Promise<void> {
  const { data, error } = await supabase
    .from("letters")
    .select("id, final_pdf_url, editable_docx_url")
    .eq("patient_id", patientUuid)
    .neq("id", currentLetterId);

  if (error || !data) {
    console.warn("[cleanupOldLetterFiles] Could not load old letters:", error?.message);
    return;
  }

  for (const row of data as { id: string; final_pdf_url: string | null; editable_docx_url: string | null }[]) {
    const paths = [row.final_pdf_url, row.editable_docx_url].filter((p): p is string => !!p);
    if (paths.length === 0) continue;

    const { error: deleteErr } = await supabase.storage.from("clinic-letters").remove(paths);
    if (deleteErr) {
      console.warn(`[cleanupOldLetterFiles] Storage delete failed for letter ${row.id.slice(0, 8)}:`, deleteErr.message);
      continue;
    }

    const clear: Record<string, null> = {};
    if (row.final_pdf_url)     clear.final_pdf_url     = null;
    if (row.editable_docx_url) clear.editable_docx_url = null;

    const { error: updateErr } = await supabase.from("letters").update(clear).eq("id", row.id);
    if (updateErr) {
      console.warn(`[cleanupOldLetterFiles] DB clear failed for letter ${row.id.slice(0, 8)}:`, updateErr.message);
    } else {
      console.log(`[cleanupOldLetterFiles] Deleted ${paths.length} old file(s) for letter ${row.id.slice(0, 8)}`);
    }
  }
}

/** Count letters per status for dashboard cards. Scoped to the logged-in user. */
export async function getLetterCounts(
  supabase: SupabaseClient
): Promise<Record<string, number>> {
  const { data: { user } } = await supabase.auth.getUser();
  const baseQuery = supabase.from("letters").select("status");
  const { data, error } = await (user
    ? baseQuery.eq("created_by", user.id)
    : baseQuery);
  if (error || !data) return {};
  const counts: Record<string, number> = {};
  for (const row of data) {
    counts[row.status] = (counts[row.status] || 0) + 1;
  }
  return counts;
}
