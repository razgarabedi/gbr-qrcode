import { describe, expect, it } from 'vitest'
import {
  BRAND_COLOR_NAVY,
  BRAND_COLOR_RED,
  QR_VISUAL_STYLES,
  qrVisualStyleLabel,
} from './qrShape'

describe('Brand-Farben für integrierten QR', () => {
  it('entspricht favicon.svg', () => {
    expect(BRAND_COLOR_RED).toBe('#A8002A')
    expect(BRAND_COLOR_NAVY).toBe('#00325F')
  })
})

describe('qrVisualStyleLabel', () => {
  it('benennt Klassisch und Integriert', () => {
    expect(qrVisualStyleLabel('classic')).toBe('Klassisch')
    expect(qrVisualStyleLabel('integrated')).toBe('Integriert')
  })

  it('kennt keine Silhouette mehr', () => {
    expect(QR_VISUAL_STYLES).toEqual(['classic', 'integrated'])
  })
})
