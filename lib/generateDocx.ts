export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href    = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function safePart(raw: string): string {
  return (raw || "").replace(/[^a-zA-Zא-ת0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "Unknown";
}

function safeDate(date: string): string {
  if (date && /\d{1,2}\/\d{1,2}\/\d{4}/.test(date)) return date.replace(/\//g, "-");
  return new Date().toLocaleDateString("en-GB").replace(/\//g, "-");
}

function buildFilename(patId: string, fullName: string, location: string, date: string, ext: string): string {
  const id      = (patId    || "").replace(/[^a-zA-Z0-9]/g, "") || "NoID";
  const parts   = (fullName || "").trim().split(/\s+/);
  const surname = safePart(parts[parts.length - 1] || "UnknownSurname").toUpperCase();
  const loc     = safePart(location || "NoLocation");
  const d       = safeDate(date);
  return `${id}_${surname}_${loc}_${d}.${ext}`;
}

export function finalPdfFilename(patId: string, fullName: string, location: string, date: string): string {
  return buildFilename(patId, fullName, location, date, "pdf");
}
