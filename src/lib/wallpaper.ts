import QRCode from 'qrcode'
import type { ContactCard, LogoAsset } from '../types/contact'
import type {
  QrWallpaperPosition,
  WallpaperSettings,
} from '../types/wallpaper'
import {
  drawImageWithFit,
  getLogoImageSourceUrl,
} from './logo'
import { QR_MARGIN_MODULES } from './qr'
import {
  decodeQrPayloadFromDataUrl,
} from './qrCompose'
import { type QrVisualStyle, renderQrVisual } from './qrShape'
import { formatDisplayName } from './validate'
import { sanitizeFileNamePart } from './vcard'

export type Rect = {
  x: number
  y: number
  width: number
  height: number
}

export type WallpaperRenderResult = {
  canvas: HTMLCanvasElement
  dataUrl: string
  qrRect: Rect
  expectedPayload: string
  readable: boolean
  warning: string | null
  scaleFactor: number
}

/** Safe areas for lock-screen chrome (clock, camera, home indicator). */
export function getSafeInsets(width: number, height: number): {
  top: number
  bottom: number
  left: number
  right: number
} {
  const portrait = height >= width
  if (portrait) {
    return {
      top: Math.round(height * 0.12),
      bottom: Math.round(height * 0.14),
      left: Math.round(width * 0.08),
      right: Math.round(width * 0.08),
    }
  }
  return {
    top: Math.round(height * 0.08),
    bottom: Math.round(height * 0.08),
    left: Math.round(width * 0.08),
    right: Math.round(width * 0.08),
  }
}

/**
 * Wählt eine ganzzahlige Modulpixelgröße, sodass der QR möglichst nahe an targetSize kommt.
 */
export function chooseIntegerQrPixelSize(
  targetSize: number,
  moduleCount: number,
  marginModules: number = QR_MARGIN_MODULES,
): { drawSize: number; modulePx: number; scaleFactor: number } {
  const modulesTotal = moduleCount + marginModules * 2
  const modulePx = Math.max(1, Math.round(targetSize / modulesTotal))
  const drawSize = modulesTotal * modulePx
  return {
    drawSize,
    modulePx,
    scaleFactor: modulePx,
  }
}

export function computeQrTargetSize(settings: WallpaperSettings): number {
  const shorter = Math.min(settings.width, settings.height)
  const percent = Math.min(0.48, Math.max(0.22, settings.qrSizePercent))
  return Math.round(shorter * percent)
}

export function resolveQrCenterY(
  contentTop: number,
  contentBottom: number,
  _stackHeight: number,
  position: QrWallpaperPosition,
): number {
  const usable = contentBottom - contentTop
  if (position === 'upper') {
    return Math.round(contentTop + usable * 0.38)
  }
  if (position === 'lower') {
    return Math.round(contentTop + usable * 0.62)
  }
  return Math.round(contentTop + usable * 0.5)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Bild konnte nicht geladen werden.'))
    image.src = src
  })
}

function mixHex(hex: string, withHex: string, amount: number): string {
  const parse = (value: string) => {
    const normalized = value.replace('#', '')
    const full =
      normalized.length === 3
        ? normalized
            .split('')
            .map((c) => c + c)
            .join('')
        : normalized
    return [
      Number.parseInt(full.slice(0, 2), 16),
      Number.parseInt(full.slice(2, 4), 16),
      Number.parseInt(full.slice(4, 6), 16),
    ] as const
  }
  const a = parse(hex)
  const b = parse(withHex)
  const mix = (i: number) => Math.round(a[i] * (1 - amount) + b[i] * amount)
  return `#${[mix(0), mix(1), mix(2)]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('')}`
}

function roundRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2)
  context.beginPath()
  context.moveTo(x + r, y)
  context.arcTo(x + width, y, x + width, y + height, r)
  context.arcTo(x + width, y + height, x, y + height, r)
  context.arcTo(x, y + height, x, y, r)
  context.arcTo(x, y, x + width, y, r)
  context.closePath()
}

/**
 * Glassmorphism-Panel: weichzeichneter Hintergrundausschnitt + Frost + Rand.
 * Der QR wird danach scharf darüber gezeichnet.
 */
function drawGlassPanel(
  context: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  options: { isDark: boolean; accentColor: string },
): void {
  const blurPx = Math.max(12, Math.round(Math.min(width, height) * 0.06))
  const pad = Math.ceil(blurPx * 2)

  // Größerer Ausschnitt für sauberen Blur am Rand
  const sx = Math.max(0, Math.floor(x - pad))
  const sy = Math.max(0, Math.floor(y - pad))
  const sw = Math.min(source.width - sx, Math.ceil(width + pad * 2))
  const sh = Math.min(source.height - sy, Math.ceil(height + pad * 2))

  const cropped = document.createElement('canvas')
  cropped.width = sw
  cropped.height = sh
  const cropCtx = cropped.getContext('2d')
  if (!cropCtx) return
  cropCtx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh)

  const blurred = document.createElement('canvas')
  blurred.width = sw
  blurred.height = sh
  const blurCtx = blurred.getContext('2d')
  if (!blurCtx) return
  blurCtx.filter = `blur(${blurPx}px)`
  blurCtx.drawImage(cropped, 0, 0)
  blurCtx.filter = 'none'

  // Weicher Schatten unter dem Glas
  context.save()
  context.shadowColor = 'rgba(0, 0, 0, 0.35)'
  context.shadowBlur = Math.round(Math.min(width, height) * 0.08)
  context.shadowOffsetY = Math.round(Math.min(width, height) * 0.025)
  roundRectPath(context, x, y, width, height, radius)
  context.fillStyle = 'rgba(0, 0, 0, 0.2)'
  context.fill()
  context.restore()

  // Blurred backdrop, zugeschnitten
  context.save()
  roundRectPath(context, x, y, width, height, radius)
  context.clip()
  context.drawImage(blurred, sx, sy)

  // Frost-Overlay
  const frost = context.createLinearGradient(x, y, x, y + height)
  if (options.isDark) {
    frost.addColorStop(0, 'rgba(255, 255, 255, 0.28)')
    frost.addColorStop(0.45, 'rgba(255, 255, 255, 0.12)')
    frost.addColorStop(1, 'rgba(255, 255, 255, 0.08)')
  } else {
    frost.addColorStop(0, 'rgba(255, 255, 255, 0.62)')
    frost.addColorStop(0.5, 'rgba(255, 255, 255, 0.42)')
    frost.addColorStop(1, 'rgba(255, 255, 255, 0.35)')
  }
  context.fillStyle = frost
  context.fillRect(x, y, width, height)

  // Feiner Akzent oben (Glas-Highlight statt massiver Balken)
  const accentH = Math.max(2, Math.round(height * 0.012))
  const accentGrad = context.createLinearGradient(x, y, x + width, y)
  accentGrad.addColorStop(0, `${options.accentColor}00`)
  accentGrad.addColorStop(0.2, `${options.accentColor}cc`)
  accentGrad.addColorStop(0.8, `${options.accentColor}cc`)
  accentGrad.addColorStop(1, `${options.accentColor}00`)
  context.fillStyle = accentGrad
  context.fillRect(x + radius * 0.4, y + accentH, width - radius * 0.8, accentH)

  // Lichtkante oben
  context.strokeStyle = 'rgba(255, 255, 255, 0.55)'
  context.lineWidth = Math.max(1, Math.round(width * 0.004))
  context.beginPath()
  context.moveTo(x + radius, y + 1)
  context.lineTo(x + width - radius, y + 1)
  context.stroke()

  context.restore()

  // Glasrand
  context.save()
  roundRectPath(context, x, y, width, height, radius)
  context.strokeStyle = options.isDark ? 'rgba(255, 255, 255, 0.38)' : 'rgba(255, 255, 255, 0.7)'
  context.lineWidth = Math.max(1.5, Math.round(width * 0.006))
  context.stroke()
  context.restore()
}

async function createQrSource(
  payload: string,
  targetSize: number,
  logo: LogoAsset | null,
  includeLogoInQr: boolean,
  qrStyle: QrVisualStyle = 'classic',
): Promise<{ canvas: HTMLCanvasElement; scaleFactor: number; warning: string | null }> {
  const qr = QRCode.create(payload, { errorCorrectionLevel: 'H' })
  const moduleCount = qr.modules.size
  const { drawSize, scaleFactor } = chooseIntegerQrPixelSize(targetSize, moduleCount)

  const composed = await renderQrVisual(payload, {
    style: qrStyle,
    size: drawSize,
    logo: qrStyle === 'classic' && includeLogoInQr ? logo : null,
  })

  const image = await loadImage(composed.dataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = drawSize
  canvas.height = drawSize
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas konnte nicht erzeugt werden.')
  }
  context.imageSmoothingEnabled = false
  context.drawImage(image, 0, 0, drawSize, drawSize)
  return { canvas, scaleFactor, warning: composed.warning }
}

/**
 * Decodiert den QR-Bereich aus einem fertigen Wallpaper.
 */
export async function decodeQrFromWallpaperRegion(
  source: HTMLCanvasElement | HTMLImageElement,
  qrRect: Rect,
  padding = 8,
): Promise<string | null> {
  const sourceWidth = source instanceof HTMLCanvasElement ? source.width : source.naturalWidth
  const sourceHeight = source instanceof HTMLCanvasElement ? source.height : source.naturalHeight
  const x = Math.max(0, Math.floor(qrRect.x - padding))
  const y = Math.max(0, Math.floor(qrRect.y - padding))
  const width = Math.min(sourceWidth - x, Math.ceil(qrRect.width + padding * 2))
  const height = Math.min(sourceHeight - y, Math.ceil(qrRect.height + padding * 2))

  const crop = document.createElement('canvas')
  crop.width = width
  crop.height = height
  const context = crop.getContext('2d')
  if (!context) return null
  context.imageSmoothingEnabled = false
  context.drawImage(source, x, y, width, height, 0, 0, width, height)
  return decodeQrPayloadFromDataUrl(crop.toDataURL('image/png'), {
    inversionAttempts: 'attemptBoth',
  })
}

export async function renderWallpaper(
  payload: string,
  contact: ContactCard,
  logo: LogoAsset | null,
  settings: WallpaperSettings,
  backgroundImage: LogoAsset | null = null,
  qrStyle: QrVisualStyle = 'classic',
): Promise<WallpaperRenderResult> {
  const width = Math.max(320, Math.round(settings.width))
  const height = Math.max(320, Math.round(settings.height))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas konnte nicht erzeugt werden.')
  }

  const insets = getSafeInsets(width, height)
  const isDark = settings.theme === 'dark'
  const textColor = isDark ? '#f4f7fb' : '#152033'
  const mutedText = isDark ? 'rgba(244, 247, 251, 0.72)' : 'rgba(21, 32, 51, 0.68)'

  // Basis: Farbe (Fallback und Unterlage)
  context.fillStyle = settings.backgroundColor
  context.fillRect(0, 0, width, height)

  if (backgroundImage) {
    const bgImage = await loadImage(getLogoImageSourceUrl(backgroundImage))
    const bgW = backgroundImage.width || bgImage.naturalWidth
    const bgH = backgroundImage.height || bgImage.naturalHeight
    drawImageWithFit(context, bgImage, bgW, bgH, 0, 0, width, height, 'cover')
    // Leichte Abdunklung/Aufhellung für Lesbarkeit von Text und QR-Karte
    context.fillStyle = isDark ? 'rgba(12, 18, 32, 0.42)' : 'rgba(255, 255, 255, 0.28)'
    context.fillRect(0, 0, width, height)
  } else {
    context.save()
    const gradient = context.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, settings.backgroundColor)
    gradient.addColorStop(0.55, mixHex(settings.backgroundColor, settings.accentColor, 0.22))
    gradient.addColorStop(1, settings.backgroundColor)
    context.fillStyle = gradient
    context.fillRect(0, 0, width, height)
    context.restore()
  }

  // Firmenlogo dezent im Hintergrund
  if (logo && settings.logoOpacity > 0) {
    const logoImage = await loadImage(getLogoImageSourceUrl(logo))
    const maxLogoW = width * (height >= width ? 0.72 : 0.42)
    const scale = Math.min(maxLogoW / logoImage.naturalWidth, (height * 0.28) / logoImage.naturalHeight)
    const lw = logoImage.naturalWidth * scale
    const lh = logoImage.naturalHeight * scale
    context.save()
    context.globalAlpha = Math.min(1, Math.max(0, settings.logoOpacity))
    context.drawImage(logoImage, (width - lw) / 2, insets.top * 0.55, lw, lh)
    context.restore()
  }

  const targetQr = computeQrTargetSize(settings)
  const qrSource = await createQrSource(
    payload,
    targetQr,
    logo,
    settings.includeLogoInQr,
    qrStyle,
  )
  const qrSize = qrSource.canvas.width
  const cardPad = Math.max(20, Math.round(qrSize * 0.09))
  const cardWidth = qrSize + cardPad * 2
  const cardHeight = qrSize + cardPad * 2
  const cardRadius = Math.max(18, Math.round(qrSize * 0.055))

  const contentTop = insets.top
  const contentBottom = height - insets.bottom
  let textBlockHeight = 0
  if (settings.showText) {
    textBlockHeight = Math.round(Math.min(width, height) * 0.09)
  }

  const stackHeight = cardHeight + (settings.showText ? textBlockHeight + Math.round(height * 0.02) : 0)
  let centerY = resolveQrCenterY(contentTop, contentBottom, stackHeight, settings.qrPosition)
  const halfStack = stackHeight / 2
  centerY = Math.min(
    Math.max(centerY, contentTop + halfStack),
    contentBottom - halfStack,
  )

  const cardX = Math.round((width - cardWidth) / 2)
  const cardY = Math.round(centerY - stackHeight / 2)
  const qrX = cardX + cardPad
  const qrY = cardY + cardPad

  drawGlassPanel(context, canvas, cardX, cardY, cardWidth, cardHeight, cardRadius, {
    isDark,
    accentColor: settings.accentColor,
  })

  // QR scharf (ohne Filter)
  context.imageSmoothingEnabled = false
  context.drawImage(qrSource.canvas, qrX, qrY, qrSize, qrSize)

  if (settings.showText) {
    const name = formatDisplayName(contact) || 'Mitarbeiter'
    const title = contact.title.trim()
    const textY0 = cardY + cardHeight + Math.round(height * 0.025)
    context.textAlign = 'center'
    context.fillStyle = textColor
    context.font = `600 ${Math.max(28, Math.round(Math.min(width, height) * 0.028))}px "Segoe UI", Helvetica, sans-serif`
    context.fillText(name, width / 2, textY0, width - insets.left - insets.right)

    let cursor = textY0 + Math.round(Math.min(width, height) * 0.028)
    if (title) {
      context.fillStyle = mutedText
      context.font = `500 ${Math.max(22, Math.round(Math.min(width, height) * 0.018))}px "Segoe UI", Helvetica, sans-serif`
      context.fillText(title, width / 2, cursor, width - insets.left - insets.right)
      cursor += Math.round(Math.min(width, height) * 0.024)
    }

    context.fillStyle = settings.accentColor
    context.font = `650 ${Math.max(20, Math.round(Math.min(width, height) * 0.016))}px "Segoe UI", Helvetica, sans-serif`
    context.fillText('Kontakt speichern', width / 2, cursor, width - insets.left - insets.right)
  }

  const qrRect: Rect = { x: qrX, y: qrY, width: qrSize, height: qrSize }
  const dataUrl = canvas.toDataURL('image/png')
  const decoded = await decodeQrFromWallpaperRegion(canvas, qrRect)
  const readable = decoded === payload

  return {
    canvas,
    dataUrl,
    qrRect,
    expectedPayload: payload,
    readable,
    warning: readable
      ? qrSource.warning
      : 'Der QR-Code im Hintergrundbild konnte nach dem Export nicht decodiert werden. Bitte QR-Größe erhöhen oder das Logo im QR-Code deaktivieren.',
    scaleFactor: qrSource.scaleFactor,
  }
}

export function buildWallpaperFileName(
  contact: ContactCard,
  settings: WallpaperSettings,
): string {
  const first = sanitizeFileNamePart(contact.firstName)
  const last = sanitizeFileNamePart(contact.lastName)
  return `${first}_${last}_wallpaper_${settings.width}x${settings.height}.png`
}

/** Hilfsfunktion für Unit-Tests: QR-Rechteck ohne Canvas berechnen. */
export function estimateQrCardLayout(settings: WallpaperSettings, moduleCount = 33): {
  qrSize: number
  cardWidth: number
  cardHeight: number
  qrRect: Rect
  insets: ReturnType<typeof getSafeInsets>
} {
  const insets = getSafeInsets(settings.width, settings.height)
  const target = computeQrTargetSize(settings)
  const { drawSize } = chooseIntegerQrPixelSize(target, moduleCount)
  const cardPad = Math.max(20, Math.round(drawSize * 0.09))
  const cardWidth = drawSize + cardPad * 2
  const cardHeight = drawSize + cardPad * 2
  const textBlockHeight = settings.showText
    ? Math.round(Math.min(settings.width, settings.height) * 0.09)
    : 0
  const stackHeight =
    cardHeight + (settings.showText ? textBlockHeight + Math.round(settings.height * 0.02) : 0)
  let centerY = resolveQrCenterY(
    insets.top,
    settings.height - insets.bottom,
    stackHeight,
    settings.qrPosition,
  )
  const halfStack = stackHeight / 2
  centerY = Math.min(
    Math.max(centerY, insets.top + halfStack),
    settings.height - insets.bottom - halfStack,
  )
  const cardX = Math.round((settings.width - cardWidth) / 2)
  const cardY = Math.round(centerY - stackHeight / 2)
  return {
    qrSize: drawSize,
    cardWidth,
    cardHeight,
    qrRect: {
      x: cardX + cardPad,
      y: cardY + cardPad,
      width: drawSize,
      height: drawSize,
    },
    insets,
  }
}
