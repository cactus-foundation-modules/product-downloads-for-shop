'use client'

// The Downloads tab's contents on the product page.
//
// A client component because shop hands a contributed panel down through the RSC
// boundary as a prop, and a server component cannot be passed that way (see
// shop's lib/detail-tabs.ts). Nothing here needs the server in any case: the
// files were loaded while the page rendered, and this only draws them. It is
// still server-rendered into the first HTML, so the links are in the page for a
// crawler and for anyone without JavaScript.

import type { PdlPublicFile, PdlTabPayload } from '@/modules/product-downloads-for-shop/lib/types'

// Dressed to match shop's own Downloads tab (`.spd-dl`), because it sits in the
// same strip and a shopper should not be able to tell which module drew which
// tab. Class names are this module's own; the tokens are the site's.
const css = `
.pdl-list{display:grid;gap:10px}
.pdl-item{display:flex;align-items:center;gap:16px;border:1px solid var(--color-border);border-radius:10px;
  padding:16px 18px;color:var(--color-fg);text-decoration:none;transition:border-color .12s ease,background .12s ease}
.pdl-item:hover{border-color:var(--color-primary);background:var(--color-bg-subtle)}
.pdl-item:focus-visible{outline:2px solid var(--color-primary);outline-offset:2px}
.pdl-kind{width:42px;height:42px;border-radius:6px;background:var(--color-bg-subtle);color:var(--color-primary);
  display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;flex:none}
.pdl-text{display:flex;flex-direction:column;gap:2px;min-width:0}
.pdl-text b{font-size:15px;font-weight:600;overflow-wrap:anywhere}
.pdl-text small{font-size:12px;color:var(--color-text-muted)}
.pdl-get{margin-left:auto;color:var(--color-primary);font-weight:600;font-size:13px;white-space:nowrap}
`

function DownloadItem({ file }: { file: PdlPublicFile }) {
  return (
    <a className="pdl-item" href={file.href}>
      <span className="pdl-kind">{file.kind}</span>
      <span className="pdl-text">
        <b>{file.name}</b>
        <small>
          {file.kind} · {file.size}
        </small>
      </span>
      {/* Not a <button>: it is a link to a file, so it should behave like one -
          middle-click, right-click, copy link address, the lot. */}
      <span className="pdl-get" aria-hidden="true">
        Download
      </span>
    </a>
  )
}

export function DownloadsPanel({ payload }: { payload: unknown }) {
  const { files } = payload as PdlTabPayload
  if (!files || files.length === 0) return null

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="pdl-list">
        {files.map((file) => (
          <DownloadItem key={file.id} file={file} />
        ))}
      </div>
    </>
  )
}
