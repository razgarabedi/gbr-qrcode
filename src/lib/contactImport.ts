import { emptyContactCard, type ContactCard } from '../types/contact'
import { hasContactMethod, isContactValid, trimValue } from './validate'

export type ImportIssue = {
  source: string
  message: string
}

export type ContactImportResult = {
  contacts: ContactCard[]
  issues: ImportIssue[]
  fileCount: number
  formatHints: string[]
}

const IMPORT_EXTENSIONS = ['.vcf', '.vcard', '.csv', '.txt'] as const

/** Für Batch-Export: mind. ein Name + Telefon/E-Mail reichen (Firma optional). */
export function isBatchContactExportable(contact: ContactCard): boolean {
  const hasName = Boolean(trimValue(contact.firstName) || trimValue(contact.lastName))
  return hasName && hasContactMethod(contact)
}

export function isImportableContactFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return IMPORT_EXTENSIONS.some((ext) => name.endsWith(ext))
}

function unescapeVCardValue(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}

/** RFC 2425 Zeilenfortsetzung: Zeilen die mit Space/Tab beginnen anhängen. */
export function unfoldVCardText(text: string): string {
  return text.replace(/\r\n|\r|\n/g, '\n').replace(/\n[ \t]/g, '')
}

function splitVCardDocuments(text: string): string[] {
  const unfolded = unfoldVCardText(text)
  const blocks: string[] = []
  const parts = unfolded.split(/BEGIN:VCARD/i)
  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const end = trimmed.search(/END:VCARD/i)
    if (end < 0) continue
    blocks.push(`BEGIN:VCARD\n${trimmed.slice(0, end + 'END:VCARD'.length)}`)
  }
  return blocks
}

function parseVCardPropertyLine(line: string): { name: string; params: string; value: string } | null {
  const colon = line.indexOf(':')
  if (colon < 0) return null
  const left = line.slice(0, colon)
  const value = line.slice(colon + 1)
  const semi = left.indexOf(';')
  const name = (semi >= 0 ? left.slice(0, semi) : left).toUpperCase()
  const params = (semi >= 0 ? left.slice(semi + 1) : '').toUpperCase()
  return { name, params, value: unescapeVCardValue(value) }
}

function splitStructured(value: string): string[] {
  const parts: string[] = []
  let current = ''
  let escaped = false
  for (const ch of value) {
    if (escaped) {
      current += ch
      escaped = false
      continue
    }
    if (ch === '\\') {
      escaped = true
      continue
    }
    if (ch === ';') {
      parts.push(current)
      current = ''
      continue
    }
    current += ch
  }
  parts.push(current)
  return parts
}

function assignPhone(contact: ContactCard, params: string, value: string): void {
  const v = trimValue(value)
  if (!v) return
  if (params.includes('CELL') || params.includes('MOBILE') || params.includes('IPHONE')) {
    if (!contact.phoneMobile) contact.phoneMobile = v
    return
  }
  if (params.includes('WORK') || params.includes('VOICE') || params.includes('MAIN')) {
    if (!contact.phoneWork) contact.phoneWork = v
    return
  }
  if (!contact.phoneWork) contact.phoneWork = v
  else if (!contact.phoneMobile) contact.phoneMobile = v
}

function assignEmail(contact: ContactCard, value: string): void {
  const v = trimValue(value)
  if (!v) return
  if (!contact.emailWork) contact.emailWork = v
}

/**
 * Parst einen einzelnen vCard-Block zu ContactCard.
 */
export function parseSingleVCard(block: string): ContactCard {
  const contact = emptyContactCard()
  contact.country = ''
  const lines = unfoldVCardText(block).split('\n')

  for (const raw of lines) {
    const line = raw.trim()
    if (!line || /^BEGIN:VCARD$/i.test(line) || /^END:VCARD$/i.test(line) || /^VERSION:/i.test(line)) {
      continue
    }
    const prop = parseVCardPropertyLine(line)
    if (!prop) continue
    const { name, params, value } = prop

    switch (name) {
      case 'N': {
        const parts = splitStructured(value)
        const family = parts[0] ?? ''
        const given = parts[1] ?? ''
        if (trimValue(family) && !contact.lastName) contact.lastName = trimValue(family)
        if (trimValue(given) && !contact.firstName) contact.firstName = trimValue(given)
        break
      }
      case 'FN': {
        if (contact.firstName || contact.lastName) break
        const parts = trimValue(value).split(/\s+/)
        if (parts.length === 1) contact.firstName = parts[0]
        else if (parts.length > 1) {
          contact.firstName = parts.slice(0, -1).join(' ')
          contact.lastName = parts[parts.length - 1]
        }
        break
      }
      case 'ORG': {
        const parts = splitStructured(value)
        const org = parts[0] ?? ''
        const dept = parts[1] ?? ''
        if (trimValue(org)) contact.organization = trimValue(org)
        if (trimValue(dept)) contact.department = trimValue(dept)
        break
      }
      case 'TITLE':
        contact.title = trimValue(value)
        break
      case 'TEL':
        assignPhone(contact, params, value)
        break
      case 'EMAIL':
        assignEmail(contact, value)
        break
      case 'URL':
        contact.website = trimValue(value)
        break
      case 'ADR': {
        const parts = splitStructured(value)
        // PO;Ext;Street;Locality;Region;Postal;Country
        if (trimValue(parts[2] ?? '')) contact.street = trimValue(parts[2])
        if (trimValue(parts[3] ?? '')) contact.city = trimValue(parts[3])
        if (trimValue(parts[5] ?? '')) contact.postalCode = trimValue(parts[5])
        if (trimValue(parts[6] ?? '')) contact.country = trimValue(parts[6])
        break
      }
      default:
        break
    }
  }

  return contact
}

export function parseVcfText(text: string, source = 'vcard'): ContactImportResult {
  const issues: ImportIssue[] = []
  const contacts: ContactCard[] = []
  const blocks = splitVCardDocuments(text)
  if (blocks.length === 0) {
    issues.push({ source, message: 'Keine vCard-Einträge gefunden.' })
    return { contacts, issues, fileCount: 1, formatHints: ['vcf'] }
  }
  for (let i = 0; i < blocks.length; i += 1) {
    const contact = parseSingleVCard(blocks[i])
    if (!trimValue(contact.firstName) && !trimValue(contact.lastName)) {
      issues.push({
        source,
        message: `Eintrag ${i + 1}: kein Name erkannt — übersprungen.`,
      })
      continue
    }
    contacts.push(contact)
  }
  return { contacts, issues, fileCount: 1, formatHints: ['vcf'] }
}

function detectCsvDelimiter(headerLine: string): ',' | ';' | '\t' {
  const counts = {
    ',': (headerLine.match(/,/g) ?? []).length,
    ';': (headerLine.match(/;/g) ?? []).length,
    '\t': (headerLine.match(/\t/g) ?? []).length,
  }
  if (counts['\t'] >= counts[','] && counts['\t'] >= counts[';']) return '\t'
  if (counts[';'] > counts[',']) return ';'
  return ','
}

/** CSV mit Anführungszeichen (Outlook/Google). */
export function parseCsvRows(text: string): string[][] {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n|\r|\n/g, '\n')
  const firstLine = normalized.split('\n').find((l) => l.trim()) ?? ''
  const delimiter = detectCsvDelimiter(firstLine)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized[i]
    const next = normalized[i + 1]
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"'
        i += 1
      } else if (ch === '"') {
        inQuotes = false
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
      continue
    }
    if (ch === delimiter) {
      row.push(field)
      field = ''
      continue
    }
    if (ch === '\n') {
      row.push(field)
      field = ''
      if (row.some((cell) => trimValue(cell))) rows.push(row)
      row = []
      continue
    }
    field += ch
  }
  row.push(field)
  if (row.some((cell) => trimValue(cell))) rows.push(row)
  return rows
}

function normalizeHeader(value: string): string {
  return trimValue(value)
    .toLowerCase()
    .replace(/["']/g, '')
    .replace(/\s+/g, ' ')
}

type CsvField =
  | 'firstName'
  | 'lastName'
  | 'fullName'
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

const CSV_HEADER_MAP: Array<{ match: RegExp; field: CsvField }> = [
  { match: /^(first name|given name|vorname|firstname)$/, field: 'firstName' },
  { match: /^(last name|family name|nachname|lastname|surname)$/, field: 'lastName' },
  {
    match: /^(full name|display name|name|vollständiger name|anzeigename)$/,
    field: 'fullName',
  },
  { match: /^(job title|title|position|funktion|berufsbezeichnung)$/, field: 'title' },
  {
    match: /^(company|organization|organisation|firma|organization 1 - name|organisation name)$/,
    field: 'organization',
  },
  { match: /^(department|abteilung|organization 1 - department)$/, field: 'department' },
  {
    match:
      /^(mobile phone|mobile|cell phone|mobiltelefon|handy|mobile phone number|geschäftliches mobiltelefon|business mobile|business mobile phone|company mobile)$/,
    field: 'phoneMobile',
  },
  {
    match:
      /^(business phone|work phone|telefon geschäftlich|geschäftstelefon|primary phone|phone 1 - value|telefon)$/,
    field: 'phoneWork',
  },
  {
    match:
      /^(e-?mail address|e-?mail|e-mail-adresse|email address|e-mail 1 - value|primary email)$/,
    field: 'emailWork',
  },
  {
    match: /^(web page|website|webseite|home page|homepage|url)$/,
    field: 'website',
  },
  {
    match:
      /^(business street|street|straße geschäftlich|strasse geschäftlich|street address|address 1 - street)$/,
    field: 'street',
  },
  {
    match:
      /^(business postal code|postal code|zip|plz geschäftlich|plz|address 1 - postal code)$/,
    field: 'postalCode',
  },
  {
    match: /^(business city|city|ort geschäftlich|ort|address 1 - city)$/,
    field: 'city',
  },
  {
    match:
      /^(business country\/region|business country|country\/region|country|land\/region geschäftlich|land geschäftlich|land|address 1 - country)$/,
    field: 'country',
  },
]

function mapCsvHeaders(headers: string[]): Array<CsvField | null> {
  return headers.map((header) => {
    const normalized = normalizeHeader(header)
    const found = CSV_HEADER_MAP.find((entry) => entry.match.test(normalized))
    return found?.field ?? null
  })
}

export function parseCsvContacts(text: string, source = 'csv'): ContactImportResult {
  const issues: ImportIssue[] = []
  const rows = parseCsvRows(text)
  if (rows.length < 2) {
    issues.push({ source, message: 'CSV enthält keine Datenzeilen.' })
    return { contacts: [], issues, fileCount: 1, formatHints: ['csv'] }
  }

  const headerMap = mapCsvHeaders(rows[0])
  if (!headerMap.some((field) => field === 'firstName' || field === 'lastName' || field === 'fullName')) {
    issues.push({
      source,
      message:
        'CSV-Spalten nicht erkannt. Erwartet werden u. a. Vorname/Nachname (Outlook/Google).',
    })
    return { contacts: [], issues, fileCount: 1, formatHints: ['csv'] }
  }

  const contacts: ContactCard[] = []
  for (let r = 1; r < rows.length; r += 1) {
    const row = rows[r]
    const contact = emptyContactCard()
    contact.country = ''
    let fullName = ''
    headerMap.forEach((field, index) => {
      if (!field) return
      const value = trimValue(row[index] ?? '')
      if (!value) return
      if (field === 'fullName') {
        fullName = value
        return
      }
      contact[field] = value
    })
    if (!trimValue(contact.firstName) && !trimValue(contact.lastName) && fullName) {
      const parts = fullName.split(/\s+/)
      if (parts.length === 1) contact.firstName = parts[0]
      else {
        contact.firstName = parts.slice(0, -1).join(' ')
        contact.lastName = parts[parts.length - 1]
      }
    }
    if (!trimValue(contact.firstName) && !trimValue(contact.lastName)) {
      issues.push({ source, message: `Zeile ${r + 1}: kein Name — übersprungen.` })
      continue
    }
    contacts.push(contact)
  }

  return {
    contacts,
    issues,
    fileCount: 1,
    formatHints: ['csv', 'outlook'],
  }
}

function looksLikeVcf(text: string): boolean {
  return /BEGIN:VCARD/i.test(text)
}

function looksLikeCsv(text: string): boolean {
  const first = text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/).find((l) => l.trim()) ?? ''
  return /vorname|nachname|first name|last name|full name|^name,|,name,|e-?mail|company|firma|mobiltelefon|geschäftliches mobil/i.test(
    first,
  )
}

export async function importContactsFromFile(file: File): Promise<ContactImportResult> {
  const source = file.name
  const text = await file.text()
  const lower = file.name.toLowerCase()

  if (lower.endsWith('.vcf') || lower.endsWith('.vcard') || looksLikeVcf(text)) {
    return parseVcfText(text, source)
  }
  if (lower.endsWith('.csv') || looksLikeCsv(text)) {
    return parseCsvContacts(text, source)
  }
  if (looksLikeVcf(text)) return parseVcfText(text, source)
  if (looksLikeCsv(text)) return parseCsvContacts(text, source)

  return {
    contacts: [],
    issues: [
      {
        source,
        message: 'Unbekanntes Format. Unterstützt: VCF/vCard, Outlook-/Google-CSV.',
      },
    ],
    fileCount: 1,
    formatHints: [],
  }
}

export async function importContactsFromFiles(files: FileList | File[]): Promise<ContactImportResult> {
  const list = Array.from(files)
  const merged: ContactCard[] = []
  const issues: ImportIssue[] = []
  const hints = new Set<string>()
  let importedFiles = 0

  for (const file of list) {
    if (!isImportableContactFile(file) && file.type && !file.type.includes('text') && !file.type.includes('csv') && !file.type.includes('vcard')) {
      issues.push({
        source: file.name,
        message: 'Dateityp nicht unterstützt (VCF, vCard, CSV).',
      })
      continue
    }
    const result = await importContactsFromFile(file)
    importedFiles += 1
    merged.push(...result.contacts)
    issues.push(...result.issues)
    result.formatHints.forEach((h) => hints.add(h))
  }

  return {
    contacts: merged,
    issues,
    fileCount: importedFiles,
    formatHints: [...hints],
  }
}

export function summarizeImport(result: ContactImportResult): {
  total: number
  exportable: number
  fullyValid: number
} {
  return {
    total: result.contacts.length,
    exportable: result.contacts.filter(isBatchContactExportable).length,
    fullyValid: result.contacts.filter(isContactValid).length,
  }
}
