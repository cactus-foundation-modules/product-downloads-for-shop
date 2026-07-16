import { getOrCreateFolderByPath, resolveFolderPath } from '@/lib/media/organise'
import { getProductMediaFolderId } from '@/modules/shop/lib/media/product-media'

/**
 * The library folder a product's downloads belong in: Shop / <master category> /
 * <product> / downloads - the product's own image folder, with a `downloads`
 * subfolder so the manuals sit beside the pictures of the thing they describe
 * rather than in a parallel tree the site owner has to go looking for.
 *
 * Same arrangement, and the same reasoning, as product-3d-views-for-shop's `3d`
 * subfolder.
 *
 * Returns null when the product has no folder of its own yet, which simply means
 * the upload lands in the library root - a file in the wrong folder is a tidiness
 * problem, and refusing the upload over it would be a worse one.
 */
export async function resolveDownloadsFolderId(productId: string): Promise<string | null> {
  const productFolderId = await getProductMediaFolderId(productId)
  if (productFolderId === null) return null
  const path = await resolveFolderPath(productFolderId)
  if (!path) return null
  return getOrCreateFolderByPath([...path.split('/'), 'downloads'])
}
