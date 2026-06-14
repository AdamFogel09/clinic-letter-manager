// Temporary review workflow storage only. Replace with database-backed workflow later.

export type LetterStatus =
  | "Draft"
  | "Ready for Review"
  | "Waiting for Anat"
  | "Reviewed"
  | "Ready for Patient"
  | "Sent to Patient";

export interface StoredLetter {
  id: string;
  patientName: string;
  patientId: string;
  patientDbId?: string;       // Supabase patient UUID — used for cross-letter cleanup
  letterDate: string;
  status: LetterStatus;
  savedAt: string;
  data?: Record<string, unknown>;
  // Editable review file metadata (file stored separately or externally)
  reviewFileName?: string;
  reviewFileUploadedAt?: string;
  // Patient delivery metadata
  sentToEmail?: string;
  sentAt?: string;
  // Supabase Storage paths within the "clinic-letters" bucket
  finalPdfPath?: string;
  editableDocxPath?: string;
  // File sizes in bytes (null until the relevant action has been performed)
  finalPdfSizeBytes?:     number | null;
  imagesTotalSizeBytes?:  number | null;
  totalStorageSizeBytes?: number | null;
}

const STORAGE_KEY = "clinic_letters_v1";

export function getLetters(): StoredLetter[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredLetter[]) : [];
  } catch {
    return [];
  }
}

function saveLetters(letters: StoredLetter[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(letters));
}

export function upsertLetter(letter: StoredLetter): void {
  const letters = getLetters();
  const idx = letters.findIndex((l) => l.id === letter.id);
  if (idx >= 0) {
    letters[idx] = letter;
  } else {
    letters.unshift(letter);
  }
  saveLetters(letters);
}

export function updateStatus(id: string, status: LetterStatus): void {
  const letters = getLetters();
  const letter = letters.find((l) => l.id === id);
  if (letter) {
    letter.status = status;
    saveLetters(letters);
  }
}

export function removeLettersById(ids: string[]): void {
  if (!ids.length || typeof window === "undefined") return;
  try {
    const remaining = getLetters().filter((l) => !ids.includes(l.id));
    saveLetters(remaining);
  } catch { /* ignore */ }
}

export function updateLetterData(id: string, updates: Record<string, unknown>): void {
  const letters = getLetters();
  const letter = letters.find((l) => l.id === id);
  if (letter) {
    letter.data = { ...(letter.data ?? {}), ...updates };
    saveLetters(letters);
  }
}

const PREVIEWED_KEY = "clinic_previewed_v1";

export function markAsPreviewed(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(PREVIEWED_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    if (!ids.includes(id)) {
      ids.push(id);
      localStorage.setItem(PREVIEWED_KEY, JSON.stringify(ids));
    }
  } catch { /* ignore */ }
}


