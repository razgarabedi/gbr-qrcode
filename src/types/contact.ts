export type ContactCard = {
  firstName: string
  lastName: string
  title: string
  organization: string
  department: string
  phoneMobile: string
  phoneWork: string
  emailWork: string
  website: string
  street: string
  postalCode: string
  city: string
  country: string
}

export type WallpaperLayout = 'phone' | 'desktop'

export type AppSettings = {
  layout: WallpaperLayout
  showNameOnWallpaper: boolean
  showTitleOnWallpaper: boolean
}

/** Einpassen = vollständig sichtbar; Zuschneiden = Fläche füllen. */
export type LogoFitMode = 'contain' | 'cover'

export type LogoAsset = {
  fileName: string
  objectUrl: string
  mimeType: string
  width: number
  height: number
  fitMode: LogoFitMode
  /** Für SVG: lokal gerasterte PNG-Data-URL (kein HTML-Embedding). */
  rasterDataUrl?: string
}

export const emptyContactCard = (): ContactCard => ({
  firstName: '',
  lastName: '',
  title: '',
  organization: '',
  department: '',
  phoneMobile: '',
  phoneWork: '',
  emailWork: '',
  website: '',
  street: '',
  postalCode: '',
  city: '',
  country: 'Deutschland',
})
