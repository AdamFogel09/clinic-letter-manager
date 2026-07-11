"use client";

import { useRef } from "react";
import type { ContactEntry } from "@/lib/supabase/patients";

const inputClass =
  "w-full px-4 py-2.5 rounded-xl border bg-white text-sm transition-colors duration-150 focus:outline-none";
const inputStyle = { borderColor: "#E2E8F0", color: "#1A2B4A" };

// Israeli mobile format: 05[operator digit]-[7 digits]. Extracted so both the
// new-patient form and the letter editor share one formatting implementation.
function IsraeliPhoneInput({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const restRef = useRef<HTMLInputElement>(null);
  const digits = value.replace(/\D/g, "");

  return (
    <div className="flex items-center rounded-xl border overflow-hidden flex-1" style={{ borderColor: "#E2E8F0" }}>
      <span
        className="px-3 py-2.5 bg-white text-sm font-semibold flex-shrink-0"
        style={{ color: "#94A3B8", borderRight: "1px solid #F4F6F9" }}
      >
        05
      </span>
      <input
        inputMode="numeric"
        maxLength={1}
        value={digits.slice(2, 3)}
        onChange={(e) => {
          const d1 = e.target.value.replace(/\D/g, "").slice(0, 1);
          const d2 = digits.slice(3, 10);
          onChange(d1 ? "05" + d1 + (d2 ? "-" + d2 : "") : "");
          if (d1) restRef.current?.focus();
        }}
        className="w-9 py-2.5 bg-white text-sm focus:outline-none text-center"
        style={{ color: "#1A2B4A" }}
        placeholder="0"
      />
      <span className="text-sm select-none" style={{ color: "#94A3B8" }}>-</span>
      <input
        ref={restRef}
        inputMode="numeric"
        maxLength={7}
        value={digits.slice(3, 10)}
        onChange={(e) => {
          const d2 = e.target.value.replace(/\D/g, "").slice(0, 7);
          const d1 = digits.slice(2, 3);
          onChange(d1 ? "05" + d1 + "-" + d2 : "05" + d2);
        }}
        className="flex-1 px-2 py-2.5 bg-white text-sm focus:outline-none"
        style={{ color: "#1A2B4A" }}
        placeholder="0000000"
      />
    </div>
  );
}

/** Ordered list editor for a patient's emails or phones — entry 0 is always the primary. */
export function ContactListField({
  type,
  label,
  entries,
  onChange,
}: {
  type: "email" | "phone";
  label: string;
  entries: ContactEntry[];
  onChange: (entries: ContactEntry[]) => void;
}) {
  const update = (i: number, patch: Partial<ContactEntry>) =>
    onChange(entries.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));

  const remove = (i: number) => onChange(entries.filter((_, idx) => idx !== i));

  const makePrimary = (i: number) => {
    const copy = entries.slice();
    const [item] = copy.splice(i, 1);
    copy.unshift(item);
    onChange(copy);
  };

  const add = () => onChange([...entries, { value: "", label: "" }]);

  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "#64748B" }}>
        {label}
      </label>
      <div className="space-y-2">
        {entries.map((entry, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                {i === 0 && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-1 rounded-full flex-shrink-0"
                    style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}
                  >
                    PRIMARY
                  </span>
                )}
                {type === "email" ? (
                  <input
                    type="email"
                    className={inputClass}
                    style={inputStyle}
                    value={entry.value}
                    onChange={(e) => update(i, { value: e.target.value })}
                    placeholder="Email address"
                  />
                ) : (
                  <IsraeliPhoneInput value={entry.value} onChange={(val) => update(i, { value: val })} />
                )}
              </div>
              <input
                className="w-full px-3 py-1.5 rounded-lg border bg-white text-xs focus:outline-none"
                style={{ borderColor: "#F1F5F9", color: "#64748B" }}
                value={entry.label}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder="Label (optional) — e.g. Son"
              />
            </div>
            <div className="flex flex-col gap-1 flex-shrink-0 items-end">
              {i !== 0 && (
                <button
                  type="button"
                  onClick={() => makePrimary(i)}
                  className="text-[10px] font-semibold px-2 py-1 rounded-lg border whitespace-nowrap"
                  style={{ borderColor: "#E2E8F0", color: "#64748B", background: "white" }}
                >
                  Make primary
                </button>
              )}
              <button
                type="button"
                onClick={() => remove(i)}
                className="w-6 h-6 flex items-center justify-center rounded-full"
                style={{ background: "#FEF2F2", color: "#DC2626" }}
              >
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="w-3 h-3">
                  <path d="M2 2l8 8M10 2l-8 8" />
                </svg>
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          className="text-xs font-semibold px-3 py-2 rounded-xl border transition-all duration-150"
          style={{ backgroundColor: "white", color: "#1A2B4A", borderColor: "#E2E8F0" }}
        >
          + Add another {type === "email" ? "email" : "phone"}
        </button>
      </div>
    </div>
  );
}
