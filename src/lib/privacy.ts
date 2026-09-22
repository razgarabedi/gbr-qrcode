import { emptyContactCard, type ContactCard } from '../types/contact'
import { hasContactMethod, isContactValid, trimValue } from './validate'

/** Felder, die optional in den QR-Code übernommen werden können. */
export type QrIncludeField =
  | 'firstName'
  | 'lastName'
  | 'title'
  | 'organization'
  | 'department'
  | 'phoneMobile'
  | 'phoneWork'
  | 'emailWork'
  | 'website'
  | 'street'
  | 'postalCode'
  | 'city'
  | 'country'

export type PrivacyMode = 'business' | 'minimal'

export type FieldIncludeMap = Record<QrIncludeField, boolean>

export type PrivacySettings = {
  mode: PrivacyMode
  include: FieldIncludeMap
}

export type FieldOption = {
  key: QrIncludeField
  label: string
  /** Im datensparsamen Modus freigeschaltet. */
  inMinimal: boolean
  /** Kann vom Benutzer nicht abgewählt werden. */
  required: boolean
}

export const QR_FIELD_OPTIONS: FieldOption[] = [
  { key: 'firstName', label: 'Vorname', inMinimal: true, required: false },
  { key: 'lastName', label: 'Nachname', inMinimal: true, required: false },
  { key: 'organization', label: 'Firma', inMinimal: true, required: false },
  { key: 'title', label: 'Position / Jobtitel', inMinimal: true, required: false },
  { key: 'department', label: 'Abteilung', inMinimal: false, required: false },
  { key: 'phoneMobile', label: 'Geschäftliche Mobilnummer', inMinimal: true, required: false },
  { key: 'phoneWork', label: 'Geschäftliche Festnetznummer', inMinimal: true, required: false },
  { key: 'emailWork', label: 'Geschäftliche E-Mail-Adresse', inMinimal: true, required: false },
  { key: 'website', label: 'Firmenwebseite', inMinimal: true, required: false },
  { key: 'street', label: 'Straße und Hausnummer', inMinimal: false, required: false },
  { key: 'postalCode', label: 'Postleitzahl', inMinimal: false, required: false },
  { key: 'city', label: 'Ort', inMinimal: false, required: false },
  { key: 'country', label: 'Land', inMinimal: false, required: false },
]

/** Kategorien, die die Anwendung bewusst niemals in den QR-Code schreibt. */
export const NEVER_INCLUDED_ITEMS = [
  'Private Telefonnummern',
  'Private E-Mail-Adressen',
  'Geburtstage',
  'Interne Durchwahlen (nur nach ausdrücklicher Auswahl – hier nicht vorgesehen)',
  'Personalnummern',
  'Vertrauliche Microsoft-365-Informationen',
  'Zugangsdaten (Passwörter, Tokens, Secrets)',
  'Interne Notizen',
] as const

export const PRIVACY_CHECKLIST = [
  'Der Sperrbildschirm kann von anderen Personen gesehen und fotografiert werden.',
  'Alle im QR-Code enthaltenen Daten sind öffentlich auslesbar.',
  'Nehmen Sie nur geschäftliche Daten auf, die Sie bewusst teilen möchten.',
  'Private und vertrauliche Informationen gehören nicht in den QR-Code.',
  'Die Export-Bestätigung gilt nur für den aktuellen Export und wird nicht gespeichert.',
] as const

export const EXPORT_ACK_LABEL =
  'Mir ist bewusst, dass der QR-Code auf dem Sperrbildschirm von anderen Personen gelesen werden kann.'

export function createBusinessIncludeMap(): FieldIncludeMap {
  return {
    firstName: true,
    lastName: true,
    title: true,
    organization: true,
    department: false,
    phoneMobile: true,
    phoneWork: true,
    emailWork: true,
    website: true,
    street: false,
    postalCode: false,
    city: false,
    country: false,
  }
}

export function createMinimalIncludeMap(): FieldIncludeMap {
  return {
    firstName: true,
    lastName: true,
    title: true,
    organization: true,
    department: false,
    phoneMobile: true,
    phoneWork: true,
    emailWork: true,
    website: true,
    street: false,
    postalCode: false,
    city: false,
    country: false,
  }
}

export function createDefaultPrivacySettings(): PrivacySettings {
  return {
    mode: 'business',
    include: createBusinessIncludeMap(),
  }
}

export function applyPrivacyMode(mode: PrivacyMode): PrivacySettings {
  if (mode === 'minimal') {
    return { mode, include: createMinimalIncludeMap() }
  }
  return { mode, include: createBusinessIncludeMap() }
}

/**
 * Filtert die Kontaktkarte auf die für den QR-Code freigegebenen Felder.
 */
export function filterContactForQr(
  contact: ContactCard,
  include: FieldIncludeMap,
): ContactCard {
  const filtered = emptyContactCard()
  filtered.country = ''
  for (const option of QR_FIELD_OPTIONS) {
    filtered[option.key] = include[option.key] ? contact[option.key] : ''
  }
  return filtered
}

export function isPrivacyExportReady(
  contact: ContactCard,
  privacy: PrivacySettings,
): boolean {
  const filtered = filterContactForQr(contact, privacy.include)
  const hasName = Boolean(trimValue(filtered.firstName) || trimValue(filtered.lastName))
  if (!hasName || !hasContactMethod(filtered)) {
    return false
  }
  // Ursprungsdaten müssen weiterhin valide sein (Format), gefilterte Menge ausreichend.
  return isContactValid(contact) && Object.keys(filtered).length > 0
}

export function describeIncludedFields(include: FieldIncludeMap): string[] {
  return QR_FIELD_OPTIONS.filter((option) => include[option.key]).map((option) => option.label)
}
