import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { deleteMedia } from '@/lib/media/upload'
import { requireShopUser } from '@/modules/shop/lib/access'
import { deleteFile, getStoredFileById, renameFile } from '@/modules/product-downloads-for-shop/lib/db/files'
import type { MediaProviderType } from '@prisma/client'

// Renaming and removing one download.

/** Rename a download. The name is what the shopper reads and saves it as. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireShopUser('shop.products')
  if (gate.error) return gate.error

  const { id } = await params
  const body = await request.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'Give the file a name.' }, { status: 400 })
  // Long enough for any honest description, short enough not to be a paragraph
  // in a tile. Enforced here rather than only in the browser, which is where the
  // check that counts always goes.
  if (name.length > 120) return NextResponse.json({ error: 'That name is too long (120 characters at most).' }, { status: 400 })

  const updated = await renameFile(id, name)
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}

// Remove a download: our row, the core library row, and the stored blob.
//
// The blob goes too. Treating a delete as "hide it from the tab" would quietly
// bill the site owner for storing every draft manual they ever thought better of.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireShopUser('shop.products')
  if (gate.error) return gate.error

  const { id } = await params
  const file = await getStoredFileById(id)
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Our row first: it is the one the tab reads, so dropping it is what actually
  // removes the download from the shop. Everything after is tidying, and a
  // failure there must not leave the admin staring at a file they just deleted.
  await deleteFile(id)

  if (file.mediaId) {
    await prisma.media.delete({ where: { id: file.mediaId } }).catch(() => {
      // Already gone - someone deleted it from the library directly. Nothing to do.
    })
  }
  if (file.mediaKey && file.mediaProvider) {
    await deleteMedia(file.mediaProvider as MediaProviderType, file.mediaKey).catch((error: unknown) => {
      // The bytes outliving their row is a bill, not a bug the admin can act on.
      // Logged so it is visible, swallowed so the delete still reads as done.
      console.error(`[product-downloads-for-shop] could not delete blob ${file.mediaKey}:`, error)
    })
  }

  return NextResponse.json({ ok: true })
}
