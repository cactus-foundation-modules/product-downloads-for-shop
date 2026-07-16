import { prisma } from '@/lib/db/prisma'
import type { PdlFile } from '@/modules/product-downloads-for-shop/lib/types'

// Queries for pdl_files. Raw SQL throughout: module tables are created by this
// module's own migrations and have no Prisma model, which is how every module
// here talks to its own schema.

type FileRow = {
  id: string
  productId: string
  name: string
  filename: string
  mimeType: string
  size: number
  position: number
}

// The storage columns, needed only by the download and delete paths. Kept off
// PdlFile so they cannot be handed to a component by accident.
export type PdlStoredFile = FileRow & {
  url: string
  mediaProvider: string | null
  mediaKey: string | null
  mediaId: string | null
}

/** Every download attached to a product, in the order the site owner arranged. */
export async function getFilesForProduct(productId: string): Promise<PdlFile[]> {
  return prisma.$queryRaw<PdlFile[]>`
    SELECT "id", "product_id" AS "productId", "name", "filename",
           "mime_type" AS "mimeType", "size", "position"
    FROM "pdl_files"
    WHERE "product_id" = ${productId}
    ORDER BY "position", "created_at"
  `
}

/** One file with everything the server needs to fetch or delete its bytes. */
export async function getStoredFileById(id: string): Promise<PdlStoredFile | null> {
  const rows = await prisma.$queryRaw<PdlStoredFile[]>`
    SELECT "id", "product_id" AS "productId", "name", "filename",
           "mime_type" AS "mimeType", "size", "position", "url",
           "media_provider" AS "mediaProvider", "media_key" AS "mediaKey", "media_id" AS "mediaId"
    FROM "pdl_files"
    WHERE "id" = ${id}
  `
  return rows[0] ?? null
}

export async function createFile(input: {
  productId: string
  name: string
  filename: string
  url: string
  mediaProvider: string | null
  mediaKey: string | null
  mediaId: string | null
  mimeType: string
  size: number
}): Promise<PdlFile> {
  // Position appends within the product, so a second manual lands after the
  // first rather than fighting it for the top of the list.
  const rows = await prisma.$queryRaw<PdlFile[]>`
    INSERT INTO "pdl_files" ("product_id", "name", "filename", "url", "media_provider", "media_key", "media_id", "mime_type", "size", "position")
    VALUES (
      ${input.productId}, ${input.name}, ${input.filename}, ${input.url},
      ${input.mediaProvider}, ${input.mediaKey}, ${input.mediaId}, ${input.mimeType}, ${input.size},
      COALESCE((SELECT MAX("position") + 1 FROM "pdl_files" WHERE "product_id" = ${input.productId}), 0)
    )
    RETURNING "id", "product_id" AS "productId", "name", "filename",
              "mime_type" AS "mimeType", "size", "position"
  `
  const row = rows[0]
  if (!row) throw new Error('Failed to create download row')
  return row
}

/** Rename a download. The only thing about a stored file that can be edited. */
export async function renameFile(id: string, name: string): Promise<PdlFile | null> {
  const rows = await prisma.$queryRaw<PdlFile[]>`
    UPDATE "pdl_files" SET "name" = ${name} WHERE "id" = ${id}
    RETURNING "id", "product_id" AS "productId", "name", "filename",
              "mime_type" AS "mimeType", "size", "position"
  `
  return rows[0] ?? null
}

export async function deleteFile(id: string): Promise<void> {
  await prisma.$executeRaw`DELETE FROM "pdl_files" WHERE "id" = ${id}`
}

/**
 * Reorder a product's downloads to the given id order. A site owner puts the
 * assembly instructions above the guarantee card because that is the order they
 * want them read in, so the arrangement is theirs, not the upload date's.
 *
 * Scoped to the product in the WHERE clause rather than trusting the ids: without
 * it, posting another product's id would renumber that product's list from here.
 */
export async function reorderFiles(productId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.$executeRaw`UPDATE "pdl_files" SET "position" = ${index} WHERE "id" = ${id} AND "product_id" = ${productId}`,
    ),
  )
}
