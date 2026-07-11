// Patients are now stored in Supabase.
// Letters are still temporary (localStorage) and will be migrated next.

import type { SupabaseClient } from "@supabase/supabase-js";

// An ordered contact entry — index 0 in a Patient's emails/phones array is always the primary.
export interface ContactEntry {
  value: string;   // email address or phone number
  label: string;   // optional free-text tag, e.g. "Son" — empty string if none
}

export interface Patient {
  id: string;
  created_at: string;
  updated_at: string;
  full_name: string;
  patient_id_number: string;
  birthdate_day: string;
  birthdate_month: string;
  birthdate_year: string;
  calculated_age: string;
  gender: string;
  emails: ContactEntry[];
  phones: ContactEntry[];
  smoking_vaping: string;
  pets: string;
  occupation: string;
  referred_by: string;
  location: string;
  created_by: string;
}

export function getPrimaryEmail(entries: ContactEntry[] | undefined | null): string {
  return entries?.[0]?.value || "";
}

export function getPrimaryPhone(entries: ContactEntry[] | undefined | null): string {
  return entries?.[0]?.value || "";
}

export type NewPatientData = Omit<Patient, "id" | "created_at" | "updated_at" | "created_by">;

// Convert a Supabase Patient into the sessionStorage shape the Letter Editor expects.
// supabase_patient_id carries the DB UUID so the editor can link the new letter on save.
export function patientToDraft(p: Patient): Record<string, unknown> {
  return {
    supabase_patient_id: p.id,
    name:       p.full_name,
    id:         p.patient_id_number,
    day:        p.birthdate_day,
    month:      p.birthdate_month,
    year:       p.birthdate_year,
    gender:     p.gender,
    emails:     p.emails,
    phones:     p.phones,
    smoking:    p.smoking_vaping,
    pets:       p.pets,
    occupation: p.occupation,
    referredBy: p.referred_by,
    location:   p.location,
  };
}

export async function savePatient(
  supabase: SupabaseClient,
  data: NewPatientData
): Promise<{ patient: Patient | null; error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { patient: null, error: "Not authenticated" };

  const { data: patient, error } = await supabase
    .from("patients")
    .insert({ ...data, created_by: user.id })
    .select()
    .single();

  if (error) return { patient: null, error: error.message };
  return { patient: patient as Patient, error: null };
}

export async function getAllPatients(
  supabase: SupabaseClient
): Promise<Patient[]> {
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as Patient[];
}

// Server-side filtered search — uses Supabase ilike on name + ID columns.
/** Update patient_id_number (national/passport ID) from the letter editor. */
export async function updatePatientIdNumber(
  supabase: SupabaseClient,
  patientUuid: string,
  patientIdNumber: string,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from("patients")
    .update({ patient_id_number: patientIdNumber })
    .eq("id", patientUuid)
    .eq("created_by", user.id);
  if (error) console.error("[updatePatientIdNumber]", error.message);
}

export type EditablePatientFields = Partial<Omit<Patient, "id" | "created_at" | "updated_at" | "created_by" | "calculated_age">>;

export async function updatePatient(
  supabase: SupabaseClient,
  patientUuid: string,
  fields: EditablePatientFields,
): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const { error } = await supabase
    .from("patients")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", patientUuid)
    .eq("created_by", user.id);
  if (error) return { error: error.message };
  return { error: null };
}

export async function searchPatients(
  supabase: SupabaseClient,
  query: string
): Promise<Patient[]> {
  const q = query.trim();
  if (!q) return getAllPatients(supabase);

  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .or(`full_name.ilike.%${q}%,patient_id_number.ilike.%${q}%`)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as Patient[];
}
