"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { savePatient } from "@/lib/supabase/patients";

const inputClass =
  "w-full px-4 py-2.5 rounded-xl border bg-white text-sm transition-colors duration-150 focus:outline-none";
const inputStyle = { borderColor: "#E2E8F0", color: "#1A2B4A" };
const labelClass = "block text-xs font-semibold uppercase tracking-wide mb-1.5";
const labelStyle = { color: "#64748B" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelClass} style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function NavySelect({
  value,
  onChange,
  options,
  placeholder = "Select",
}: {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border bg-white text-sm transition-all duration-150 focus:outline-none"
        style={{
          borderColor: value ? "#1A2B4A" : "#E2E8F0",
          color: value ? "#1A2B4A" : "#94A3B8",
        }}
      >
        <span className={value ? "font-medium" : ""}>{value || placeholder}</span>
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-3.5 h-3.5 flex-shrink-0 transition-transform duration-150"
          style={{
            color: "#1A2B4A",
            transform: open ? "rotate(180deg)" : "none",
          }}
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl z-20 overflow-hidden"
          style={{
            border: "1px solid #E2E8F0",
            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.07), 0 8px 24px rgb(26 43 74 / 0.10)",
          }}
        >
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => { onChange(opt); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-sm transition-colors duration-100"
              style={{
                color: opt === value ? "#1A2B4A" : "#64748B",
                fontWeight: opt === value ? 600 : 400,
                backgroundColor: opt === value ? "#F4F6F9" : "transparent",
              }}
              onMouseEnter={(e) => {
                if (opt !== value) (e.currentTarget as HTMLElement).style.backgroundColor = "#F4F6F9";
              }}
              onMouseLeave={(e) => {
                if (opt !== value) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function calcAge(day: string, month: string, year: string): string {
  const d = parseInt(day), m = parseInt(month), y = parseInt(year);
  if (!d || !m || !y || y < 1900 || y > new Date().getFullYear()) return "";
  const birth = new Date(y, m - 1, d);
  if (isNaN(birth.getTime()) || birth.getMonth() !== m - 1) return "";
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months--;
  if (months < 0) { years--; months += 12; }
  if (years < 0) return "";
  if (years === 0) return `${months} month${months !== 1 ? "s" : ""}`;
  return `${years} year${years !== 1 ? "s" : ""}, ${months} month${months !== 1 ? "s" : ""}`;
}

export default function NewPatientPage() {
  const router  = useRouter();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [form, setForm] = useState({
    name: "",
    id: "",
    day: "",
    month: "",
    year: "",
    gender: "",
    smoking: "",
    pets: "",
    email: "",
    phone: "",
    occupation: "",
    referredBy: "",
    location: "",
    dateDay: String(new Date().getDate()).padStart(2, "0"),
    dateMonth: String(new Date().getMonth() + 1).padStart(2, "0"),
    dateYear: String(new Date().getFullYear()),
  });

  const monthRef      = useRef<HTMLInputElement>(null);
  const yearRef       = useRef<HTMLInputElement>(null);
  const dateMonthRef  = useRef<HTMLInputElement>(null);
  const dateYearRef   = useRef<HTMLInputElement>(null);
  const phoneRestRef  = useRef<HTMLInputElement>(null);

  const set = (key: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleDay = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 2);
    setForm((f) => ({ ...f, day: val }));
    if (val.length === 2) monthRef.current?.focus();
  };

  const handleMonth = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 2);
    setForm((f) => ({ ...f, month: val }));
    if (val.length === 2) yearRef.current?.focus();
  };

  const handleYear = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 4);
    setForm((f) => ({ ...f, year: val }));
  };

  const handleDateDay = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 2);
    setForm((f) => ({ ...f, dateDay: val }));
    if (val.length === 2) dateMonthRef.current?.focus();
  };

  const handleDateMonth = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 2);
    setForm((f) => ({ ...f, dateMonth: val }));
    if (val.length === 2) dateYearRef.current?.focus();
  };

  const handleDateYear = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 4);
    setForm((f) => ({ ...f, dateYear: val }));
  };

  const age = calcAge(form.day, form.month, form.year);

  // Patients and letters are now stored in Supabase.
  // Letters are now saved to Supabase. Temporary storage is only fallback for unsaved draft state.
  const handleStartLetter = async () => {
    setSaving(true);
    setSaveError("");

    const supabase = createClient();
    const { patient, error } = await savePatient(supabase, {
      full_name:          form.name,
      patient_id_number:  form.id,
      birthdate_day:      form.day,
      birthdate_month:    form.month,
      birthdate_year:     form.year,
      calculated_age:     age,
      gender:             form.gender,
      email:              form.email,
      phone:              form.phone,
      smoking_vaping:     form.smoking,
      pets:               form.pets,
      occupation:         form.occupation,
      referred_by:        form.referredBy,
      location:           form.location,
    });

    if (error) {
      setSaveError("Could not save patient: " + error);
      setSaving(false);
      return;
    }

    // Pass patient data + Supabase UUID to the letter editor so the letter is linked to this patient.
    sessionStorage.setItem("draft_patient", JSON.stringify({
      ...form,
      age,
      ...(patient ? { supabase_patient_id: patient.id } : {}),
    }));
    sessionStorage.removeItem("letter_draft");
    sessionStorage.removeItem("letter_draft_id");
    sessionStorage.removeItem("letter_supabase_id");
    router.push("/workspace/letter-editor");
  };

  return (
    <div className="flex-1 pb-12">
      {/* Page header */}
      <div className="px-6 sm:px-8 pt-8 pb-6">
        <button
          onClick={() => window.history.length > 1 ? router.back() : router.push("/workspace")}
          className="inline-flex items-center gap-1.5 text-xs font-medium mb-5"
          style={{ color: "#94A3B8", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
            <path d="M10 12L6 8l4-4" />
          </svg>
          Back
        </button>
        <h1 className="text-xl sm:text-2xl font-bold" style={{ color: "#1A2B4A" }}>
          New Patient
        </h1>
        <p className="text-sm mt-1" style={{ color: "#94A3B8" }}>
          Create a patient profile and start their first clinic letter.
        </p>
      </div>

      {/* Form card */}
      <div className="px-6 sm:px-8">
        <div
          className="bg-white rounded-2xl border p-6 sm:p-8"
          style={{
            borderColor: "#E2E8F0",
            boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 4px 16px 0 rgb(26 43 74 / 0.05)",
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">

            {/* Name */}
            <Field label="Name">
              <input className={inputClass} style={inputStyle}
                value={form.name} onChange={set("name")}
                placeholder="Patient full name" />
            </Field>

            {/* ID */}
            <Field label="ID">
              <input className={inputClass} style={inputStyle}
                value={form.id} onChange={set("id")}
                placeholder="National ID or passport number" />
            </Field>

            {/* Birthdate — DD / MM / YYYY */}
            <Field label="Birthdate">
              <div className="flex items-center gap-2">
                <input
                  inputMode="numeric"
                  placeholder="DD"
                  maxLength={2}
                  value={form.day}
                  onChange={handleDay}
                  className="w-14 px-3 py-2.5 rounded-xl border bg-white text-sm text-center transition-colors duration-150 focus:outline-none"
                  style={inputStyle}
                />
                <span style={{ color: "#CBD5E1" }}>/</span>
                <input
                  ref={monthRef}
                  inputMode="numeric"
                  placeholder="MM"
                  maxLength={2}
                  value={form.month}
                  onChange={handleMonth}
                  className="w-14 px-3 py-2.5 rounded-xl border bg-white text-sm text-center transition-colors duration-150 focus:outline-none"
                  style={inputStyle}
                />
                <span style={{ color: "#CBD5E1" }}>/</span>
                <input
                  ref={yearRef}
                  inputMode="numeric"
                  placeholder="YYYY"
                  maxLength={4}
                  value={form.year}
                  onChange={handleYear}
                  className="w-20 px-3 py-2.5 rounded-xl border bg-white text-sm text-center transition-colors duration-150 focus:outline-none"
                  style={inputStyle}
                />
              </div>
            </Field>

            {/* Age / Gender */}
            <Field label="Age / Gender">
              <div className="flex gap-3">
                {/* Auto-calculated age */}
                <div
                  className="flex-1 px-4 py-2.5 rounded-xl border bg-white text-sm flex items-center"
                  style={{
                    borderColor: "#E2E8F0",
                    color: age ? "#1A2B4A" : "#CBD5E1",
                  }}
                >
                  {age || "Auto-calculated"}
                </div>
                {/* Gender */}
                <select
                  className="flex-1 px-4 py-2.5 rounded-xl border bg-white text-sm transition-colors duration-150 focus:outline-none"
                  style={inputStyle}
                  value={form.gender}
                  onChange={set("gender")}
                >
                  <option value="">Gender</option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>
            </Field>

            {/* Email */}
            <Field label="Email">
              <input type="email" className={inputClass} style={inputStyle}
                value={form.email} onChange={set("email")}
                placeholder="Patient email address" />
            </Field>

            {/* Phone — 05X-XXXXXXX structure */}
            <Field label="Phone">
              <div className="flex items-center rounded-xl border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
                {/* Fixed prefix */}
                <span className="px-3 py-2.5 bg-white text-sm font-semibold flex-shrink-0"
                  style={{ color: "#94A3B8", borderRight: "1px solid #F4F6F9" }}>
                  05
                </span>
                {/* 3rd digit — operator code (1 char, auto-advances) */}
                <input
                  inputMode="numeric"
                  maxLength={1}
                  value={form.phone.replace(/\D/g, "").slice(2, 3)}
                  onChange={e => {
                    const d1 = e.target.value.replace(/\D/g, "").slice(0, 1);
                    const d2 = form.phone.replace(/\D/g, "").slice(3, 10);
                    setForm(f => ({ ...f, phone: d1 ? ("05" + d1 + (d2 ? "-" + d2 : "")) : "" }));
                    if (d1) phoneRestRef.current?.focus();
                  }}
                  className="w-9 py-2.5 bg-white text-sm focus:outline-none text-center"
                  style={{ color: "#1A2B4A" }}
                  placeholder="0"
                />
                {/* Visual dash */}
                <span className="text-sm select-none" style={{ color: "#94A3B8" }}>-</span>
                {/* Remaining 7 digits */}
                <input
                  ref={phoneRestRef}
                  inputMode="numeric"
                  maxLength={7}
                  value={form.phone.replace(/\D/g, "").slice(3, 10)}
                  onChange={e => {
                    const d2 = e.target.value.replace(/\D/g, "").slice(0, 7);
                    const d1 = form.phone.replace(/\D/g, "").slice(2, 3);
                    setForm(f => ({ ...f, phone: d1 ? ("05" + d1 + "-" + d2) : ("05" + d2) }));
                  }}
                  className="flex-1 px-2 py-2.5 bg-white text-sm focus:outline-none"
                  style={{ color: "#1A2B4A" }}
                  placeholder="0000000"
                />
              </div>
              {form.phone.replace(/\D/g, "").length > 2 && form.phone.replace(/\D/g, "").length < 10 && (
                <p className="text-xs mt-1.5 font-medium" style={{ color: "#BE123C" }}>
                  Phone must be 10 digits (e.g. 050-5004009).
                </p>
              )}
            </Field>

            {/* Smoking / Vaping */}
            <Field label="Smoking / Vaping">
              <input className={inputClass} style={inputStyle}
                value={form.smoking} onChange={set("smoking")}
                placeholder="e.g. Non-smoker, 10/day" />
            </Field>

            {/* Pets */}
            <Field label="Pets">
              <input className={inputClass} style={inputStyle}
                value={form.pets} onChange={set("pets")}
                placeholder="e.g. Dog, Cat, None" />
            </Field>

            {/* Occupation */}
            <Field label="Occupation">
              <input className={inputClass} style={inputStyle}
                value={form.occupation} onChange={set("occupation")}
                placeholder="e.g. Teacher, Retired" />
            </Field>

            {/* Referred By */}
            <Field label="Referred By">
              <NavySelect
                value={form.referredBy}
                onChange={(val) => setForm((f) => ({ ...f, referredBy: val }))}
                options={["Private", "Assuta", "Raphael", "Harel", "Bwell"]}
                placeholder="Select"
              />
            </Field>

            {/* Location */}
            <Field label="Location">
              <NavySelect
                value={form.location}
                onChange={(val) => setForm((f) => ({ ...f, location: val }))}
                options={["HMC", "Alliance Clinic TLV", "TeleConsult", "Update"]}
                placeholder="Select"
              />
            </Field>

            {/* Date */}
            <Field label="Date">
              <div className="flex items-center gap-2">
                <input
                  inputMode="numeric"
                  placeholder="DD"
                  maxLength={2}
                  value={form.dateDay}
                  onChange={handleDateDay}
                  className="w-14 px-3 py-2.5 rounded-xl border bg-white text-sm text-center transition-colors duration-150 focus:outline-none"
                  style={inputStyle}
                />
                <span style={{ color: "#CBD5E1" }}>/</span>
                <input
                  ref={dateMonthRef}
                  inputMode="numeric"
                  placeholder="MM"
                  maxLength={2}
                  value={form.dateMonth}
                  onChange={handleDateMonth}
                  className="w-14 px-3 py-2.5 rounded-xl border bg-white text-sm text-center transition-colors duration-150 focus:outline-none"
                  style={inputStyle}
                />
                <span style={{ color: "#CBD5E1" }}>/</span>
                <input
                  ref={dateYearRef}
                  inputMode="numeric"
                  placeholder="YYYY"
                  maxLength={4}
                  value={form.dateYear}
                  onChange={handleDateYear}
                  className="w-20 px-3 py-2.5 rounded-xl border bg-white text-sm text-center transition-colors duration-150 focus:outline-none"
                  style={inputStyle}
                />
              </div>
            </Field>

          </div>

          {/* Actions */}
          <div className="mt-8 pt-6" style={{ borderTop: "1px solid #E2E8F0" }}>
            {saveError && (
              <div
                className="mb-4 px-4 py-3 rounded-xl text-sm"
                style={{ backgroundColor: "#FFF1F2", color: "#BE123C", border: "1px solid #FECDD3" }}
              >
                {saveError}
              </div>
            )}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => window.history.length > 1 ? router.back() : router.push("/workspace")}
                disabled={saving}
                className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold rounded-xl border transition-all duration-150 hover:-translate-y-px"
                style={{ borderColor: "#E2E8F0", color: "#64748B", background: "white", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleStartLetter}
                disabled={saving}
                className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold rounded-xl transition-all duration-150 hover:-translate-y-px hover:shadow-md"
                style={{ backgroundColor: "#1A2B4A", color: "#ffffff", opacity: saving ? 0.7 : 1 }}
              >
                {saving ? "Saving…" : "Create Patient & Start Letter"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
