import { describe, expect, it } from 'vitest'
import {
  assertSafeSvgContent,
  validateLogoFile,
  LOGO_MAX_BYTES,
} from './logo'
import {
  computeLogoPlateLayout,
  logoPlateClearsFinderPatterns,
  LOGO_MAX_WIDTH_RATIO,
} from './qrCompose'

function mockFile(name: string, size: number, type: string): File {
  const buffer = new Uint8Array(size)
  return new File([buffer], name, { type })
}

describe('validateLogoFile', () => {
  it('akzeptiert erlaubte Formate unter 5 MB', () => {
    expect(validateLogoFile(mockFile('logo.png', 1024, 'image/png')).ok).toBe(true)
    expect(validateLogoFile(mockFile('logo.JPG', 1024, 'image/jpeg')).ok).toBe(true)
    expect(validateLogoFile(mockFile('logo.webp', 1024, 'image/webp')).ok).toBe(true)
    expect(validateLogoFile(mockFile('logo.svg', 1024, 'image/svg+xml')).ok).toBe(true)
  })

  it('lehnt zu große oder unzulässige Dateien ab', () => {
    const tooBig = validateLogoFile(mockFile('logo.png', LOGO_MAX_BYTES + 1, 'image/png'))
    expect(tooBig.ok).toBe(false)

    const badType = validateLogoFile(mockFile('logo.gif', 100, 'image/gif'))
    expect(badType.ok).toBe(false)
  })
})

describe('assertSafeSvgContent', () => {
  it('erlaubt einfaches SVG', () => {
    expect(() =>
      assertSafeSvgContent('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'),
    ).not.toThrow()
  })

  it('lehnt gefährliche SVG-Inhalte ab', () => {
    expect(() =>
      assertSafeSvgContent('<svg><script>alert(1)</script></svg>'),
    ).toThrow(/unsichere/i)
    expect(() =>
      assertSafeSvgContent('<svg onload="alert(1)"></svg>'),
    ).toThrow(/unsichere/i)
  })
})

describe('computeLogoPlateLayout', () => {
  it('begrenzt die Platte auf höchstens 15 % der QR-Breite und erhält Innenabstand', () => {
    const layout = computeLogoPlateLayout(1000, 0.2)
    expect(layout.ratio).toBeLessThanOrEqual(LOGO_MAX_WIDTH_RATIO)
    expect(layout.plateSize).toBe(150)
    expect(layout.innerSize).toBeLessThan(layout.plateSize)
    expect(layout.padding).toBeGreaterThan(0)
    expect(layout.plateX + layout.plateSize / 2).toBe(500)
  })

  it('hält die Finder-Patterns in den Ecken frei', () => {
    const qrSize = 512
    const moduleCount = 33
    const margin = 4
    const layout = computeLogoPlateLayout(qrSize, LOGO_MAX_WIDTH_RATIO)
    expect(
      logoPlateClearsFinderPatterns(qrSize, margin, moduleCount, layout.plateSize),
    ).toBe(true)

    expect(logoPlateClearsFinderPatterns(qrSize, margin, moduleCount, 400)).toBe(false)
  })
})
