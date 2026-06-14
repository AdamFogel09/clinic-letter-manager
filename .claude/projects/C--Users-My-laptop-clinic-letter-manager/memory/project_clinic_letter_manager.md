! vercel logout---
name: project-clinic-letter-manager
description: Stack, current state, and architectural decisions for the clinic-letter-manager app
metadata:
  type: project
---

Stack: Next.js 16 + TypeScript + Tailwind v4 + Supabase + React 19.

## Auth & Database
- Supabase connected: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`
- Browser client: `lib/supabase/client.ts` (createBrowserClient from @supabase/ssr)
- Server client: `lib/supabase/server.ts` (createServerClient, async cookies())
- Middleware: `middleware.ts` protects `/workspace/**`, unauthenticated → `/login`
- Login: email + password only, no sign-up, accounts created manually in Supabase Auth
- Logout: Sidebar button calls `supabase.auth.signOut()` then redirects to `/login`

## Supabase Tables (run SQL in Supabase SQL Editor)
- `supabase/patients_schema.sql` — patients table + RLS
- `supabase/letters_schema.sql`  — letters table + RLS

## Storage split (current)
- **Patients** → Supabase `public.patients` ✅
- **Letters**  → Supabase `public.letters` ✅ (with localStorage as fallback)

## Key lib files
- `lib/supabase/client.ts` — browser client factory
- `lib/supabase/server.ts` — server client factory (async cookies)
- `lib/supabase/patients.ts` — savePatient, getAllPatients, searchPatients, patientToDraft (includes supabase_patient_id)
- `lib/supabase/letters.ts` — saveLetter, getLetterById, getLettersByStatus, getAllLetters, updateLetterStatus, updateLetterHebrew, getLetterCounts, supabaseLetterToStoredLetter
- `lib/letterStore.ts` — localStorage fallback (still used as fallback)

## Letter Editor session storage keys
- `draft_patient` — patient prefill from new-patient/new-letter (includes `supabase_patient_id`)
- `letter_supabase_id` — Supabase UUID of the current letter
- `load_from_supabase` — flag: set to "1" to force fresh Supabase load on editor mount
- `letter_draft` — full editor state auto-save (also written when Supabase load path runs)
- `letter_draft_id` — legacy localStorage letter ID (kept for fallback)
- `letter_current_supabase_id` — in localStorage (cross-tab for preview)

## Pages updated for Supabase letters
- `/workspace` (dashboard) — letter counts from Supabase
- `/workspace/drafts` — loads Draft letters from Supabase
- `/workspace/review` — loads Waiting/Reviewed/Ready/Sent from Supabase, all status changes go to Supabase
- `/workspace/anat-review` — list loads from Supabase
- `/workspace/anat-review/[id]` — loads/saves Hebrew from Supabase, Finish Review updates Supabase status
- `/workspace/all-letters` — patients from Supabase, letters from Supabase grouped by patient
- `/workspace/letter-editor` — Save Draft + Send to Anat write to Supabase; mount loads from Supabase when load_from_supabase=1
- `/workspace/letter-preview` — Send to Anat updates Supabase status

## Design tokens
- Navy: #1A2B4A · Slate: #64748B · Muted: #94A3B8 · Border: #E2E8F0 · BG: #F4F6F9
- Card shadow: 0 1px 3px rgb(0 0 0/0.06), 0 4px 16px rgb(26 43 74/0.05)

**How to apply:** When suggesting changes, assume both patients and letters come from Supabase. localStorage is only a fallback. All status changes should update Supabase first.
