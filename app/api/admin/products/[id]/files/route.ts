import { NextRequest, NextResponse } from 'next/server'
import { getActiveMediaProvider, isMediaProviderConfigured } from '@/lib/config/env'
import { resolveFolderPath } from '@/lib/media/organise'
import { saveMediaRecord, uploadMedia, validateNonImageUpload } from '@/lib/media/upload'
import { requireShopUser } from '@/modules/shop/lib/access'
import { createFile, getFilesForProduct, reorderFiles } from '@/modules/product-downloads-for-shop/lib/db/files'
import { resolveDownloadsFolderId } from '@/modules/product-downloads-for-shop/lib/media-folder'
import {
  PDL_MAX_UPLOAD_BYTES,
  PDL_MAX_UPLOAD_MB,
  formatSize,
  typeForFilename,
} from '@/modules/product-downloads-for-shop/lib/file-kinds'

// A product's downloads: the editor's list, where a new one is uploaded, and
// where the list's order is saved.
//
// The bytes come through this function rather than going straight to storage, and
// that is not a choice. The direct-to-Worker path photographs and 3D models take
// is closed to a document: the Worker reads an upload's type out of its object
// key's extension and refuses anything that is not a raster image or a 3D model,
// so a PDF sent that way is turned away with a 415 no matter how it is signed.
// Which means the hosting platform's ~4.5 MB request body cap applies here, and
// the client says so before it tries rather than letting the platform swallow the
// request and return a 413 whose body is not even JSON.

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireShopUser('shop.products')
  if (gate.error) return gate.error

  const { id } = await params
  return NextResponse.json({ files: await getFilesForProduct(id) })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireShopUser('shop.products')
  if (gate.error) return gate.error

  const { id } = await params

  const provider = await getActiveMediaProvider()
  if (!provider || !isMediaProviderConfigured(provider)) {
    return NextResponse.json(
      { error: 'Media storage is not set up yet. Add a provider in Settings → Media first.' },
      { status: 503 },
    )
  }

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  const rawName = form?.get('name')
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  // The extension decides the type, not the browser's guess at it - a .zip
  // arrives as application/zip or application/x-zip-compressed depending on the
  // machine, and a .dwg as nothing at all. See lib/file-kinds.ts.
  const mimeType = typeForFilename(file.name)
  if (!mimeType) {
    return NextResponse.json(
      { error: 'That file type is not one this can offer. Use a PDF, Office document, text file, drawing, image or ZIP.' },
      { status: 400 },
    )
  }

  const validation = await validateNonImageUpload(mimeType, file.size, {
    allowedMimeTypes: [mimeType],
    maxSizeBytes: PDL_MAX_UPLOAD_BYTES,
  })
  if (!validation.valid) {
    return NextResponse.json(
      { error: `“${file.name}” is ${formatSize(file.size)}. The most a download can be is ${PDL_MAX_UPLOAD_MB} MB.` },
      { status: 400 },
    )
  }

  // Unnamed uploads take the filename as their name, so an admin who is in a
  // hurry gets something readable rather than a blank row. They can rename it.
  const name = (typeof rawName === 'string' ? rawName.trim() : '') || file.name

  try {
    const folderId = await resolveDownloadsFolderId(id)
    const folderPath = folderId ? await resolveFolderPath(folderId) : ''
    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await uploadMedia(buffer, mimeType, provider, file.name, folderPath || undefined)

    // Recorded in the core library as well as in our own table, so the file turns
    // up in Media under the product's downloads folder rather than being a file
    // only this module can see. Our row stays the source of truth for the tab; the
    // library row is there for the site owner, and a file whose library row is
    // later deleted goes on downloading.
    const record = await saveMediaRecord({
      key: result.key,
      url: result.url,
      provider,
      mimeType: result.mimeType,
      sizeBytes: result.sizeBytes,
      uploadedById: gate.user.id,
      originalName: file.name || undefined,
      folderId,
    })

    const created = await createFile({
      productId: id,
      name,
      filename: file.name,
      url: result.url,
      mediaProvider: provider,
      mediaKey: result.key,
      mediaId: record?.id ?? null,
      mimeType,
      size: result.sizeBytes,
    })
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 },
    )
  }
}

/**
 * Save the order the site owner dragged the list into. Scoped to this product in
 * the query itself, so a posted id belonging to another product renumbers
 * nothing.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireShopUser('shop.products')
  if (gate.error) return gate.error

  const { id } = await params
  const body = await request.json().catch(() => null)
  const ids = Array.isArray(body?.ids) ? body.ids.filter((v: unknown): v is string => typeof v === 'string') : null
  if (!ids) return NextResponse.json({ error: 'Expected an array of file ids' }, { status: 400 })

  await reorderFiles(id, ids)
  return NextResponse.json({ files: await getFilesForProduct(id) })
}
