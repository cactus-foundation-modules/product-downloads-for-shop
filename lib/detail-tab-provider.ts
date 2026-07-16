import { DownloadsPanel } from '@/modules/product-downloads-for-shop/components/public/DownloadsPanel'
import { getFilesForProduct } from '@/modules/product-downloads-for-shop/lib/db/files'
import { formatSize, kindLabel } from '@/modules/product-downloads-for-shop/lib/file-kinds'
import type { PdlTabPayload } from '@/modules/product-downloads-for-shop/lib/types'
import type { ShopDetailTabProvider } from '@/modules/shop/lib/detail-tabs'

// This module's answer to shop's `shop.product-detail-tabs` point: a Downloads
// tab in the product page's own tab strip, beside Description and Specification.
//
// In the strip rather than in a panel of its own further down the page, because
// that is where a shopper already looks for more about a product. A block bolted
// underneath would have been less work and would have read as an advert.
export const productDownloadsTabProvider: ShopDetailTabProvider = {
  label: 'Downloads',

  // After shop's own Description (10), Specification (20) and Dimensions (30).
  // The literature is what a shopper reaches for once the product itself has
  // answered for it, not before.
  order: 45,

  /**
   * Resolved while the product page renders, so the list is in the first HTML
   * rather than in a fetch behind it.
   *
   * Null when the product has no downloads, which is what keeps the tab from
   * appearing at all on the many products that have none - installing this module
   * changes nothing about a product until someone attaches a file to it.
   *
   * Only what the shopper needs crosses to the browser. The storage url and the
   * original filename stay on the server: the shopper is given this module's own
   * download route, and handing them the storage url as well would only invite
   * linking straight to it, under the mangled name the object key carries.
   */
  load: async (productId: string): Promise<PdlTabPayload | null> => {
    const files = await getFilesForProduct(productId)
    if (files.length === 0) return null
    return {
      files: files.map((file) => ({
        id: file.id,
        name: file.name,
        kind: kindLabel(file.filename),
        size: formatSize(file.size),
        href: `/api/m/product-downloads-for-shop/public/files/${file.id}`,
      })),
    }
  },

  Panel: DownloadsPanel,
}
