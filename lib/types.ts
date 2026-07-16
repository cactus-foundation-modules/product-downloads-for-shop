// One downloadable file, as the admin editor and the public tab both see it.
//
// `url` and the storage columns are deliberately absent: nothing outside the
// server needs them. The shopper is given this module's own download route, and
// handing the browser the raw storage url as well would only invite it to be
// linked to directly, under the storage key's mangled name.
export type PdlFile = {
  id: string
  productId: string
  name: string
  filename: string
  mimeType: string
  size: number
  position: number
}

// What the public tab is handed. Crosses the RSC boundary, so it is plain JSON.
export type PdlTabPayload = {
  files: PdlPublicFile[]
}

// A file as the shopper sees it: what it is called, how big it is, what kind of
// file it is, and where to get it. No storage detail, no original filename.
export type PdlPublicFile = {
  id: string
  name: string
  // Short upper-case badge for the tile - "PDF", "ZIP", "DOCX".
  kind: string
  // Human size, formatted server-side so the tab renders it identically
  // wherever it is read from.
  size: string
  href: string
}
