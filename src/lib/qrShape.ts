import type { LogoAsset } from '../types/contact'
import { QR_MARGIN_MODULES, buildQrCodeOptions } from './qr'
import {
  decodeQrPayloadFromDataUrl,
  renderQrWithOptionalLogo,
  type QrComposeResult,
} from './qrCompose'
import QRCode from 'qrcode'

export type QrVisualStyle = 'classic' | 'integrated'

export const QR_VISUAL_STYLES: readonly QrVisualStyle[] = ['classic', 'integrated'] as const

/** Favicon-Farben (public/favicon.svg). */
export const BRAND_COLOR_RED = '#A8002A'
export const BRAND_COLOR_NAVY = '#00325F'

export const INTEGRATED_QR_CAPTION = 'Scan Integrated QR for CV'

export type QrVisualOptions = {
  style: QrVisualStyle
  /** Nur für klassischen QR: optionales Logo in der Mitte. */
  logo: LogoAsset | null
  size: number
}

function isQrDarkPixel(r: number, g: number, b: number, a: number): boolean {
  if (a < 128) return false
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128
}

function roundRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radii: { tl: number; tr: number; br: number; bl: number },
): void {
  const { tl, tr, br, bl } = radii
  context.beginPath()
  context.moveTo(x + tl, y)
  context.lineTo(x + w - tr, y)
  context.quadraticCurveTo(x + w, y, x + w, y + tr)
  context.lineTo(x + w, y + h - br)
  context.quadraticCurveTo(x + w, y + h, x + w - br, y + h)
  context.lineTo(x + bl, y + h)
  context.quadraticCurveTo(x, y + h, x, y + h - bl)
  context.lineTo(x, y + tl)
  context.quadraticCurveTo(x, y, x + tl, y)
  context.closePath()
}

/**
 * Zwei Farbflächen (rot | navy); vollständiger QR mit weißen Modulen darüber.
 * Kein Ausschneiden — geometrisch wie ein normaler QR und damit scanbar.
 * Nur für QR-Vorschau/Export — nicht für Hintergrundbilder.
 */
export function compositeIntegratedQr(
  qrCanvas: HTMLCanvasElement,
  size: number,
): HTMLCanvasElement {
  const output = document.createElement('canvas')
  output.width = size
  output.height = size
  const outCtx = output.getContext('2d')
  if (!outCtx) throw new Error('Canvas konnte nicht erzeugt werden.')
  outCtx.imageSmoothingEnabled = false

  outCtx.fillStyle = '#FFFFFF'
  outCtx.fillRect(0, 0, size, size)

  const inset = Math.max(2, Math.round(size * 0.015))
  const panelY = inset
  const panelH = size - inset * 2
  const mid = size / 2
  const panelW = mid - inset
  const radius = Math.max(6, Math.round(size * 0.04))

  outCtx.fillStyle = BRAND_COLOR_RED
  roundRectPath(outCtx, inset, panelY, panelW, panelH, {
    tl: radius,
    tr: 0,
    br: 0,
    bl: radius,
  })
  outCtx.fill()

  outCtx.fillStyle = BRAND_COLOR_NAVY
  roundRectPath(outCtx, mid, panelY, panelW, panelH, {
    tl: 0,
    tr: radius,
    br: radius,
    bl: 0,
  })
  outCtx.fill()

  const qrCtx = qrCanvas.getContext('2d')
  if (!qrCtx) throw new Error('Canvas konnte nicht erzeugt werden.')
  const qrData = qrCtx.getImageData(0, 0, qrCanvas.width, qrCanvas.height)
  const out = outCtx.getImageData(0, 0, size, size)
  const scaleX = qrCanvas.width / size
  const scaleY = qrCanvas.height / size

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const qx = Math.min(qrCanvas.width - 1, Math.floor(x * scaleX))
      const qy = Math.min(qrCanvas.height - 1, Math.floor(y * scaleY))
      const qo = (qy * qrCanvas.width + qx) * 4
      if (
        !isQrDarkPixel(
          qrData.data[qo],
          qrData.data[qo + 1],
          qrData.data[qo + 2],
          qrData.data[qo + 3],
        )
      ) {
        continue
      }
      const o = (y * size + x) * 4
      out.data[o] = 255
      out.data[o + 1] = 255
      out.data[o + 2] = 255
      out.data[o + 3] = 255
    }
  }

  outCtx.putImageData(out, 0, 0)
  return output
}

/**
 * Integrierter QR: rot/navy-Flächen mit vollständigen weißen Modulen (scanbar).
 * Nicht für Wallpaper — dort bleibt immer der klassische QR.
 */
export async function renderIntegratedQr(
  payload: string,
  options: QrVisualOptions,
): Promise<QrComposeResult> {
  const size = Math.max(options.size, 512)

  const qrCanvas = document.createElement('canvas')
  await QRCode.toCanvas(qrCanvas, payload, {
    ...buildQrCodeOptions({
      size,
      errorCorrectionLevel: 'H',
      margin: QR_MARGIN_MODULES,
    }),
  })

  const output = compositeIntegratedQr(qrCanvas, size)
  const dataUrl = output.toDataURL('image/png')
  const decoded = await decodeQrPayloadFromDataUrl(dataUrl, {
    compositeOnWhite: false,
    inversionAttempts: 'attemptBoth',
  })

  return {
    dataUrl,
    usedRatio: null,
    shrinkApplied: false,
    readable: decoded === payload,
    warning:
      decoded === payload
        ? null
        : 'Der integrierte QR konnte lokal nicht zuverlässig gelesen werden. Bitte weniger Felder nutzen oder den klassischen Modus wählen.',
  }
}

export async function renderQrVisual(
  payload: string,
  options: QrVisualOptions,
): Promise<QrComposeResult> {
  if (options.style === 'integrated') {
    return renderIntegratedQr(payload, options)
  }
  return renderQrWithOptionalLogo(
    payload,
    { size: options.size, errorCorrectionLevel: 'H', margin: QR_MARGIN_MODULES },
    options.logo,
  )
}

export function qrVisualStyleLabel(style: QrVisualStyle): string {
  switch (style) {
    case 'classic':
      return 'Klassisch'
    case 'integrated':
      return 'Integriert'
  }
}

export function qrVisualStyleHint(style: QrVisualStyle): string {
  switch (style) {
    case 'classic':
      return 'Schwarz-weiß, Fehlerkorrektur H, Quiet Zone. Logo höchstens ca. 15 % Breite auf weißer Fläche.'
    case 'integrated':
      return `${INTEGRATED_QR_CAPTION} — vollständiger QR mit weißen Modulen auf rot/navy. Gilt auch für das Hintergrundbild.`
  }
}
