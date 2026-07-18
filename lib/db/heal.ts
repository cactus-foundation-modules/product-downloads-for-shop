import { prisma } from '@/lib/db/prisma'
import type { PdlStoredFile } from '@/modules/product-downloads-for-shop/lib/db/files'

// ---------------------------------------------------------------------------
// Keeping a download's storage details honest.
//
// pdl_files copies three things off the core Media row at upload time - the
// provider, the object key and the url - so the download route can read the
// bytes without a join. That copy is a snapshot, and the core library moves
// files about underneath it: renaming a product renames its media folder, and
// the folder path is baked into the key, so every file inside it gets a brand
// new key and url. Core updates its own Media rows and knows nothing about ours.
//
// The result is a download whose bytes are exactly where they should be, under
// a key we stopped believing in some weeks ago, and a shopper reading "That file
// could not be retrieved." (Seen in the wild: a chair renamed to add "24 hour"
// to its name took both of its assembly instructions down with it.)
//
// media_id is the column that survives all this, because it points at the row
// rather than at the address. So before the bytes are read - or deleted - the
// stored details are checked against the library and quietly brought back into
// line. Nobody has to notice, and nobody has to press anything: the next request
// for a stale download repairs it and serves it.
// ---------------------------------------------------------------------------

/**
 * The file's storage details as they are *now*, repairing the stored copy if the
 * core library has moved the bytes since.
 *
 * Rows with no media_id, or whose library row has since been deleted, are handed
 * back untouched - the stored key is then the only address we have, and a stale
 * guess still beats no guess.
 */
export async function withFreshStorage(file: PdlStoredFile): Promise<PdlStoredFile> {
  if (!file.mediaId) return file

  const media = await prisma.media.findUnique({
    where: { id: file.mediaId },
    select: { key: true, url: true, provider: true },
  })
  if (!media) return file

  const unchanged =
    media.key === file.mediaKey &&
    media.url === file.url &&
    media.provider === file.mediaProvider
  if (unchanged) return file

  // Write-back is best effort on purpose. The point of this function is to serve
  // the file; if the UPDATE loses a race with another request healing the same
  // row, or the connection drops, the caller still gets the right address and the
  // next request tries the repair again.
  await prisma.$executeRaw`
    UPDATE "pdl_files"
    SET "media_key" = ${media.key}, "url" = ${media.url}, "media_provider" = ${media.provider}
    WHERE "id" = ${file.id}
  `.catch((error: unknown) => {
    console.warn(`[product-downloads-for-shop] could not refresh storage details for ${file.id}:`, error)
  })

  console.info(
    `[product-downloads-for-shop] download ${file.id} had moved in the media library; key refreshed to ${media.key}`,
  )

  return { ...file, mediaKey: media.key, url: media.url, mediaProvider: media.provider }
}
