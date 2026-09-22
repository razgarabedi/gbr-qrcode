import type { ContactCard } from '../types/contact'
import { normalizeWebsite, trimValue } from './validate'

/**
 * Escapes special characters for vCard 3.0 text values.
 * @see https://datatracker.ietf.org/doc/html/rfc2426
 */
export function escapeVCardValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
}

function filled(value: string): string | null {
  const trimmed = trimValue(value)
  return trimmed ? trimmed : null
}

function line(property: string, value: string): string {
  return `${property}:${escapeVCardValue(value)}`
}

function structuredLine(property: string, components: string[]): string {
  return `${property}:${components.map((part) => escapeVCardValue(part)).join(';')}`
}

/**
 * Builds a vCard 3.0 document (UTF-8 text, CRLF line endings).
 * Only includes properties that have non-empty values.
 */
export function buildVCard(contact: ContactCard): string {
  const firstName = filled(contact.firstName) ?? ''
  const lastName = filled(contact.lastName) ?? ''
  const lines: string[] = ['BEGIN:VCARD', 'VERSION:3.0']

  // N: Family;Given;Additional;Prefix;Suffix
  lines.push(structuredLine('N', [lastName, firstName, '', '', '']))

  const fullName = [firstName, lastName].filter(Boolean).join(' ')
  if (fullName) {
    lines.push(line('FN', fullName))
  }

  const organization = filled(contact.organization)
  const department = filled(contact.department)
  if (organization || department) {
    // ORG: Organization;Organizational Unit
    lines.push(structuredLine('ORG', [organization ?? '', department ?? '']))
  }

  const title = filled(contact.title)
  if (title) {
    lines.push(line('TITLE', title))
  }

  const phoneMobile = filled(contact.phoneMobile)
  if (phoneMobile) {
    lines.push(line('TEL;TYPE=CELL,WORK', phoneMobile))
  }

  const phoneWork = filled(contact.phoneWork)
  if (phoneWork) {
    lines.push(line('TEL;TYPE=WORK,VOICE', phoneWork))
  }

  const email = filled(contact.emailWork)
  if (email) {
    lines.push(line('EMAIL;TYPE=INTERNET,WORK', email))
  }

  const websiteRaw = filled(contact.website)
  if (websiteRaw) {
    lines.push(line('URL', normalizeWebsite(websiteRaw)))
  }

  const street = filled(contact.street)
  const city = filled(contact.city)
  const postalCode = filled(contact.postalCode)
  const country = filled(contact.country)

  if (street || city || postalCode || country) {
    // ADR: PO Box;Extended;Street;Locality;Region;Postal Code;Country
    lines.push(
      structuredLine('ADR;TYPE=WORK', [
        '',
        '',
        street ?? '',
        city ?? '',
        '',
        postalCode ?? '',
        country ?? '',
      ]),
    )
  }

  lines.push('END:VCARD')
  return `${lines.join('\r\n')}\r\n`
}

const UNSAFE_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g

export function sanitizeFileNamePart(value: string): string {
  const trimmed = trimValue(value)
  const cleaned = trimmed.replace(UNSAFE_FILENAME_CHARS, '').replace(/\s+/g, '_')
  return cleaned || 'Kontakt'
}

/**
 * Dateiname nach dem Muster Vorname_Nachname.vcf
 */
export function buildVcfFileName(contact: ContactCard): string {
  const first = sanitizeFileNamePart(contact.firstName)
  const last = sanitizeFileNamePart(contact.lastName)
  return `${first}_${last}.vcf`
}
