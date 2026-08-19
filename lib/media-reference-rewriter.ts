import { prisma } from '@/lib/db/prisma'
import type { MediaReferenceChange } from '@/lib/media/reference-rewriters'

// Provider for the core.media-reference-rewriters extension point.
//
// A download row keeps its own copy of both halves of the blob's address: the
// public url it serves from, and the storage key it re-reads the file by. Core
// moves a blob whenever it is optimised, resized, replaced, renamed or re-filed
// into another folder, and neither column follows on its own - so the spec sheet
// a customer clicks 404s while the file sits perfectly safely under its new key,
// and the library shows nothing wrong. Both are repointed here.
//
// Equality, not substring: each column holds the whole value, so `= oldUrl` can
// never touch an unrelated row, and a file attached to two products is repointed
// on both.
export async function productDownloadsMediaReferenceRewriter(change: MediaReferenceChange): Promise<void> {
  const { oldUrl, newUrl, oldKey, newKey } = change

  if (oldUrl && oldUrl !== newUrl) {
    await prisma.$executeRaw`
      UPDATE "pdl_files" SET "url" = ${newUrl} WHERE "url" = ${oldUrl}
    `
  }
  if (oldKey && oldKey !== newKey) {
    await prisma.$executeRaw`
      UPDATE "pdl_files" SET "media_key" = ${newKey} WHERE "media_key" = ${oldKey}
    `
  }
}
