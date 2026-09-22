export type WallpaperTheme = 'light' | 'dark'
export type QrWallpaperPosition = 'center' | 'upper' | 'lower'

export type WallpaperBackgroundPresetId =
  | 'none'
  | 'neon-poly'
  | 'layered'
  | 'cyber'
  | 'metal'
  | 'custom'

export type WallpaperPresetId =
  | 'iphone'
  | 'iphone-large'
  | 'android'
  | 'android-large'
  | 'desktop-fhd'
  | 'desktop-wqhd'
  | 'custom'

export type WallpaperPreset = {
  id: WallpaperPresetId
  label: string
  width: number
  height: number
  kind: 'phone' | 'desktop' | 'custom'
}

export type WallpaperSettings = {
  presetId: WallpaperPresetId
  width: number
  height: number
  backgroundColor: string
  accentColor: string
  theme: WallpaperTheme
  qrPosition: QrWallpaperPosition
  /** Anteil der kürzeren Kante (0.22–0.48). */
  qrSizePercent: number
  /** 0–1 */
  logoOpacity: number
  includeLogoInQr: boolean
  showText: boolean
  /** Vordefiniertes Motiv, eigenes Bild oder nur Farbe. */
  backgroundPresetId: WallpaperBackgroundPresetId
}

export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  { id: 'iphone', label: 'iPhone (1290 × 2796)', width: 1290, height: 2796, kind: 'phone' },
  {
    id: 'iphone-large',
    label: 'iPhone groß (1320 × 2868)',
    width: 1320,
    height: 2868,
    kind: 'phone',
  },
  {
    id: 'android',
    label: 'Android Standard (1080 × 2400)',
    width: 1080,
    height: 2400,
    kind: 'phone',
  },
  {
    id: 'android-large',
    label: 'Android groß (1440 × 3200)',
    width: 1440,
    height: 3200,
    kind: 'phone',
  },
  {
    id: 'desktop-fhd',
    label: 'Desktop Full HD (1920 × 1080)',
    width: 1920,
    height: 1080,
    kind: 'desktop',
  },
  {
    id: 'desktop-wqhd',
    label: 'Desktop WQHD (2560 × 1440)',
    width: 2560,
    height: 1440,
    kind: 'desktop',
  },
  { id: 'custom', label: 'Benutzerdefiniert', width: 1080, height: 1920, kind: 'custom' },
]

export function createDefaultWallpaperSettings(): WallpaperSettings {
  const preset = WALLPAPER_PRESETS[0]
  return {
    presetId: preset.id,
    width: preset.width,
    height: preset.height,
    backgroundColor: '#1c2b4a',
    accentColor: '#b3202a',
    theme: 'dark',
    qrPosition: 'center',
    qrSizePercent: 0.34,
    logoOpacity: 0.12,
    includeLogoInQr: true,
    showText: true,
    backgroundPresetId: 'none',
  }
}

export function getPresetById(id: WallpaperPresetId): WallpaperPreset {
  return WALLPAPER_PRESETS.find((item) => item.id === id) ?? WALLPAPER_PRESETS[0]
}

export function applyThemeDefaults(
  settings: WallpaperSettings,
  theme: WallpaperTheme,
): WallpaperSettings {
  if (theme === 'dark') {
    return {
      ...settings,
      theme,
      backgroundColor: '#1c2b4a',
      accentColor: '#b3202a',
    }
  }
  return {
    ...settings,
    theme,
    backgroundColor: '#e8edf4',
    accentColor: '#b3202a',
  }
}
