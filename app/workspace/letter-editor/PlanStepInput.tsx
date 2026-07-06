"use client";

import { useEffect, useRef, useState } from "react";
import { PLAN_PRESETS, type PlanPreset } from "@/lib/planPresets";

const ic = "w-full px-4 py-2.5 rounded-xl border bg-white text-sm focus:outline-none transition-colors duration-150";
const is = { borderColor: "#E2E8F0", color: "#1A2B4A" };

interface Props {
  value: string;
  placeholder: string;
  onChange: (val: string) => void;
  onPresetSelect: (textEN: string, textHE: string) => void;
}

export default function PlanStepInput({ value, placeholder, onChange, onPresetSelect }: Props) {
  const [suggestions, setSuggestions] = useState<PlanPreset[]>([]);
  const [open, setOpen]               = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Filter presets whenever value changes
  useEffect(() => {
    const q = value.trim().toLowerCase();
    if (q.length < 2) { setSuggestions([]); setOpen(false); return; }
    const matches = PLAN_PRESETS.filter(p => p.textEN.toLowerCase().includes(q));
    setSuggestions(matches);
    setOpen(matches.length > 0);
    setActiveIndex(-1);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (preset: PlanPreset) => {
    onPresetSelect(preset.textEN, preset.textHE);
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      select(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // Highlight matched portion in suggestion text
  const highlight = (text: string, query: string, isActive: boolean) => {
    const q = query.trim().toLowerCase();
    if (!q) return <span>{text}</span>;
    const idx = text.toLowerCase().indexOf(q);
    if (idx === -1) return <span>{text}</span>;
    return (
      <>
        {text.slice(0, idx)}
        <strong style={{ color: isActive ? "#93C5FD" : "#1A2B4A" }}>{text.slice(idx, idx + q.length)}</strong>
        {text.slice(idx + q.length)}
      </>
    );
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        className={ic}
        style={is}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        autoComplete="off"
      />
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 50,
            backgroundColor: "white",
            border: "1px solid #E2E8F0",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgb(26 43 74 / 0.12)",
            maxHeight: 260,
            overflowY: "auto",
          }}
        >
          {suggestions.map((preset, i) => (
            <button
              key={preset.id}
              type="button"
              onMouseDown={e => { e.preventDefault(); select(preset); }}
              onMouseEnter={() => setActiveIndex(i)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "9px 14px",
                fontSize: 12,
                color: i === activeIndex ? "#fff" : "#475569",
                backgroundColor: i === activeIndex ? "#1A2B4A" : "transparent",
                border: "none",
                borderBottom: i < suggestions.length - 1 ? "1px solid #F1F5F9" : "none",
                cursor: "pointer",
                lineHeight: 1.45,
              }}
            >
              {highlight(preset.textEN, value.trim(), i === activeIndex)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
