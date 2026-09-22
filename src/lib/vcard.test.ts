import { describe, expect, it } from 'vitest'
import { emptyContactCard, type ContactCard } from '../types/contact'
import {
  buildVCard,
  buildVcfFileName,
  escapeVCardValue,
  sanitizeFileNamePart,
} from './vcard'

function baseContact(overrides: Partial<ContactCard> = {}): ContactCard {
  return {
    ...emptyContactCard(),
    firstName: 'Max',
    lastName: 'Mustermann',
    organization: 'Musterfirma GmbH',
    emailWork: 'max@musterfirma.de',
    ...overrides,
  }
}

describe('escapeVCardValue', () => {
  it('escaped Backslash, Semikolon, Komma und Zeilenumbrüche', () => {
    expect(escapeVCardValue('a\\b')).toBe('a\\\\b')
    expect(escapeVCardValue('a;b')).toBe('a\\;b')
    expect(escapeVCardValue('a,b')).toBe('a\\,b')
    expect(escapeVCardValue('Zeile1\nZeile2')).toBe('Zeile1\\nZeile2')
  })
})

describe('buildVCard', () => {
  it('erzeugt vCard 3.0 mit CRLF und korrekter Namenszuordnung', () => {
    const text = buildVCard(baseContact())
    expect(text.startsWith('BEGIN:VCARD\r\nVERSION:3.0\r\n')).toBe(true)
    expect(text).toContain('N:Mustermann;Max;;;')
    expect(text).toContain('FN:Max Mustermann')
    expect(text.trimEnd().endsWith('END:VCARD')).toBe(true)
  })

  it('unterstützt deutsche Umlaute in UTF-8', () => {
    const text = buildVCard(
      baseContact({
        firstName: 'Jürgen',
        lastName: 'Böhm',
        organization: 'Ärztezentrum München',
        city: 'Köln',
      }),
    )
    expect(text).toContain('N:Böhm;Jürgen;;;')
    expect(text).toContain('FN:Jürgen Böhm')
    expect(text).toContain('ORG:Ärztezentrum München;')
    expect(text).toContain('Köln')
  })

  it('behält Bindestriche und Apostrophe', () => {
    const text = buildVCard(
      baseContact({
        firstName: "Hans-Peter",
        lastName: "O'Connor",
        title: 'Co-Lead',
        street: "Hauptstraße 12-14",
      }),
    )
    expect(text).toContain("N:O'Connor;Hans-Peter;;;")
    expect(text).toContain('TITLE:Co-Lead')
    expect(text).toContain('Hauptstraße 12-14')
  })

  it('unterscheidet Mobil- und Festnetznummer', () => {
    const text = buildVCard(
      baseContact({
        phoneMobile: '+49 170 1234567',
        phoneWork: '+49 89 123456-0',
      }),
    )
    expect(text).toContain('TEL;TYPE=CELL,WORK:+49 170 1234567')
    expect(text).toContain('TEL;TYPE=WORK,VOICE:+49 89 123456-0')
  })

  it('lässt leere optionale Felder weg', () => {
    const text = buildVCard(
      baseContact({
        title: '',
        department: '',
        phoneMobile: '',
        phoneWork: '',
        website: '',
        street: '',
        postalCode: '',
        city: '',
        country: '',
      }),
    )
    expect(text).not.toContain('TITLE:')
    expect(text).not.toContain('TEL;')
    expect(text).not.toContain('URL:')
    expect(text).not.toContain('ADR;')
    expect(text).toContain('ORG:Musterfirma GmbH;')
    expect(text).toContain('EMAIL;TYPE=INTERNET,WORK:max@musterfirma.de')
  })

  it('setzt Firma, Abteilung und Position korrekt', () => {
    const text = buildVCard(
      baseContact({
        organization: 'Geb. Becker',
        department: 'IT-Support',
        title: 'Systemadministrator',
      }),
    )
    expect(text).toContain('ORG:Geb. Becker;IT-Support')
    expect(text).toContain('TITLE:Systemadministrator')
  })

  it('bildet die Geschäftsadresse als ADR', () => {
    const text = buildVCard(
      baseContact({
        street: 'Beispielweg 5',
        postalCode: '80331',
        city: 'München',
        country: 'Deutschland',
      }),
    )
    expect(text).toContain('ADR;TYPE=WORK:;;Beispielweg 5;München;;80331;Deutschland')
  })

  it('enthält E-Mail und normalisierte Webseite', () => {
    const text = buildVCard(
      baseContact({
        emailWork: 'info@firma.de',
        website: 'www.firma.de',
      }),
    )
    expect(text).toContain('EMAIL;TYPE=INTERNET,WORK:info@firma.de')
    expect(text).toContain('URL:https://www.firma.de')
  })

  it('escaped Sonderzeichen in Werten, aber nicht ADR-Trenner', () => {
    const text = buildVCard(
      baseContact({
        organization: 'A;B,C\\D',
        street: 'Weg; 1',
        city: 'Stadt',
        country: 'Deutschland',
      }),
    )
    expect(text).toContain('ORG:A\\;B\\,C\\\\D;')
    expect(text).toContain('ADR;TYPE=WORK:;;Weg\\; 1;Stadt;;;Deutschland')
  })
})

describe('buildVcfFileName', () => {
  it('verwendet das Muster Vorname_Nachname.vcf', () => {
    expect(buildVcfFileName(baseContact({ firstName: 'Anna', lastName: 'Schmidt' }))).toBe(
      'Anna_Schmidt.vcf',
    )
  })

  it('bereinigt unsichere Dateizeichen', () => {
    expect(sanitizeFileNamePart('A/B:C')).toBe('ABC')
    expect(buildVcfFileName(baseContact({ firstName: 'Hans-Peter', lastName: "O'Neil" }))).toBe(
      "Hans-Peter_O'Neil.vcf",
    )
  })
})
