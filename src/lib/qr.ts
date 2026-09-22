import QRCode from 'qrcode'
import type { ContactCard } from '../types/contact'
import { sanitizeFileNamePart } from './vcard'

export const QR_EXPORT_SIZES = [512, 1024, 2048] as const
export type QrExportSize = (typeof QR_EXPORT_SIZES)[number]

/** Quiet Zone in Modulen (weißer Rand um den Code). */
export const QR_MARGIN_MODULES = 4

/** Ab dieser QR-Version gilt der Code als sehr dicht (Warnung). */
export const QR_DENSE_VERSION_THRESHOLD = 12

/** Ab dieser Nutzlastgröße (UTF-8-Bytes) zusätzlich warnen. */
export const QR_DENSE_BYTE_THRESHOLD = 420

export type QrRenderOptions = {
  size: number
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
  margin?: number
}

export type QrDensityInfo = {
  version: number
  moduleCount: number
  byteLength: number
  isDense: boolean
  warning: string | null
}

const DEFAULT_COLORS = {
  dark: '#000000',
  light: '#FFFFFF',
} as const

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length
}

export function buildQrCodeOptions(options: QrRenderOptions) {
  return {
    errorCorrectionLevel: options.errorCorrectionLevel ?? ('H' as const),
    margin: options.margin ?? QR_MARGIN_MODULES,
    width: options.size,
    color: DEFAULT_COLORS,
  }
}

/**
 * Bewertet, ob der QR-Code durch die Nutzlast sehr dicht wird.
 */
export function assessQrDensity(payload: string): QrDensityInfo {
  const byteLength = utf8ByteLength(payload)
  if (!payload) {
    return {
      version: 0,
      moduleCount: 0,
      byteLength: 0,
      isDense: false,
      warning: null,
    }
  }

  const qr = QRCode.create(payload, { errorCorrectionLevel: 'H' })
  const moduleCount = qr.modules.size
  const version = Math.round((moduleCount - 21) / 4) + 1
  const isDense =
    version >= QR_DENSE_VERSION_THRESHOLD || byteLength >= QR_DENSE_BYTE_THRESHOLD

  return {
    version,
    moduleCount,
    byteLength,
    isDense,
    warning: isDense
      ? `Der vCard-Inhalt ist relativ groß (QR-Version ${version}, ${byteLength} Byte). Der Code wird sehr dicht und kann auf manchen Smartphones schlechter scanbar sein. Reduzieren Sie optionale Felder oder kürzen Sie die Angaben.`
      : null,
  }
}

export async function renderQrDataUrl(
  payload: string,
  options: QrRenderOptions,
): Promise<string> {
  return QRCode.toDataURL(payload, {
    ...buildQrCodeOptions(options),
    type: 'image/png',
  })
}

export async function renderQrCanvas(
  canvas: HTMLCanvasElement,
  payload: string,
  options: QrRenderOptions,
): Promise<void> {
  await QRCode.toCanvas(canvas, payload, buildQrCodeOptions(options))
}

export function buildQrPngFileName(contact: ContactCard, size: QrExportSize): string {
  const first = sanitizeFileNamePart(contact.firstName)
  const last = sanitizeFileNamePart(contact.lastName)
  return `${first}_${last}_qr_${size}.png`
}
