import { NextRequest, NextResponse } from 'next/server'
import { downloadMedia } from '@/lib/media/upload'
import { getProductById } from '@/modules/shop/lib/db/products'
import { getStoredFileById } from '@/modules/product-downloads-for-shop/lib/db/files'
import { withFreshStorage } from '@/modules/product-downloads-for-shop/lib/db/heal'
import { contentDisposition } from '@/modules/product-downloads-for-shop/lib/download-name'
import type { MediaProviderType } from '@prisma/client'

// Hand a shopper one of a product's downloads.
//
// Public and ungated, which is the feature: these are the manuals, spec sheets
// and drawings someone reads BEFORE deciding to buy, and putting them behind a
// login would defeat the point of publishing them. They are not shop's digital
// products - those are the thing being sold, and shop delivers them through its
// own purchase-issued token with an expiry and a download count. Different
// feature, different route, deliberately.
//
// Ungated is not the same as unchecked, and there are three checks worth naming:
//
//  1. The product must be ACTIVE and in the catalogue - the same line shop's own
//     product page 404s on. Without it, this route would hand out the manual for
//     a product that has not launched yet, or one deliberately withdrawn from
//     sale, to anyone holding an id. The row id is a uuid, which makes it
//     unguessable rather than access-controlled, and product ids do get out.
//  2. The bytes are read by key, and only for a row that exists in our own table,
//     so this cannot be pointed at an arbitrary object in the bucket.
//  3. The response always attaches and never renders. See below.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const stored = await getStoredFileById(id)
  if (!stored) return new NextResponse('Not found', { status: 404 })

  // The stored key is a snapshot and the library moves things about, so it is
  // checked against the Media row (and repaired) before anything reads bytes.
  // See lib/db/heal.ts - this is what stops a product rename taking every one of
  // its downloads offline until someone re-uploads them.
  const file = await withFreshStorage(stored)

  // Mirrors app/public/shop/products/[slug]/page.tsx: a DRAFT product was never
  // published and an ARCHIVED one was withdrawn on purpose, so neither should be
  // handing out literature. catalogueHidden rows are variant children, reachable
  // only through their parent.
  const product = await getProductById(file.productId)
  if (!product || product.status !== 'ACTIVE' || product.catalogueHidden) {
    return new NextResponse('Not found', { status: 404 })
  }

  // Read by provider + key rather than by fetching the stored url. Two reasons,
  // both learned from shop's digital files: the url is the media Worker's, so a
  // site that later moves its Worker to a new address leaves every stored url
  // pointing at nothing, while the key keeps working; and the url is empty on an
  // install whose Worker was never configured, where fetching it throws something
  // far less obvious than this.
  let bytes: Buffer
  try {
    bytes = await downloadMedia(file.mediaProvider as MediaProviderType, file.mediaKey ?? '', file.url)
  } catch (error) {
    console.error(`[product-downloads-for-shop] could not read ${file.mediaKey ?? file.url}:`, error)
    return new NextResponse('That file could not be retrieved.', { status: 502 })
  }

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': file.mimeType,
      // The name the site owner gave it, plus the real file's extension. This is
      // the entire reason the bytes come through here rather than the shopper
      // being linked at storage - see lib/download-name.ts.
      'Content-Disposition': contentDisposition(file.name, file.filename),
      // From the bytes actually in hand, never from the size column: a stored
      // number that disagrees with the body truncates the transfer or hangs it.
      'Content-Length': String(bytes.length),
      // These files are uploaded by an admin and served from the site's own
      // origin, so the type is never left to the browser's imagination. The
      // allowlist already refuses anything a browser would run markup from
      // (lib/file-kinds.ts); this is the brace to that belt.
      'X-Content-Type-Options': 'nosniff',
      // Short: a manual rarely changes, but renaming one should not take an hour
      // to show, and a deleted one should not go on being served all afternoon.
      'Cache-Control': 'public, max-age=300',
    },
  })
}
