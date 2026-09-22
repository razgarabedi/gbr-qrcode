import type { LogoAsset, LogoFitMode } from '../types/contact'

export const LOGO_MAX_BYTES = 5 * 1024 * 1024

export const LOGO_ACCEPT_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.svg'] as const

export const LOGO_ACCEPT_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
] as const

const SVG_DANGEROUS_PATTERN =
  /<script[\s>]|on\w+\s*=|javascript:|data:\s*text\/html|<foreignObject[\s>]|<iframe[\s>]|<embed[\s>]|<object[\s>]|xlink:href\s*=\s*["']\s*javascript:/i

export type LogoValidationResult =
  | { ok: true; mimeType: string; extension: string }
  | { ok: false; message: string }

function getExtension(fileName: string): string {
  const index = fileName.lastIndexOf('.')
  if (index < 0) return ''
  return fileName.slice(index).toLowerCase()
}

function extensionToMime(extension: string): string | null {
  switch (extension) {
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.webp':
      return 'image/webp'
    case '.svg':
      return 'image/svg+xml'
    default:
      return null
  }
}

export function validateLogoFile(file: File): LogoValidationResult {
  if (file.size <= 0) {
    return { ok: false, message: 'Die Datei ist leer.' }
  }
  if (file.size > LOGO_MAX_BYTES) {
    return {
      ok: false,
      message: 'Das Logo darf höchstens 5 MB groß sein.',
    }
  }

  const extension = getExtension(file.name)
  const mimeFromExt = extensionToMime(extension)
  if (!mimeFromExt || !LOGO_ACCEPT_EXTENSIONS.includes(extension as (typeof LOGO_ACCEPT_EXTENSIONS)[number])) {
    return {
      ok: false,
      message: 'Erlaubt sind PNG, JPG, JPEG, WebP und SVG.',
    }
  }

  const mime = (file.type || mimeFromExt).toLowerCase()
  if (
    mime &&
    mime !== 'application/octet-stream' &&
    !LOGO_ACCEPT_MIME_TYPES.includes(mime as (typeof LOGO_ACCEPT_MIME_TYPES)[number])
  ) {
    return {
      ok: false,
      message: 'Der Dateityp wird nicht unterstützt. Erlaubt sind PNG, JPG, JPEG, WebP und SVG.',
    }
  }

  return { ok: true, mimeType: mimeFromExt, extension }
}

/**
 * Prüft SVG-Quelltext auf gefährliche Inhalte.
 * SVG wird später nur als Bild gerastert, nie als HTML eingefügt.
 */
export function assertSafeSvgContent(svgText: string): void {
  if (!svgText.toLowerCase().includes('<svg')) {
    throw new Error('Die SVG-Datei enthält kein gültiges SVG-Dokument.')
  }
  if (SVG_DANGEROUS_PATTERN.test(svgText)) {
    throw new Error(
      'Die SVG-Datei enthält potenziell unsichere Inhalte und wurde abgelehnt.',
    )
  }
}

export function revokeLogoAsset(logo: LogoAsset | null | undefined): void {
  if (!logo) return
  URL.revokeObjectURL(logo.objectUrl)
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Das Bild konnte nicht geladen werden.'))
    image.src = src
  })
}

async function rasterizeImageSource(
  sourceUrl: string,
  maxEdge = 1024,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const image = await loadHtmlImage(sourceUrl)
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas konnte nicht erzeugt werden.')
  }
  context.clearRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)
  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: image.naturalWidth || width,
    height: image.naturalHeight || height,
  }
}

/**
 * Lädt eine Logo-Datei lokal. SVG wird geprüft und gerastert (kein HTML-Embedding).
 * Rasterbilder bleiben unverändert und werden nur für die Vorschau referenziert.
 */
export async function loadLogoFromFile(
  file: File,
  fitMode: LogoFitMode = 'contain',
): Promise<LogoAsset> {
  const validation = validateLogoFile(file)
  if (!validation.ok) {
    throw new Error(validation.message)
  }

  if (validation.mimeType === 'image/svg+xml') {
    const svgText = await file.text()
    assertSafeSvgContent(svgText)
    const safeBlob = new Blob([svgText], { type: 'image/svg+xml' })
    const objectUrl = URL.createObjectURL(safeBlob)
    try {
      const raster = await rasterizeImageSource(objectUrl)
      return {
        fileName: file.name,
        objectUrl,
        mimeType: validation.mimeType,
        width: raster.width,
        height: raster.height,
        fitMode,
        rasterDataUrl: raster.dataUrl,
      }
    } catch (error) {
      URL.revokeObjectURL(objectUrl)
      throw error
    }
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await loadHtmlImage(objectUrl)
    return {
      fileName: file.name,
      objectUrl,
      mimeType: validation.mimeType,
      width: image.naturalWidth,
      height: image.naturalHeight,
      fitMode,
    }
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    throw error
  }
}

export async function loadLogoFromUrl(
  url: string,
  fileName: string,
  mimeType: string,
  fitMode: LogoFitMode = 'contain',
): Promise<LogoAsset> {
  const response = await fetch(url)
  const blob = await response.blob()
  const file = new File([blob], fileName, { type: mimeType || blob.type })
  return loadLogoFromFile(file, fitMode)
}

export function drawImageWithFit(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  imageWidth: number,
  imageHeight: number,
  boxX: number,
  boxY: number,
  boxWidth: number,
  boxHeight: number,
  fitMode: LogoFitMode,
): void {
  const scale =
    fitMode === 'cover'
      ? Math.max(boxWidth / imageWidth, boxHeight / imageHeight)
      : Math.min(boxWidth / imageWidth, boxHeight / imageHeight)

  const drawWidth = imageWidth * scale
  const drawHeight = imageHeight * scale
  const drawX = boxX + (boxWidth - drawWidth) / 2
  const drawY = boxY + (boxHeight - drawHeight) / 2

  context.save()
  context.beginPath()
  context.rect(boxX, boxY, boxWidth, boxHeight)
  context.clip()
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight)
  context.restore()
}

export function getLogoImageSourceUrl(logo: LogoAsset): string {
  return logo.rasterDataUrl ?? logo.objectUrl
}
