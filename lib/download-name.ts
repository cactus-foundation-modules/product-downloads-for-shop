import { extensionOf } from '@/modules/product-downloads-for-shop/lib/file-kinds'

// Building the Content-Disposition header for a download.
//
// This is the whole reason downloads are served through this module rather than
// linked straight at storage. Core builds an object key's extension from the
// file's MIME subtype, so a .docx is stored under a key ending
// ".vnd.openxmlformats-officedocument.wordprocessingml.document", and every key
// carries a nanoid for uniqueness. Link the shopper at that and they save a file
// called "V1StGXR8-manual.vnd.openxmlformats-...", which their computer then has
// no idea how to open. The `download` attribute on an <a> would rename it, except
// that browsers ignore it cross-origin - and storage is always another origin.
//
// So the name is ours to set, which makes it ours to get right.

const DEL = 0x7f
const FIRST_PRINTABLE = 0x20
const LAST_PRINTABLE = 0x7e

/**
 * True for a character with no business in a filename: the C0 controls and DEL,
 * which would end the header outright (CR and LF) or arrive as rubbish; the
 * double quote, which ends the quoted parameter; and the slash and backslash,
 * which would make the name a path.
 *
 * A name is operator-supplied here rather than attacker-supplied, but "the admin
 * would have to do it to themselves" is no reason to leave a header injection in.
 *
 * Spelt out by code point rather than as a character class, and deliberately: the
 * obvious spelling of that class hides a range - space to double-quote - which
 * silently eats exclamation marks and strips no control character whatsoever.
 * This is dull and it is right, which is the correct trade for a security check.
 */
function isUnsafe(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0
  if (code < FIRST_PRINTABLE || code === DEL) return true
  return ch === '"' || ch === '\\' || ch === '/'
}

/**
 * Collapse a name to something safe in a header and sane to save to disk.
 *
 * Unsafe characters become a space and runs of whitespace collapse, rather than
 * being escaped: a manual named with a newline in it is a typo, not a
 * requirement. Spaces, hyphens and accents all survive untouched, because
 * "Guide d'entretien - modèle 4491" is a perfectly good name for a file and there
 * is nothing unsafe about it.
 */
function sanitise(name: string): string {
  const cleaned = [...name].map((ch) => (isUnsafe(ch) ? ' ' : ch)).join('')
  return cleaned.replace(/\s+/g, ' ').trim()
}

function stripExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

/**
 * The filename a download arrives as: the plain-English name the site owner gave
 * it, carrying the original file's extension so the shopper's computer knows what
 * to open it with.
 *
 * "Assembly instructions" + "TZ-4491-rev-c.pdf" -> "Assembly instructions.pdf".
 *
 * The extension comes from the uploaded file and is re-appended rather than read
 * out of the name, so an owner who helpfully types "Assembly instructions.pdf" as
 * the name does not get "Assembly instructions.pdf.pdf" - and one who types
 * "Instructions.exe" does not get to choose the extension at all.
 */
export function downloadFilename(name: string, originalFilename: string): string {
  const ext = extensionOf(originalFilename)
  // A name that sanitises away to nothing falls back to the uploaded filename,
  // which is ugly but is at least a name.
  const base = stripExtension(sanitise(name)) || stripExtension(sanitise(originalFilename)) || 'download'
  return ext ? `${base}.${ext}` : base
}

/** Fold to plain ASCII for the legacy `filename` parameter. */
function toAscii(value: string): string {
  return [...value]
    .map((ch) => {
      const code = ch.codePointAt(0) ?? 0
      return code >= FIRST_PRINTABLE && code <= LAST_PRINTABLE ? ch : '_'
    })
    .join('')
}

/**
 * A full Content-Disposition value for the given download.
 *
 * Both forms are emitted, per RFC 6266: a plain ASCII `filename` every browser
 * understands, and a percent-encoded `filename*` carrying the real thing. A site
 * owner writing in Welsh, Greek or Chinese gets their own name back, and anything
 * too old to know `filename*` still gets a sensible ASCII one rather than the
 * mojibake that putting UTF-8 bytes in a quoted string produces.
 */
export function contentDisposition(name: string, originalFilename: string): string {
  const filename = downloadFilename(name, originalFilename)
  return `attachment; filename="${toAscii(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}
