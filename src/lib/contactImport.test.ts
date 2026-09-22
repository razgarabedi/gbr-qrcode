import { describe, expect, it } from 'vitest'
import {
  isBatchContactExportable,
  parseCsvContacts,
  parseCsvRows,
  parseSingleVCard,
  parseVcfText,
  unfoldVCardText,
} from './contactImport'
import { buildBatchQrFileName } from './batchExport'
import { emptyContactCard } from '../types/contact'

describe('unfoldVCardText', () => {
  it('fügt fortgesetzte Zeilen zusammen', () => {
    const text = 'NOTE:Hallo\n Welt'
    expect(unfoldVCardText(text)).toBe('NOTE:HalloWelt')
  })
})

describe('parseVcfText', () => {
  it('liest mehrere Kontakte aus einer VCF', () => {
    const vcf = `BEGIN:VCARD
VERSION:3.0
N:Mustermann;Max;;;
FN:Max Mustermann
ORG:Firma GmbH
EMAIL;TYPE=INTERNET:max@firma.de
TEL;TYPE=CELL:+491701234567
END:VCARD
BEGIN:VCARD
VERSION:3.0
N:Beispiel;Anna;;;
FN:Anna Beispiel
ORG:Agentur
EMAIL:anna@agentur.de
END:VCARD
`
    const result = parseVcfText(vcf)
    expect(result.contacts).toHaveLength(2)
    expect(result.contacts[0].firstName).toBe('Max')
    expect(result.contacts[0].lastName).toBe('Mustermann')
    expect(result.contacts[0].emailWork).toBe('max@firma.de')
    expect(result.contacts[0].phoneMobile).toBe('+491701234567')
    expect(result.contacts[1].firstName).toBe('Anna')
    expect(result.contacts[1].organization).toBe('Agentur')
  })

  it('parst ADR-Felder', () => {
    const contact = parseSingleVCard(`BEGIN:VCARD
VERSION:3.0
N:Test;Tina;;;
ADR;TYPE=WORK:;;Musterweg 1;Berlin;;10115;Deutschland
EMAIL:tina@test.de
END:VCARD`)
    expect(contact.street).toBe('Musterweg 1')
    expect(contact.city).toBe('Berlin')
    expect(contact.postalCode).toBe('10115')
    expect(contact.country).toBe('Deutschland')
  })
})

describe('parseCsvContacts', () => {
  it('liest Outlook-CSV (englisch)', () => {
    const csv = `First Name,Last Name,Company,E-mail Address,Mobile Phone
Max,Mustermann,Firma GmbH,max@firma.de,+49170
Anna,Beispiel,Agentur,anna@agentur.de,
`
    const result = parseCsvContacts(csv)
    expect(result.contacts).toHaveLength(2)
    expect(result.contacts[0].organization).toBe('Firma GmbH')
    expect(result.contacts[0].phoneMobile).toBe('+49170')
    expect(result.contacts[1].emailWork).toBe('anna@agentur.de')
  })

  it('liest Outlook-CSV (deutsch, Semikolon)', () => {
    const csv = `Vorname;Nachname;Firma;E-Mail-Adresse;Mobiltelefon
Max;Mustermann;Firma;max@firma.de;0170
`
    const result = parseCsvContacts(csv)
    expect(result.contacts).toHaveLength(1)
    expect(result.contacts[0].firstName).toBe('Max')
    expect(result.contacts[0].emailWork).toBe('max@firma.de')
  })
})

describe('parseCsvRows', () => {
  it('respektiert Anführungszeichen', () => {
    const rows = parseCsvRows(`a,b\n"x,y",z\n`)
    expect(rows[1]).toEqual(['x,y', 'z'])
  })
})

describe('isBatchContactExportable', () => {
  it('braucht Name und Kontaktweg, Firma optional', () => {
    const contact = {
      ...emptyContactCard(),
      firstName: 'Max',
      lastName: 'Mustermann',
      emailWork: 'max@firma.de',
      organization: '',
    }
    expect(isBatchContactExportable(contact)).toBe(true)
  })

  it('exportiert auch mit nur Vorname und Mobilnummer', () => {
    const contact = {
      ...emptyContactCard(),
      firstName: 'Max',
      lastName: '',
      phoneMobile: '+49 170 1234567',
      organization: '',
    }
    expect(isBatchContactExportable(contact)).toBe(true)
  })

  it('exportiert mit Nachname und geschäftlicher Nummer', () => {
    const contact = {
      ...emptyContactCard(),
      firstName: '',
      lastName: 'Mustermann',
      phoneWork: '+49 30 123456',
    }
    expect(isBatchContactExportable(contact)).toBe(true)
  })

  it('lehnt Kontakte ohne Name oder ohne Kontaktweg ab', () => {
    expect(
      isBatchContactExportable({
        ...emptyContactCard(),
        phoneMobile: '+49 170 1234567',
      }),
    ).toBe(false)
    expect(
      isBatchContactExportable({
        ...emptyContactCard(),
        firstName: 'Max',
        lastName: 'Mustermann',
      }),
    ).toBe(false)
  })
})

describe('buildBatchQrFileName', () => {
  it('nutzt Vorname_Nachname.png', () => {
    expect(
      buildBatchQrFileName({
        ...emptyContactCard(),
        firstName: 'Max',
        lastName: 'Mustermann',
      }),
    ).toBe('Max_Mustermann.png')
  })

  it('nutzt nur vorhandenen Namen', () => {
    expect(
      buildBatchQrFileName({
        ...emptyContactCard(),
        firstName: 'Max',
        lastName: '',
      }),
    ).toBe('Max.png')
  })
})
