// Supabase is now the source of truth for patients and letters.
// Temporary storage should only be used as a fallback during development.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { StoredLetter, LetterStatus } from "@/lib/letterStore";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  ekg:          { value: "", details: "" },
  echo:         "",
  blood:        { date: "", testType: "", details: "" },
  bronchWash:   { microbiology: "", cytology: "", cellCounts: "" },
  bronchBiopsy: { pathology: "", microbiology: "" },
  ebus:         { cytology: "" },
  pleuralFluid: { cytology: "", microbiology: "", biochemistry: "", cellCounts: "" },
  pleuralBiopsy:{ pathology: "", microbiology: "" },
  otherTest:    "",
  selected: {
    echo: false, blood: false, otherTest: false,
    bronchWash: [], bronchBiopsy: [], ebus: [], pleuralFluid: [], pleuralBiopsy: [],
  },
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
      // Clinical
      diagEN:      letter.diagnosis_english || "",
      diagHE:      letter.diagnosis_hebrew  || "",
      sumEN:       letter.summary_english   || "",
      sumHE:       letter.summary_hebrew    || "",
      planStepsEN: letter.plan_english?.length ? letter.plan_english : [""],
      planStepsHE: letter.plan_hebrew?.length  ? letter.plan_hebrew  : [""],
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
      // Test / lung / pictures / inhaler
      testResults:        letter.test_results         || DEFAULT_TEST_RESULTS,
      lungRows:           letter.lung_function_tests  || [],
      pictures:           letter.pictures             || [],
      inhalerName:        inh.name                    || "",
      inhalerLink:        inh.link                    || "",
      inhalerImageUrl:    inh.image_url               || "",
    } as Record<string, unknown>,
  };
}

// ─── Map editor state to Supabase column payload ──────────────────────────────

function editorDataToColumns(d: Record<string, unknown>, patientId?: string, status?: LetterStatus, date?: string) {
  return {
    ...(patientId ? { patient_id: patientId } : {}),
    ...(status    ? { status }               : {}),
    letter_date:         date ?? (d.dateDay && d.dateMonth && d.dateYear
      ? `${d.dateDay}/${d.dateMonth}/${d.dateYear}` : ""),
    diagnosis_english:   (d.diagEN      as string) || "",
    diagnosis_hebrew:    (d.diagHE      as string) || "",
    summary_english:     (d.sumEN       as string) || "",
    summary_hebrew:      (d.sumHE       as string) || "",
    plan_english:        (d.planStepsEN as string[]) || [],
    plan_hebrew:         (d.planStepsHE as string[]) || [],
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
    inhaler: {
      name:      (d.inhalerName     as string) || "",
      link:      (d.inhalerLink     as string) || "",
      image_url: (d.inhalerImageUrl as string) || "",
    },
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
  } else if (!data) {
    console.error("[updateLetterStatus] Letter not found or permission denied.");
  }
}

/** Anat saves only the Hebrew translation fields. */
export async function updateLetterHebrew(
  supabase: SupabaseClient,
  id: string,
  hebrew: { diagHE: string; sumHE: string; planHE: string[] }
): Promise<void> {
  const { error } = await supabase
    .from("letters")
    .update({
      diagnosis_hebrew: hebrew.diagHE,
      summary_hebrew:   hebrew.sumHE,
      plan_hebrew:      hebrew.planHE,
    })
    .eq("id", id);
  if (error) console.error("Supabase Hebrew update error:", error);
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
