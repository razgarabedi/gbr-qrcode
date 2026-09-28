import { describe, expect, it, vi } from 'vitest'
import {
  dataUrlToBlob,
  iosSaveFailureMessage,
  isIosUserAgent,
  saveBlobInEnvironment,
  shareMimeCandidates,
  type SaveEnvironment,
} from './download'

function env(overrides: Partial<SaveEnvironment> = {}): SaveEnvironment {
  return {
    ios: false,
    secureContext: true,
    download: vi.fn(),
    ...overrides,
  }
}

describe('isIosUserAgent', () => {
  it('erkennt iPhone, Chrome auf iOS und iPadOS', () => {
    expect(isIosUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true)
    expect(
      isIosUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1',
      ),
    ).toBe(true)
    expect(isIosUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5)).toBe(
      true,
    )
  })

  it('erkennt Desktop und Android nicht als iOS', () => {
    expect(isIosUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0')).toBe(
      false,
    )
    expect(isIosUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe(false)
    expect(isIosUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 0)).toBe(
      false,
    )
  })
})

describe('dataUrlToBlob', () => {
  it('liest MIME-Typ und Inhalt einer PNG-Data-URL', () => {
    const payload = btoa('png-bytes')
    const blob = dataUrlToBlob(`data:image/png;base64,${payload}`)
    expect(blob.type).toBe('image/png')
    expect(blob.size).toBe('png-bytes'.length)
  })
})

describe('shareMimeCandidates', () => {
  it('bietet für VCF mehrere von iOS akzeptierte Typen', () => {
    expect(shareMimeCandidates('kontakt.vcf', 'text/vcard;charset=utf-8')).toEqual([
      'text/vcard',
      'text/x-vcard',
      'text/plain',
    ])
  })
})

describe('saveBlobInEnvironment', () => {
  it('lädt auf dem Desktop herunter und öffnet kein Teilen-Menü', async () => {
    const share = vi.fn()
    const download = vi.fn()
    const blob = new Blob(['a'], { type: 'image/png' })
    const result = await saveBlobInEnvironment(blob, 'karte.png', 'image/png', env({ share, download }))
    expect(result).toEqual({ status: 'downloaded' })
    expect(download).toHaveBeenCalledOnce()
    expect(share).not.toHaveBeenCalled()
  })

  it('öffnet auf iOS das Teilen-Menü statt eines Downloads', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const download = vi.fn()
    const canShare = vi.fn().mockReturnValue(true)
    const blob = new Blob(['a'], { type: 'image/png' })
    const result = await saveBlobInEnvironment(
      blob,
      'karte.png',
      'image/png',
      env({ ios: true, share, canShare, download }),
    )
    expect(result.status).toBe('shared')
    expect(share).toHaveBeenCalledOnce()
    expect(share.mock.calls[0][0].files[0].name).toBe('karte.png')
    expect(download).not.toHaveBeenCalled()
  })

  it('startet auf iOS keinen Download, wenn das Teilen abgebrochen wird', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError'))
    const download = vi.fn()
    const blob = new Blob(['a'], { type: 'text/vcard' })
    const result = await saveBlobInEnvironment(
      blob,
      'kontakt.vcf',
      'text/vcard',
      env({ ios: true, share, canShare: () => true, download }),
    )
    expect(result).toEqual({ status: 'cancelled' })
    expect(download).not.toHaveBeenCalled()
  })

  it('merkt eine abgelaufene Tippgeste, ohne den kaputten Safari-Download zu starten', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('blocked', 'NotAllowedError'))
    const download = vi.fn()
    const blob = new Blob(['a'], { type: 'image/png' })
    const result = await saveBlobInEnvironment(
      blob,
      'karte.png',
      'image/png',
      env({ ios: true, share, canShare: () => true, download }),
    )
    expect(result.status).toBe('needs-gesture')
    if (result.status === 'needs-gesture') expect(result.file.name).toBe('karte.png')
    expect(download).not.toHaveBeenCalled()
  })

  it('fällt bei VCF auf einen teilbaren Typ zurück', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const canShare = vi.fn((data: { files: File[] }) => data.files[0].type === 'text/plain')
    const blob = new Blob(['BEGIN:VCARD'], { type: 'text/vcard' })
    const result = await saveBlobInEnvironment(
      blob,
      'kontakt.vcf',
      'text/vcard',
      env({ ios: true, share, canShare, download: vi.fn() }),
    )
    expect(result.status).toBe('shared')
    expect(share.mock.calls[0][0].files[0].type).toBe('text/plain')
  })

  it('versucht das Teilen auch wenn canShare ablehnt und lädt auf iOS nicht herunter', async () => {
    const share = vi.fn().mockRejectedValue(new TypeError('not shareable'))
    const download = vi.fn()
    const blob = new Blob(['zip'], { type: 'application/zip' })
    const result = await saveBlobInEnvironment(
      blob,
      'qr-codes.zip',
      'application/zip',
      env({ ios: true, share, canShare: () => false, download }),
    )
    expect(result).toEqual({
      status: 'failed',
      message: iosSaveFailureMessage('qr-codes.zip', 'unsupported'),
    })
    expect(share).toHaveBeenCalledOnce()
    expect(download).not.toHaveBeenCalled()
  })

  it('verlangt auf iOS eine sichere Verbindung', async () => {
    const download = vi.fn()
    const blob = new Blob(['a'], { type: 'image/png' })
    const result = await saveBlobInEnvironment(
      blob,
      'karte.png',
      'image/png',
      env({ ios: true, secureContext: false, share: vi.fn(), download }),
    )
    expect(result.status).toBe('failed')
    expect(download).not.toHaveBeenCalled()
  })
})
