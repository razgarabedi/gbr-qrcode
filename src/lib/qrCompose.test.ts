import QRCode from 'qrcode'
import { PNG } from 'pngjs'
import jsQR from 'jsqr'
import { describe, expect, it } from 'vitest'
import { emptyContactCard } from '../types/contact'
import { buildQrCodeOptions, QR_MARGIN_MODULES } from './qr'
import { computeLogoPlateLayout, LOGO_MAX_WIDTH_RATIO } from './qrCompose'
import { buildVCard } from './vcard'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const assetsDir = join(dirname(fileURLToPath(import.meta.url)), '../assets')

function decodePng(buffer: Buffer): string | null {
  const png = PNG.sync.read(buffer)
  const decoded = jsQR(new Uint8ClampedArray(png.data.buffer), png.width, png.height, {
    inversionAttempts: 'dontInvert',
  })
  return decoded?.data ?? null
}

function fillRect(
  png: PNG,
  x: number,
  y: number,
  width: number,
  height: number,
  rgba: [number, number, number, number],
): void {
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) {
      if (px < 0 || py < 0 || px >= png.width || py >= png.height) continue
      const idx = (png.width * py + px) << 2
      png.data[idx] = rgba[0]
      png.data[idx + 1] = rgba[1]
      png.data[idx + 2] = rgba[2]
      png.data[idx + 3] = rgba[3]
    }
  }
}

function drawLogoPlateOnPng(png: PNG, ratio: number, logoRgba: [number, number, number, number]): void {
  const layout = computeLogoPlateLayout(png.width, ratio)
  fillRect(png, layout.plateX, layout.plateY, layout.plateSize, layout.plateSize, [255, 255, 255, 255])
  fillRect(
    png,
    layout.innerX,
    layout.innerY,
    layout.innerSize,
    layout.innerSize,
    logoRgba,
  )
}

describe('QR mit Logo-Platte', () => {
  it('bleibt mit zentrierter weißer Logo-Fläche (15 %) und Firmenlogo-Pixeln lesbar', async () => {
    const contact = {
      ...emptyContactCard(),
      firstName: 'Jürgen',
      lastName: "O'Neill",
      organization: 'Geb. Becker',
      emailWork: 'info@beispiel.de',
      phoneMobile: '+49 170 1234567',
      country: '',
    }
    const vcard = buildVCard(contact)

    const qrBuffer = await QRCode.toBuffer(vcard, {
      ...buildQrCodeOptions({
        size: 512,
        errorCorrectionLevel: 'H',
        margin: QR_MARGIN_MODULES,
      }),
      type: 'png',
    })

    const png = PNG.sync.read(qrBuffer)
    // Firmenlogo unverändert laden und in die Innenfläche zeichnen (kein Datei-Rewrite).
    const logoPng = PNG.sync.read(readFileSync(join(assetsDir, 'logo-geb-becker.png')))
    const layout = computeLogoPlateLayout(png.width, LOGO_MAX_WIDTH_RATIO)
    fillRect(png, layout.plateX, layout.plateY, layout.plateSize, layout.plateSize, [255, 255, 255, 255])

    // Logo proportional einpassen (contain), ohne die Quelldatei zu verändern.
    const scale = Math.min(
      layout.innerSize / logoPng.width,
      layout.innerSize / logoPng.height,
    )
    const drawW = Math.max(1, Math.round(logoPng.width * scale))
    const drawH = Math.max(1, Math.round(logoPng.height * scale))
    const offsetX = layout.innerX + Math.floor((layout.innerSize - drawW) / 2)
    const offsetY = layout.innerY + Math.floor((layout.innerSize - drawH) / 2)

    for (let y = 0; y < drawH; y += 1) {
      for (let x = 0; x < drawW; x += 1) {
        const srcX = Math.min(logoPng.width - 1, Math.floor(x / scale))
        const srcY = Math.min(logoPng.height - 1, Math.floor(y / scale))
        const srcIdx = (logoPng.width * srcY + srcX) << 2
        const dstIdx = (png.width * (offsetY + y) + (offsetX + x)) << 2
        png.data[dstIdx] = logoPng.data[srcIdx]
        png.data[dstIdx + 1] = logoPng.data[srcIdx + 1]
        png.data[dstIdx + 2] = logoPng.data[srcIdx + 2]
        png.data[dstIdx + 3] = 255
      }
    }

    const composed = PNG.sync.write(png)
    expect(decodePng(composed)).toBe(vcard)
  })

  it('wird bei zu großer Abdeckung unlesbar – Verkleinern stellt Lesbarkeit wieder her', async () => {
    const vcard = buildVCard({
      ...emptyContactCard(),
      firstName: 'Max',
      lastName: 'Muster',
      organization: 'Firma',
      emailWork: 'max@firma.de',
      country: '',
    })

    const qrBuffer = await QRCode.toBuffer(vcard, {
      ...buildQrCodeOptions({
        size: 512,
        errorCorrectionLevel: 'H',
        margin: QR_MARGIN_MODULES,
      }),
      type: 'png',
    })

    const oversized = PNG.sync.read(qrBuffer)
    const huge = Math.floor(oversized.width * 0.7)
    const hx = Math.floor((oversized.width - huge) / 2)
    const hy = Math.floor((oversized.height - huge) / 2)
    fillRect(oversized, hx, hy, huge, huge, [0, 0, 0, 255])
    expect(decodePng(PNG.sync.write(oversized))).toBeNull()

    const shrunk = PNG.sync.read(qrBuffer)
    drawLogoPlateOnPng(shrunk, 0.1, [180, 30, 40, 255])
    expect(decodePng(PNG.sync.write(shrunk))).toBe(vcard)
  })
})
