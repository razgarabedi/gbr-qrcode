/**
 * Lokales Speichern von Exporten.
 * Auf iPhone/iPad (Safari und Chrome) ignoriert WebKit den Download-Link
 * und zeigt stattdessen „In Safari öffnen“ — das übernimmt blob:-Dateien nicht.
 * Dort öffnen wir das systemeigene Teilen-Menü.
 */

export const IOS_SAVE_HINT =
  'Auf iPhone und iPad öffnet sich das Teilen-Menü. Wählen Sie „In Dateien sichern“ oder „Bild sichern“. „In Safari öffnen“ speichert die Datei nicht.'

export const IOS_NEEDS_TAP =
  'Tippen Sie auf „Jetzt sichern“. Im Teilen-Menü „In Dateien sichern“ oder „Bild sichern“ wählen. „In Safari öffnen“ speichert die Datei nicht.'

export type SaveResult =
  | { status: 'downloaded' }
  | { status: 'shared' }
  | { status: 'cancelled' }
  | { status: 'needs-gesture'; file: File }
  | { status: 'failed'; message: string }

type SharePayload = { files: File[] }

export type SaveEnvironment = {
  ios: boolean
  secureContext: boolean
  share?: (data: SharePayload) => Promise<void>
  canShare?: (data: SharePayload) => boolean
  download: (blob: Blob, fileName: string) => void
}

const MIME_FALLBACKS: Record<string, string[]> = {
  vcf: ['text/vcard', 'text/x-vcard', 'text/plain'],
  png: ['image/png'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  zip: ['application/zip', 'application/octet-stream'],
}

export function isIosUserAgent(userAgent: string, platform = '', maxTouchPoints = 0): boolean {
  if (/iPad|iPhone|iPod|CriOS|FxiOS|EdgiOS/.test(userAgent)) return true
  return platform === 'MacIntel' && maxTouchPoints > 1
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return isIosUserAgent(navigator.userAgent, navigator.platform, navigator.maxTouchPoints ?? 0)
}

export function shareMimeCandidates(fileName: string, blobType: string): string[] {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  const list: string[] = []
  const add = (type: string) => {
    const normalized = type.split(';')[0]?.trim().toLowerCase() ?? ''
    if (normalized && !list.includes(normalized)) list.push(normalized)
  }
  add(blobType)
  for (const type of MIME_FALLBACKS[ext] ?? []) add(type)
  return list
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',')
  const header = comma >= 0 ? dataUrl.slice(0, comma) : ''
  const data = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  const mime = /data:([^;,]+)/i.exec(header)?.[1] ?? 'application/octet-stream'
  const isBase64 = /;base64/i.test(header)
  const binary = isBase64 ? atob(data) : decodeURIComponent(data)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new Blob([bytes], { type: mime })
}

function safeFileName(fileName: string): string {
  const cleaned = fileName.replace(/[/\\?%*:|"<>]/g, '_').trim()
  return cleaned || 'download'
}

function errorName(error: unknown): string {
  if (typeof error === 'object' && error && 'name' in error && typeof error.name === 'string') {
    return error.name
  }
  return ''
}

export function iosSaveFailureMessage(fileName: string, reason: 'insecure' | 'unsupported'): string {
  if (reason === 'insecure') {
    return 'Speichern auf iPhone und iPad funktioniert nur über eine sichere Verbindung (HTTPS).'
  }
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.zip')) {
    return 'ZIP-Dateien lassen sich auf iPhone und iPad nicht direkt sichern. Bitte die QR-Codes einzeln als PNG speichern und im Teilen-Menü „Bild sichern“ wählen.'
  }
  if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    return 'Direktes Speichern ist hier blockiert. Tippen Sie das Vorschaubild lange an und wählen Sie „Zu Fotos hinzufügen“.'
  }
  return 'Direktes Speichern ist in diesem Browser blockiert. Tippen Sie erneut auf Speichern, damit das Teilen-Menü erscheint.'
}

function fileForShare(
  blob: Blob,
  fileName: string,
  mimeType: string | undefined,
  canShare?: (data: SharePayload) => boolean,
): File | null {
  const name = safeFileName(fileName)
  const candidates = shareMimeCandidates(name, mimeType || blob.type || '')
  const types = candidates.length > 0 ? candidates : ['application/octet-stream']
  if (!canShare) {
    return new File([blob], name, { type: types[0] })
  }
  for (const type of types) {
    const file = new File([blob], name, { type })
    try {
      if (canShare({ files: [file] })) return file
    } catch {
      // nächster MIME-Typ
    }
  }
  return null
}

export async function saveBlobInEnvironment(
  blob: Blob,
  fileName: string,
  mimeType: string | undefined,
  env: SaveEnvironment,
): Promise<SaveResult> {
  if (env.ios) {
    if (!env.secureContext) {
      return { status: 'failed', message: iosSaveFailureMessage(fileName, 'insecure') }
    }
    if (!env.share) {
      return { status: 'failed', message: iosSaveFailureMessage(fileName, 'unsupported') }
    }
    const name = safeFileName(fileName)
    const fallbackType =
      shareMimeCandidates(name, mimeType || blob.type || '')[0] || 'application/octet-stream'
    const file =
      fileForShare(blob, fileName, mimeType, env.canShare) ??
      new File([blob], name, { type: fallbackType })
    try {
      await env.share({ files: [file] })
      return { status: 'shared' }
    } catch (error) {
      const name = errorName(error)
      if (name === 'AbortError') return { status: 'cancelled' }
      if (name === 'NotAllowedError') return { status: 'needs-gesture', file }
      return { status: 'failed', message: iosSaveFailureMessage(file.name, 'unsupported') }
    }
  }

  env.download(blob, safeFileName(fileName))
  return { status: 'downloaded' }
}

function readSaveEnvironment(): SaveEnvironment {
  const nav = typeof navigator === 'undefined' ? undefined : navigator
  return {
    ios: nav
      ? isIosUserAgent(nav.userAgent, nav.platform, nav.maxTouchPoints ?? 0)
      : false,
    secureContext: typeof window === 'undefined' ? true : window.isSecureContext !== false,
    share:
      nav && typeof nav.share === 'function'
        ? (data) => nav.share(data)
        : undefined,
    canShare:
      nav && typeof nav.canShare === 'function'
        ? (data) => nav.canShare!(data)
        : undefined,
    download: anchorDownload,
  }
}

export function saveBlob(blob: Blob, fileName: string, mimeType?: string): Promise<SaveResult> {
  return saveBlobInEnvironment(blob, fileName, mimeType, readSaveEnvironment())
}

export function saveDataUrl(dataUrl: string, fileName: string): Promise<SaveResult> {
  const blob = dataUrlToBlob(dataUrl)
  return saveBlob(blob, fileName, blob.type)
}

export function saveTextFile(
  content: string,
  fileName: string,
  mimeType: string,
  options?: { utf8Bom?: boolean },
): Promise<SaveResult> {
  const payload = options?.utf8Bom ? `\uFEFF${content}` : content
  const type = mimeType.split(';')[0]?.trim() || 'text/plain'
  const blob = new Blob([payload], { type })
  return saveBlob(blob, fileName, type)
}

export function sharePreparedFile(file: File): Promise<SaveResult> {
  const share = typeof navigator !== 'undefined' ? navigator.share?.bind(navigator) : undefined
  if (!share) {
    return Promise.resolve({
      status: 'failed',
      message: iosSaveFailureMessage(file.name, 'unsupported'),
    })
  }
  return share({ files: [file] })
    .then(() => ({ status: 'shared' }) as SaveResult)
    .catch((error: unknown) => {
      const name = errorName(error)
      if (name === 'AbortError') return { status: 'cancelled' }
      if (name === 'NotAllowedError') return { status: 'needs-gesture', file }
      return { status: 'failed', message: iosSaveFailureMessage(file.name, 'unsupported') }
    })
}

/** Desktop-Download. Auf iOS nicht verwenden — siehe saveBlob. */
export function anchorDownload(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = safeFileName(fileName)
  anchor.rel = 'noopener'
  // display:none ignoriert WebKit beim programmatischen Klick.
  anchor.style.position = 'fixed'
  anchor.style.left = '0'
  anchor.style.top = '0'
  anchor.style.width = '1px'
  anchor.style.height = '1px'
  anchor.style.opacity = '0'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
}
