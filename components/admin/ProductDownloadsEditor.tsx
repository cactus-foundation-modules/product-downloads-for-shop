'use client'

// The Downloads tab on the product editor.
//
// Like the 3D views tab, and unlike the editor's own panels, this saves as you go
// rather than through the editor's Save button. An upload is a file transfer that
// has either happened or not, and pretending a file is an unsaved edit - held in
// memory, lost on a tab change, applied later - would be a lie that costs the
// admin their upload. Renames, removals and reordering go the same way for
// consistency: everything on this tab is already written by the time it is drawn.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useProductEditorTabBadge } from '@/modules/shop/components/admin/product-editor/context'
import {
  PDL_ACCEPT,
  PDL_MAX_UPLOAD_MB,
  formatSize,
  kindLabel,
} from '@/modules/product-downloads-for-shop/lib/file-kinds'
import { uploadDownload } from '@/modules/product-downloads-for-shop/lib/upload-file-client'
import type { PdlFile } from '@/modules/product-downloads-for-shop/lib/types'

const css = `
.pdl-ed{display:grid;gap:1.25rem}
.pdl-ed-head{display:flex;gap:.75rem;align-items:center;flex-wrap:wrap}
.pdl-ed-list{display:grid;gap:.5rem}
.pdl-ed-row{display:flex;gap:.75rem;align-items:center;padding:.625rem .75rem;
  border:1px solid var(--color-border);border-radius:8px;background:var(--color-surface)}
.pdl-ed-kind{font-size:.6875rem;font-weight:700;padding:2px 6px;border-radius:4px;min-width:3rem;text-align:center;
  background:var(--color-bg-subtle);color:var(--color-text-secondary);border:1px solid var(--color-border);flex-shrink:0}
.pdl-ed-name{flex:1;min-width:8rem;padding:.375rem .625rem;border:1px solid var(--color-border);border-radius:6px;
  background:var(--color-bg);color:var(--color-text);font-size:.875rem;font-family:inherit}
.pdl-ed-name:focus{outline:2px solid var(--color-primary);outline-offset:-1px}
.pdl-ed-meta{font-size:.75rem;color:var(--color-text-muted);white-space:nowrap;overflow:hidden;
  text-overflow:ellipsis;max-width:16rem}
.pdl-ed-moves{display:flex;gap:.25rem;flex-shrink:0}
.pdl-ed-move{width:1.75rem;height:1.75rem;display:flex;align-items:center;justify-content:center;padding:0;
  border:1px solid var(--color-border);border-radius:6px;background:var(--color-bg);color:var(--color-text-secondary);
  cursor:pointer;font-size:.75rem;line-height:1}
.pdl-ed-move:disabled{opacity:.4;cursor:default}
.pdl-ed-move:not(:disabled):hover{border-color:var(--color-primary);color:var(--color-primary)}
.pdl-ed-empty{padding:1rem;border:1px dashed var(--color-border);border-radius:8px;
  color:var(--color-text-muted);font-size:.875rem}
.pdl-ed-err{color:var(--color-danger);font-size:.8125rem;margin:0}
.pdl-ed-help{color:var(--color-text-muted);font-size:.8125rem;margin:0;line-height:1.5}
`

export function ProductDownloadsEditor({ productId }: { productId: string }) {
  const [files, setFiles] = useState<PdlFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // What the server currently holds for each name, so a blur that changed nothing
  // does not write. Keyed by file id.
  const savedNames = useRef<Map<string, string>>(new Map())

  const base = `/api/m/product-downloads-for-shop/admin/products/${productId}/files`

  const remember = useCallback((list: PdlFile[]) => {
    savedNames.current = new Map(list.map((f) => [f.id, f.name]))
    setFiles(list)
  }, [])

  // A promise chain rather than an async function, and deliberately: an async
  // body's opening statements read as synchronous to the effect lint, so calling
  // one straight from an effect trips set-state-in-effect even though every
  // setState here lands in a callback. Same shape as the 3D views tab.
  const refresh = useCallback((): Promise<void> => {
    return fetch(base)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { files: PdlFile[] } | null) => {
        if (data) remember(data.files)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [base, remember])

  useEffect(() => { void refresh() }, [refresh])

  // Shows the count beside the tab's name, so the admin can see a product has
  // literature without opening the tab. Inert outside the product editor.
  useProductEditorTabBadge(files.length > 0 ? String(files.length) : null)

  async function upload(picked: FileList) {
    setUploading(true)
    setError(null)
    // One at a time rather than all at once: each is a full-sized body through
    // the site's own server, and firing five together is how a slow connection
    // turns into five timeouts instead of one clear failure.
    for (const file of Array.from(picked)) {
      try {
        // Named after the file to begin with, which is at least something to read
        // in the list. Renaming it is the next thing the admin does, and the
        // whole point of the tab.
        await uploadDownload(file, { productId, name: file.name })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'That file could not be uploaded.')
        break
      }
    }
    await refresh()
    setUploading(false)
  }

  async function rename(id: string, name: string) {
    const trimmed = name.trim()
    const previous = savedNames.current.get(id) ?? ''
    // An emptied box means the admin cleared it to retype, not that they want a
    // nameless file. Put the old name back rather than arguing about it.
    if (!trimmed) {
      setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, name: previous } : f)))
      return
    }
    if (trimmed === previous) return

    setError(null)
    const res = await fetch(`/api/m/product-downloads-for-shop/admin/files/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    })
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? 'Could not rename that file')
      setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, name: previous } : f)))
      return
    }
    savedNames.current.set(id, trimmed)
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, name: trimmed } : f)))
  }

  async function remove(id: string) {
    setError(null)
    const res = await fetch(`/api/m/product-downloads-for-shop/admin/files/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? 'Could not remove that file')
      return
    }
    // Dropped from the list here rather than by refetching: the row is gone
    // server-side, and a round-trip would only make the click feel slow.
    savedNames.current.delete(id)
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  async function move(index: number, delta: number) {
    const next = [...files]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target] as PdlFile, next[index] as PdlFile]
    // Moved on screen first, written after: dragging a row and waiting for a
    // server to agree is how a list comes to feel broken.
    setFiles(next)
    setError(null)
    const res = await fetch(base, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: next.map((f) => f.id) }),
    })
    if (!res.ok) {
      setError('Could not save that order')
      await refresh()
    }
  }

  if (loading) return <p className="pdl-ed-help" style={{ padding: '1rem' }}>Loading…</p>

  return (
    <div className="spe-panel">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="pdl-ed">
        <p className="pdl-ed-help">
          Files here appear on the product page under a <strong>Downloads</strong> tab, free for anyone to take - the
          assembly instructions, a spec sheet, a care card, a drawing. The <strong>name</strong> is what shoppers see and
          what the file saves to their computer as, so write it for them (&ldquo;Assembly instructions&rdquo;) rather than
          leaving it as whatever the supplier called it. PDFs, Office documents, text files, drawings, images and ZIPs,
          up to {PDL_MAX_UPLOAD_MB} MB each.
        </p>

        <div className="pdl-ed-head">
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={PDL_ACCEPT}
            style={{ display: 'none' }}
            onChange={(e) => {
              const picked = e.target.files
              if (picked && picked.length > 0) void upload(picked)
              // Cleared so picking the same file twice in a row still fires a
              // change event - re-uploading after a failure is exactly that.
              e.target.value = ''
            }}
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? 'Uploading…' : 'Add a file'}
          </button>
        </div>

        {error && <p className="pdl-ed-err">{error}</p>}

        {files.length === 0 ? (
          <div className="pdl-ed-empty">
            No downloads yet. The product page carries on exactly as it is until you add one - the Downloads tab only
            appears once there is something in it.
          </div>
        ) : (
          <div className="pdl-ed-list">
            {files.map((file, index) => (
              <div key={file.id} className="pdl-ed-row">
                <span className="pdl-ed-kind">{kindLabel(file.filename)}</span>
                <input
                  className="pdl-ed-name"
                  value={file.name}
                  aria-label={`Name for ${file.filename}`}
                  maxLength={120}
                  onChange={(e) => setFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, name: e.target.value } : f)))}
                  onBlur={(e) => void rename(file.id, e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                />
                <span className="pdl-ed-meta" title={file.filename}>
                  {file.filename} · {formatSize(file.size)}
                </span>
                <span className="pdl-ed-moves">
                  <button
                    type="button"
                    className="pdl-ed-move"
                    disabled={index === 0}
                    aria-label={`Move ${file.name} up`}
                    onClick={() => void move(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="pdl-ed-move"
                    disabled={index === files.length - 1}
                    aria-label={`Move ${file.name} down`}
                    onClick={() => void move(index, 1)}
                  >
                    ↓
                  </button>
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => void remove(file.id)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
