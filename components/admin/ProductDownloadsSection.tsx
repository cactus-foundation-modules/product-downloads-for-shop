import { ProductDownloadsEditor } from '@/modules/product-downloads-for-shop/components/admin/ProductDownloadsEditor'

// The Downloads tab on the product editor, hung there through shop's
// `shop.product-editor-sections` point. Shop renders this server-side and hands
// the result to its client editor shell, so the tab's own state lives in the
// client component below rather than here.
export function ProductDownloadsSection({ productId }: { productId: string }) {
  return <ProductDownloadsEditor productId={productId} />
}
