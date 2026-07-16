import { preflightFileError } from '@/modules/product-downloads-for-shop/lib/file-kinds'
import type { PdlFile } from '@/modules/product-downloads-for-shop/lib/types'

// Uploading one download from the product editor.
//
// A plain form post, and unlike this module's 3D-model sibling there is no
// direct-to-storage path to prefer: the media Worker types an upload from its
// object key's extension and accepts only raster images and 3D models, so a PDF
// sent that way is refused outright. The bytes therefore come through the site,
// the platform's request body cap applies, and the guard below is what turns that
// into a sentence a site owner can act on rather than a 413 whose body is not
// JSON and whose message would be "Upload failed".

/** Our own routes answer with { error }. Anything else has not come from us. */
async function reasonFrom(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json()
    return typeof body?.error === 'string' ? body.error : fallback
  } catch {
    return fallback
  }
}

export async function uploadDownload(
  file: File,
  { productId, name }: { productId: string; name: string },
): Promise<PdlFile> {
  const reason = preflightFileError(file)
  if (reason) throw new Error(reason)

  const body = new FormData()
  body.append('file', file)
  body.append('name', name)

  const res = await fetch(`/api/m/product-downloads-for-shop/admin/products/${productId}/files`, {
    method: 'POST',
    body,
  })
  if (!res.ok) throw new Error(await reasonFrom(res, 'That file could not be uploaded.'))
  return res.json()
}
