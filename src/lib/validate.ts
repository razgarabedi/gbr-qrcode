import type { ContactCard } from '../types/contact'

export type ContactField = keyof ContactCard

export type ContactErrors = Partial<Record<ContactField | 'contactMethod', string>>

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^[+]?[\d\s/()-]+$/
const WEBSITE_HOST_PATTERN =
  /^(https?:\/\/)?([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(\/[^\s]*)?$/i

export function trimValue(value: string): string {
  return value.trim()
}

export function hasContactMethod(contact: ContactCard): boolean {
  return Boolean(
    trimValue(contact.emailWork) ||
      trimValue(contact.phoneMobile) ||
      trimValue(contact.phoneWork),
  )
}

export function isValidEmail(value: string): boolean {
  const trimmed = trimValue(value)
  if (!trimmed) return true
  return EMAIL_PATTERN.test(trimmed)
}

export function isValidPhone(value: string): boolean {
  const trimmed = trimValue(value)
  if (!trimmed) return true
  if (!PHONE_PATTERN.test(trimmed)) return false
  const digits = trimmed.replace(/\D/g, '')
  return digits.length >= 5
}

export function normalizeWebsite(value: string): string {
  const trimmed = trimValue(value)
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export function isValidWebsite(value: string): boolean {
  const trimmed = trimValue(value)
  if (!trimmed) return true
  const normalized = normalizeWebsite(trimmed)
  try {
    const url = new URL(normalized)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    return WEBSITE_HOST_PATTERN.test(normalized)
  } catch {
    return false
  }
}

export function validateContact(contact: ContactCard): ContactErrors {
  const errors: ContactErrors = {}

  const hasName = Boolean(trimValue(contact.firstName) || trimValue(contact.lastName))
  if (!hasName) {
    errors.firstName = 'Bitte geben Sie Vor- oder Nachname ein.'
    errors.lastName = 'Bitte geben Sie Vor- oder Nachname ein.'
  }

  if (!hasContactMethod(contact)) {
    errors.contactMethod =
      'Bitte geben Sie mindestens eine Kontaktmöglichkeit an (E-Mail, Mobil oder Festnetz).'
  }

  if (!isValidEmail(contact.emailWork)) {
    errors.emailWork = 'Bitte geben Sie eine gültige E-Mail-Adresse ein.'
  }

  if (!isValidPhone(contact.phoneMobile)) {
    errors.phoneMobile =
      'Die Mobilnummer darf Ziffern sowie Leerzeichen, +, /, - und Klammern enthalten.'
  }

  if (!isValidPhone(contact.phoneWork)) {
    errors.phoneWork =
      'Die Festnetznummer darf Ziffern sowie Leerzeichen, +, /, - und Klammern enthalten.'
  }

  if (!isValidWebsite(contact.website)) {
    errors.website = 'Bitte geben Sie eine gültige Webadresse ein (z. B. www.firma.de).'
  }

  return errors
}

export function isContactValid(contact: ContactCard): boolean {
  return Object.keys(validateContact(contact)).length === 0
}

export function formatDisplayName(contact: ContactCard): string {
  return [trimValue(contact.firstName), trimValue(contact.lastName)].filter(Boolean).join(' ')
}
