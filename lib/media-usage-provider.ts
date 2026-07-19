import { prisma } from '@/lib/db/prisma'

// Provider for the core.media-usage-providers extension point.
//
// Each attached download records its blob three ways (url, storage key, Media
// id). Without this, a product's spec sheets and assembly instructions read as
// unused files in the library while customers were still downloading them.
export async function productDownloadsMediaUsageProvider(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ ref: string | null }[]>`
    SELECT "url" AS ref FROM "pdl_files" WHERE "url" IS NOT NULL
    UNION ALL
    SELECT "media_key" AS ref FROM "pdl_files" WHERE "media_key" IS NOT NULL
    UNION ALL
    SELECT "media_id" AS ref FROM "pdl_files" WHERE "media_id" IS NOT NULL
  `
  return rows.map((r) => r.ref).filter((r): r is string => !!r)
}
