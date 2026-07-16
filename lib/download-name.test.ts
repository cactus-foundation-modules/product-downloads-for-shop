import { describe, it, expect } from 'vitest'
import { contentDisposition, downloadFilename } from '@/modules/product-downloads-for-shop/lib/download-name'

// The header this builds is the one place a name the site owner typed reaches a
// response header, so the sanitising is a security check rather than a nicety -
// and it is the kind of check that reads as obviously correct right up until a
// character class turns out to hide a range. Hence the dull, exhaustive tests.

describe('downloadFilename', () => {
  it('gives the owner’s name the uploaded file’s extension', () => {
    expect(downloadFilename('Assembly instructions', 'TZ-4491-rev-c.pdf')).toBe('Assembly instructions.pdf')
  })

  it('does not double the extension when the owner typed one', () => {
    expect(downloadFilename('Assembly instructions.pdf', 'TZ-4491.pdf')).toBe('Assembly instructions.pdf')
  })

  it('will not let the name choose the extension', () => {
    expect(downloadFilename('Instructions.exe', 'manual.pdf')).toBe('Instructions.pdf')
  })

  it('keeps spaces, hyphens, apostrophes and accents', () => {
    expect(downloadFilename("Guide d'entretien - modèle 4491", 'g.pdf')).toBe("Guide d'entretien - modèle 4491.pdf")
  })

  it('keeps an exclamation mark, which the obvious character class quietly eats', () => {
    expect(downloadFilename('Read me first!', 'x.pdf')).toBe('Read me first!.pdf')
  })

  it('strips quotes, slashes and backslashes', () => {
    expect(downloadFilename('a"b/c\\d', 'x.pdf')).toBe('a b c d.pdf')
  })

  it('strips control characters rather than emitting them', () => {
    expect(downloadFilename('Manual\r\nX-Injected: yes', 'x.pdf')).toBe('Manual X-Injected: yes.pdf')
  })

  it('falls back to the uploaded name when the name sanitises away', () => {
    expect(downloadFilename('///', 'fallback.pdf')).toBe('fallback.pdf')
  })

  it('copes with a file that has no extension at all', () => {
    expect(downloadFilename('Notes', 'README')).toBe('Notes')
  })
})

describe('contentDisposition', () => {
  it('always attaches, and never renders', () => {
    expect(contentDisposition('Manual', 'm.pdf')).toMatch(/^attachment; /)
  })

  it('emits both an ASCII filename and a UTF-8 one', () => {
    expect(contentDisposition('Manual', 'm.pdf')).toBe(
      `attachment; filename="Manual.pdf"; filename*=UTF-8''Manual.pdf`,
    )
  })

  it('folds a non-ASCII name for the legacy parameter and encodes the real one', () => {
    const header = contentDisposition('模型', 'm.pdf')
    expect(header).toContain('filename="__.pdf"')
    expect(header).toContain(`filename*=UTF-8''${encodeURIComponent('模型.pdf')}`)
  })

  // The one that matters: a CR/LF in the name must not be able to end the header
  // and start another.
  it('cannot be used to inject a second header', () => {
    const header = contentDisposition('a\r\nX-Evil: 1', 'm.pdf')
    expect(header).not.toContain('\r')
    expect(header).not.toContain('\n')
  })

  it('cannot be used to close the quoted parameter early', () => {
    const header = contentDisposition('a"; evil="1', 'm.pdf')
    // Exactly two quotes: the pair around the ASCII filename.
    expect(header.split('"')).toHaveLength(3)
  })
})
