import QRCode from 'qrcode'
import { PNG } from 'pngjs'
import jsQR from 'jsqr'
import { describe, expect, it } from 'vitest'
import { emptyContactCard } from '../types/contact'
import { createDefaultWallpaperSettings } from '../types/wallpaper'
import { buildQrCodeOptions, QR_MARGIN_MODULES } from './qr'
import { buildVCard } from './vcard'
import {
  chooseIntegerQrPixelSize,
  estimateQrCardLayout,
  getSafeInsets,
} from './wallpaper'

function decodePng(buffer: Buffer): string | null {
  const png = PNG.sync.read(buffer)
  const decoded = jsQR(new Uint8ClampedArray(png.data.buffer), png.width, png.height, {
    inversionAttempts: 'dontInvert',
  })
  return decoded?.data ?? null
}

describe('chooseIntegerQrPixelSize', () => {
  it('liefert ganzzahlige Modulpixel und exakte Zeichengröße', () => {
    const moduleCount = 33
    const result = chooseIntegerQrPixelSize(400, moduleCount, QR_MARGIN_MODULES)
    const modulesTotal = moduleCount + QR_MARGIN_MODULES * 2
    expect(result.modulePx).toBeGreaterThanOrEqual(1)
    expect(result.drawSize).toBe(modulesTotal * result.modulePx)
    expect(result.drawSize % modulesTotal).toBe(0)
  })
})

describe('Wallpaper-Layout', () => {
  it('lässt Safe Areas für Uhrzeit und Systemleiste frei', () => {
    const settings = {
      ...createDefaultWallpaperSettings(),
      width: 1290,
      height: 2796,
      qrPosition: 'center' as const,
      showText: true,
    }
    const layout = estimateQrCardLayout(settings)
    expect(layout.qrRect.y).toBeGreaterThanOrEqual(layout.insets.top)
    expect(layout.qrRect.y + layout.qrRect.height).toBeLessThanOrEqual(
      settings.height - layout.insets.bottom,
    )
  })

  it('berechnet Safe Insets für Portrait und Landscape', () => {
    const phone = getSafeInsets(1080, 2400)
    expect(phone.top).toBeGreaterThan(phone.left)
    const desktop = getSafeInsets(1920, 1080)
    expect(desktop.top).toBeGreaterThan(0)
    expect(desktop.left).toBeGreaterThan(0)
  })
})

describe('QR im Wallpaper-Ausschnitt', () => {
  it('bleibt nach pixelgenauer Einbettung auf weißer Karte lesbar', async () => {
    const vcard = buildVCard({
      ...emptyContactCard(),
      firstName: 'Anna',
      lastName: 'Beispiel',
      organization: 'Firma GmbH',
      title: 'Beratung',
      emailWork: 'anna@firma.de',
      country: '',
    })

    const moduleCount = QRCode.create(vcard, { errorCorrectionLevel: 'H' }).modules.size
    const { drawSize } = chooseIntegerQrPixelSize(220, moduleCount, QR_MARGIN_MODULES)

    const qrBuffer = await QRCode.toBuffer(vcard, {
      ...buildQrCodeOptions({
        size: drawSize,
        errorCorrectionLevel: 'H',
        margin: QR_MARGIN_MODULES,
      }),
      type: 'png',
    })
    const qrPng = PNG.sync.read(qrBuffer)

    const wallpaperW = 540
    const wallpaperH = 960
    const pad = 24
    const qrX = Math.round((wallpaperW - qrPng.width) / 2)
    const qrY = Math.round(wallpaperH * 0.42 - qrPng.height / 2)

    const wallpaper = new PNG({ width: wallpaperW, height: wallpaperH, fill: true })
    for (let i = 0; i < wallpaper.data.length; i += 4) {
      wallpaper.data[i] = 28
      wallpaper.data[i + 1] = 43
      wallpaper.data[i + 2] = 74
      wallpaper.data[i + 3] = 255
    }

    for (let y = qrY - pad; y < qrY + qrPng.height + pad; y += 1) {
      for (let x = qrX - pad; x < qrX + qrPng.width + pad; x += 1) {
        if (x < 0 || y < 0 || x >= wallpaperW || y >= wallpaperH) continue
        const idx = (wallpaperW * y + x) << 2
        wallpaper.data[idx] = 255
        wallpaper.data[idx + 1] = 255
        wallpaper.data[idx + 2] = 255
        wallpaper.data[idx + 3] = 255
      }
    }

    for (let y = 0; y < qrPng.height; y += 1) {
      for (let x = 0; x < qrPng.width; x += 1) {
        const srcIdx = (qrPng.width * y + x) << 2
        const dstIdx = (wallpaperW * (qrY + y) + (qrX + x)) << 2
        wallpaper.data[dstIdx] = qrPng.data[srcIdx]
        wallpaper.data[dstIdx + 1] = qrPng.data[srcIdx + 1]
        wallpaper.data[dstIdx + 2] = qrPng.data[srcIdx + 2]
        wallpaper.data[dstIdx + 3] = 255
      }
    }

    const cropPad = 8
    const cropW = qrPng.width + cropPad * 2
    const cropH = qrPng.height + cropPad * 2
    const crop = new PNG({ width: cropW, height: cropH, fill: true })
    for (let y = 0; y < cropH; y += 1) {
      for (let x = 0; x < cropW; x += 1) {
        const sx = qrX - cropPad + x
        const sy = qrY - cropPad + y
        const srcIdx = (wallpaperW * sy + sx) << 2
        const dstIdx = (cropW * y + x) << 2
        crop.data[dstIdx] = wallpaper.data[srcIdx]
        crop.data[dstIdx + 1] = wallpaper.data[srcIdx + 1]
        crop.data[dstIdx + 2] = wallpaper.data[srcIdx + 2]
        crop.data[dstIdx + 3] = 255
      }
    }

    expect(decodePng(PNG.sync.write(crop))).toBe(vcard)
  })
})
