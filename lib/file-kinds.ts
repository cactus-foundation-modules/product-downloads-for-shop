import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from '@/lib/media/limits'

// The file types this module accepts, and the only place that decides so. Shared
// by the upload route (server) and the file picker (browser), so what the admin
// is offered and what the server will take can never drift apart.
//
// Keyed by extension rather than by the browser's declared type, because the
// declared type is not dependable for exactly the files a site owner wants to
// attach: a .zip arrives as application/zip on one machine and
// application/x-zip-compressed on another, a .csv as text/csv or as
// application/vnd.ms-excel depending on whether Excel is installed, and a .dwg
// as nothing at all. The extension is the claim worth making about a document,
// and it is the one the site owner can actually see and correct.
//
// What is NOT here matters as much as what is. There is no .html, .htm, .svg,
// .xml or .js, and there will not be: this module hands stored bytes back from
// the site's own origin, and a type a browser will execute markup from is a
// stored cross-site scripting hole rather than a download. The download route
// forces an attachment and nosniff on top of that (belt as well as braces), but
// the allowlist is the part that has to be right.
const KIND_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  zip: 'application/zip',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  rtf: 'application/rtf',
  txt: 'text/plain',
  csv: 'text/csv',
  // Drawings. A kitchen worktop or a bracket is sold on its dimensions, and the
  // people who ask for those want them in CAD rather than as a picture of a CAD
  // file. None of these renders in a browser and none is meant to - they are
  // downloads in the plainest sense.
  dwg: 'image/vnd.dwg',
  dxf: 'image/vnd.dxf',
  // Photographs, for a press pack or a print-resolution shot. The product's own
  // gallery is the place for pictures a shopper looks at; this is the place for
  // one they need a copy of.
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
}

export const PDL_EXTENSIONS = Object.keys(KIND_TYPES)

/** The extension of a filename, lower-cased, or '' if it has none. */
export function extensionOf(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? (parts.pop() as string).toLowerCase() : ''
}

/** The type a file of this name is stored and served as, or null if unsupported. */
export function typeForFilename(filename: string): string | null {
  return KIND_TYPES[extensionOf(filename)] ?? null
}

/** The badge on the shopper's tile - "PDF", "DOCX". */
export function kindLabel(filename: string): string {
  return extensionOf(filename).toUpperCase() || 'FILE'
}

// What goes in the file picker's `accept`, so the admin's file dialogue offers
// the right files rather than everything on the disk.
export const PDL_ACCEPT = PDL_EXTENSIONS.map((e) => `.${e}`).join(',')

// The ceiling, and it is the hosting platform's rather than a rule of ours.
//
// A download has to come through this site's own server to reach storage, so the
// platform's request body cap applies: it rejects anything larger before our
// route runs at all. The direct-to-storage path photographs and 3D models use is
// not open to a document - the media Worker types an upload from its object key's
// extension and turns away anything that is not a raster image or a 3D model, so
// a PDF sent that way is refused with a 415 no matter what we do here. Lifting
// this therefore needs a core release that teaches the Worker about documents,
// and every site owner to redeploy their Worker - which is why this module says
// 4 MB plainly instead of promising more and failing at the door.
export const PDL_MAX_UPLOAD_BYTES = MAX_UPLOAD_BYTES
export const PDL_MAX_UPLOAD_MB = MAX_UPLOAD_MB

/** Human file size, formatted once so every surface says it the same way. */
export function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/**
 * Check a picked file the way the server will, so a wrong type or an oversized
 * document says so at once rather than after the round trip. Returns a reason, or
 * null if it is fine to send.
 */
export function preflightFileError(file: { name: string; size: number }): string | null {
  if (!typeForFilename(file.name)) {
    return `“${file.name}” is not a file type this can offer. Use a PDF, Office document, text file, drawing, image or ZIP.`
  }
  if (file.size > PDL_MAX_UPLOAD_BYTES) {
    return `“${file.name}” is ${formatSize(file.size)}. The most a download can be is ${PDL_MAX_UPLOAD_MB} MB.`
  }
  return null
}
