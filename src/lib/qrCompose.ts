import QRCode from 'qrcode'
import {
  drawImageWithFit,
  getLogoImageSourceUrl,
} from './logo'
import { buildQrCodeOptions, type QrRenderOptions } from './qr'
import type { LogoAsset } from '../types/contact'

/** Maximales Logo-/Plattenmaß relativ zur QR-Bildbreite. */
export const LOGO_MAX_WIDTH_RATIO = 0.15

/** Innenabstand der weißen Fläche relativ zur Plattengröße. */
export const LOGO_PAD_RATIO = 0.12

/** Versuchswerte, falls der Code mit Logo nicht lesbar ist. */
export const LOGO_SHRINK_RATIOS = [0.15, 0.13, 0.11, 0.09, 0.07] as const

export const LOGO_UNREADABLE_WARNING =
  'Der QR-Code mit Logo konnte lokal nicht zuverlässig decodiert werden. Bitte verwenden Sie ein einfacheres Logo, wechseln Sie zu „Einpassen“ oder entfernen Sie das Logo.'

export type LogoPlateLayout = {
  ratio: number
  plateSize: number
  plateX: number
  plateY: number
  innerX: number
  innerY: number
  innerSize: number
  padding: number
}

export type QrComposeResult = {
  dataUrl: string
  usedRatio: number | null
  shrinkApplied: boolean
  readable: boolean
  warning: string | null
}

export function computeLogoPlateLayout(
  qrSize: number,
  ratio: number = LOGO_MAX_WIDTH_RATIO,
  padRatio: number = LOGO_PAD_RATIO,
): LogoPlateLayout {
  const safeRatio = Math.min(Math.max(ratio, 0.04), LOGO_MAX_WIDTH_RATIO)
  const plateSize = Math.max(8, Math.round(qrSize * safeRatio))
  const padding = Math.max(2, Math.round(plateSize * padRatio))
  const innerSize = Math.max(4, plateSize - padding * 2)
  const plateX = Math.round((qrSize - plateSize) / 2)
  const plateY = Math.round((qrSize - plateSize) / 2)

  return {
    ratio: safeRatio,
    plateSize,
    plateX,
    plateY,
    innerX: plateX + padding,
    innerY: plateY + padding,
    innerSize,
    padding,
  }
}

/**
 * Finder-Patterns liegen in den Ecken (7 Module + Abstand).
 * Die zentrierte Platte darf diese Zonen nicht schneiden.
 */
export function logoPlateClearsFinderPatterns(
  qrSize: number,
  marginModules: number,
  moduleCount: number,
  plateSize: number,
): boolean {
  const moduleSize = qrSize / (moduleCount + marginModules * 2)
  const finderPx = moduleSize * 8
  const plateStart = (qrSize - plateSize) / 2
  const plateEnd = plateStart + plateSize
  return plateStart >= finderPx && plateEnd <= qrSize - finderPx
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Logo konnte nicht geladen werden.'))
    image.src = src
  })
}

export type QrDecodeOptions = {
  /** Für invertierte Codes (z. B. weiße Module auf dunklem Firmenlogo). */
  inversionAttempts?: 'dontInvert' | 'onlyInvert' | 'attemptBoth'
  /** Transparenten Hintergrund vor dem Decodieren weiß füllen. */
  compositeOnWhite?: boolean
}

export async function decodeQrPayloadFromDataUrl(
  dataUrl: string,
  options?: QrDecodeOptions,
): Promise<string | null> {
  const jsQR = (await import('jsqr')).default
  const image = await loadImage(dataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d')
  if (!context) return null
  if (options?.compositeOnWhite) {
    context.fillStyle = '#FFFFFF'
    context.fillRect(0, 0, canvas.width, canvas.height)
  }
  context.drawImage(image, 0, 0)
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
  const result = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: options?.inversionAttempts ?? 'dontInvert',
  })
  return result?.data ?? null
}

async function drawQrBase(
  canvas: HTMLCanvasElement,
  payload: string,
  options: QrRenderOptions,
): Promise<void> {
  await QRCode.toCanvas(canvas, payload, buildQrCodeOptions(options))
}

function paintLogoOnQr(
  context: CanvasRenderingContext2D,
  logoImage: CanvasImageSource,
  logoWidth: number,
  logoHeight: number,
  fitMode: LogoAsset['fitMode'],
  layout: LogoPlateLayout,
): void {
  context.fillStyle = '#FFFFFF'
  context.fillRect(layout.plateX, layout.plateY, layout.plateSize, layout.plateSize)
  drawImageWithFit(
    context,
    logoImage,
    logoWidth,
    logoHeight,
    layout.innerX,
    layout.innerY,
    layout.innerSize,
    layout.innerSize,
    fitMode,
  )
}

/**
 * Erzeugt einen QR-Code und setzt optional ein Logo in die Mitte (mit weißer Fläche).
 * Nach dem Zeichnen wird decodiert; bei Fehlern wird das Logo schrittweise verkleinert.
 */
export async function renderQrWithOptionalLogo(
  payload: string,
  options: QrRenderOptions,
  logo: LogoAsset | null,
): Promise<QrComposeResult> {
  const canvas = document.createElement('canvas')
  await drawQrBase(canvas, payload, options)
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas konnte nicht erzeugt werden.')
  }

  if (!logo) {
    const dataUrl = canvas.toDataURL('image/png')
    const decoded = await decodeQrPayloadFromDataUrl(dataUrl)
    return {
      dataUrl,
      usedRatio: null,
      shrinkApplied: false,
      readable: decoded === payload,
      warning:
        decoded === payload
          ? null
          : 'Der QR-Code konnte lokal nicht decodiert werden. Bitte prüfen Sie die Kontaktdaten.',
    }
  }

  const logoImage = await loadImage(getLogoImageSourceUrl(logo))
  const logoWidth = logo.width || logoImage.naturalWidth
  const logoHeight = logo.height || logoImage.naturalHeight
  const moduleCount = QRCode.create(payload, { errorCorrectionLevel: 'H' }).modules.size
  const margin = options.margin ?? 4

  let lastDataUrl = canvas.toDataURL('image/png')
  let shrinkApplied = false

  for (let index = 0; index < LOGO_SHRINK_RATIOS.length; index += 1) {
    const ratio = LOGO_SHRINK_RATIOS[index]
    if (index > 0) shrinkApplied = true

    await drawQrBase(canvas, payload, options)
    const layout = computeLogoPlateLayout(canvas.width, ratio)

    if (!logoPlateClearsFinderPatterns(canvas.width, margin, moduleCount, layout.plateSize)) {
      continue
    }

    paintLogoOnQr(context, logoImage, logoWidth, logoHeight, logo.fitMode, layout)
    lastDataUrl = canvas.toDataURL('image/png')
    const decoded = await decodeQrPayloadFromDataUrl(lastDataUrl)
    if (decoded === payload) {
      return {
        dataUrl: lastDataUrl,
        usedRatio: layout.ratio,
        shrinkApplied,
        readable: true,
        warning: shrinkApplied
          ? `Das Logo wurde automatisch auf etwa ${Math.round(layout.ratio * 100)} % der QR-Breite verkleinert, damit der Code lesbar bleibt.`
          : null,
      }
    }
  }

  return {
    dataUrl: lastDataUrl,
    usedRatio: LOGO_SHRINK_RATIOS[LOGO_SHRINK_RATIOS.length - 1],
    shrinkApplied: true,
    readable: false,
    warning: LOGO_UNREADABLE_WARNING,
  }
}
