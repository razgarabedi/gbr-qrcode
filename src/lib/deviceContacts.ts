import { emptyContactCard, type ContactCard } from '../types/contact'
import { trimValue } from './validate'

/** Teilmenge der Contact Picker API (Chrome Android). */
export type DeviceContactAddress = {
  addressLine?: string[]
  city?: string
  country?: string
  organization?: string
  postalCode?: string
  region?: string
}

export type DeviceContactInfo = {
  name?: string[]
  email?: string[]
  tel?: string[]
  address?: DeviceContactAddress[]
}

type ContactsManagerLike = {
  getProperties(): Promise<string[]>
  select(
    properties: string[],
    options?: { multiple?: boolean },
  ): Promise<DeviceContactInfo[]>
}

function getContactsManager(): ContactsManagerLike | null {
  if (typeof navigator === 'undefined') return null
  const contacts = (navigator as Navigator & { contacts?: ContactsManagerLike }).contacts
  if (!contacts || typeof contacts.select !== 'function') return null
  return contacts
}

/** Chrome Android (HTTPS): systemeigener Kontakt-Picker wie bei WhatsApp/Telegram. */
export function isDeviceContactPickerAvailable(): boolean {
  return getContactsManager() !== null
}

function applyDisplayName(contact: ContactCard, rawName: string): void {
  const name = trimValue(rawName)
  if (!name) return
  const parts = name.split(/\s+/)
  if (parts.length === 1) {
    contact.firstName = parts[0]
    return
  }
  contact.firstName = parts.slice(0, -1).join(' ')
  contact.lastName = parts[parts.length - 1]
}

function assignPhones(contact: ContactCard, phones: string[]): void {
  const unique = [...new Set(phones.map(trimValue).filter(Boolean))]
  if (unique.length === 0) return
  contact.phoneMobile = unique[0]
  if (unique.length > 1) contact.phoneWork = unique[1]
}

function assignEmails(contact: ContactCard, emails: string[]): void {
  const first = emails.map(trimValue).find(Boolean)
  if (first) contact.emailWork = first
}

function assignAddress(contact: ContactCard, address: DeviceContactAddress): void {
  const lines = (address.addressLine ?? []).map(trimValue).filter(Boolean)
  if (lines.length > 0) contact.street = lines.join(', ')
  if (trimValue(address.postalCode ?? '')) contact.postalCode = trimValue(address.postalCode!)
  if (trimValue(address.city ?? '')) contact.city = trimValue(address.city!)
  if (trimValue(address.country ?? '')) contact.country = trimValue(address.country!)
  if (trimValue(address.organization ?? '') && !trimValue(contact.organization)) {
    contact.organization = trimValue(address.organization!)
  }
}

/** Mappt einen Geräte-Kontakt auf die App-Kontaktkarte. */
export function mapDeviceContactToCard(info: DeviceContactInfo): ContactCard {
  const contact = emptyContactCard()
  contact.country = ''

  const displayName = (info.name ?? []).map(trimValue).find(Boolean) ?? ''
  applyDisplayName(contact, displayName)
  assignEmails(contact, info.email ?? [])
  assignPhones(contact, info.tel ?? [])

  const address = info.address?.[0]
  if (address) assignAddress(contact, address)

  return contact
}

export type DeviceContactPickResult =
  | { ok: true; contacts: ContactCard[]; cancelled: false }
  | { ok: true; contacts: []; cancelled: true }
  | { ok: false; message: string }

/**
 * Öffnet den systemeigenen Kontakt-Picker (Mehrfachauswahl).
 * Nur mit Nutzeraktion und unter HTTPS / localhost verfügbar.
 */
export async function pickDeviceContacts(options?: {
  multiple?: boolean
}): Promise<DeviceContactPickResult> {
  const manager = getContactsManager()
  if (!manager) {
    return {
      ok: false,
      message:
        'Direktzugriff auf Kontakte ist in diesem Browser nicht verfügbar. Bitte Chrome auf Android nutzen oder eine VCF-/CSV-Datei importieren.',
    }
  }

  try {
    const available = await manager.getProperties()
    const wanted = ['name', 'tel', 'email', 'address']
    const properties = wanted.filter((prop) => available.includes(prop))
    if (properties.length === 0) {
      return {
        ok: false,
        message: 'Der Kontakt-Picker liefert in diesem Browser keine nutzbaren Felder.',
      }
    }

    const selected = await manager.select(properties, {
      multiple: options?.multiple ?? true,
    })

    if (!selected || selected.length === 0) {
      return { ok: true, contacts: [], cancelled: true }
    }

    const contacts = selected
      .map(mapDeviceContactToCard)
      .filter(
        (contact) =>
          trimValue(contact.firstName) ||
          trimValue(contact.lastName) ||
          trimValue(contact.phoneMobile) ||
          trimValue(contact.phoneWork) ||
          trimValue(contact.emailWork),
      )

    if (contacts.length === 0) {
      return {
        ok: false,
        message: 'Die ausgewählten Kontakte enthielten keine nutzbaren Daten.',
      }
    }

    return { ok: true, contacts, cancelled: false }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { ok: true, contacts: [], cancelled: true }
    }
    return {
      ok: false,
      message:
        'Kontaktauswahl fehlgeschlagen. Unter HTTP im lokalen Netz ist der Geräte-Picker oft blockiert — HTTPS oder Datei-Import nutzen.',
    }
  }
}
