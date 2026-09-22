import type { WallpaperBackgroundPresetId } from '../types/wallpaper'
import bgCyber from '../assets/wallpapers/bg-cyber.jpg'
import bgLayered from '../assets/wallpapers/bg-layered.jpg'
import bgMetal from '../assets/wallpapers/bg-metal.jpg'
import bgNeonPoly from '../assets/wallpapers/bg-neon-poly.jpg'

export type WallpaperBackgroundPreset = {
  id: Exclude<WallpaperBackgroundPresetId, 'none' | 'custom'>
  label: string
  fileName: string
  url: string
}

/** Vier feste Marken-Hintergründe zur Auswahl. */
export const WALLPAPER_BACKGROUND_PRESETS: WallpaperBackgroundPreset[] = [
  {
    id: 'neon-poly',
    label: 'Neon Geometrie',
    fileName: 'bg-neon-poly.jpg',
    url: bgNeonPoly,
  },
  {
    id: 'layered',
    label: 'Layer Rot/Blau',
    fileName: 'bg-layered.jpg',
    url: bgLayered,
  },
  {
    id: 'cyber',
    label: 'Cyber Space',
    fileName: 'bg-cyber.jpg',
    url: bgCyber,
  },
  {
    id: 'metal',
    label: 'Metall Glow',
    fileName: 'bg-metal.jpg',
    url: bgMetal,
  },
]

export function getWallpaperBackgroundPreset(
  id: WallpaperBackgroundPresetId,
): WallpaperBackgroundPreset | null {
  if (id === 'none' || id === 'custom') return null
  return WALLPAPER_BACKGROUND_PRESETS.find((item) => item.id === id) ?? null
}
