import { describe, expect, it } from 'vitest'
import { emptyContactCard } from '../types/contact'
import {
  applyPrivacyMode,
  createBusinessIncludeMap,
  createMinimalIncludeMap,
  filterContactForQr,
  isPrivacyExportReady,
} from './privacy'
import { buildVCard } from './vcard'

const fullContact = {
  ...emptyContactCard(),
  firstName: 'Max',
  lastName: 'Mustermann',
  title: 'Beratung',
  organization: 'Firma GmbH',
  department: 'Intern',
  phoneMobile: '+49 170 111',
  phoneWork: '+49 89 222',
  emailWork: 'max@firma.de',
  website: 'www.firma.de',
  street: 'Geheimweg 1',
  postalCode: '80331',
  city: 'München',
  country: 'Deutschland',
}

describe('filterContactForQr', () => {
  it('übernimmt standardmäßig nur geschäftliche Daten ohne Adresse', () => {
    const filtered = filterContactForQr(fullContact, createBusinessIncludeMap())
    expect(filtered.department).toBe('')
    expect(filtered.street).toBe('')
    expect(filtered.city).toBe('')
    expect(filtered.emailWork).toBe('max@firma.de')
    expect(filtered.phoneWork).toBe('+49 89 222')

    const vcard = buildVCard(filtered)
    expect(vcard).not.toContain('ADR;')
    expect(vcard).not.toContain('Intern')
    expect(vcard).toContain('EMAIL;TYPE=INTERNET,WORK:max@firma.de')
  })

  it('beschränkt den datensparsamen Modus auf die erlaubten Felder', () => {
    const privacy = applyPrivacyMode('minimal')
    expect(privacy.mode).toBe('minimal')
    const filtered = filterContactForQr(fullContact, privacy.include)
    expect(filtered.firstName).toBe('Max')
    expect(filtered.lastName).toBe('Mustermann')
    expect(filtered.organization).toBe('Firma GmbH')
    expect(filtered.title).toBe('Beratung')
    expect(filtered.phoneWork).toBe('+49 89 222')
    expect(filtered.emailWork).toBe('max@firma.de')
    expect(filtered.website).toBe('www.firma.de')
    expect(filtered.department).toBe('')
    expect(filtered.street).toBe('')
    expect(filtered.country).toBe('')

    const minimalKeys = Object.entries(createMinimalIncludeMap())
      .filter(([, enabled]) => enabled)
      .map(([key]) => key)
    expect(minimalKeys).toEqual(
      expect.arrayContaining([
        'firstName',
        'lastName',
        'organization',
        'title',
        'phoneMobile',
        'phoneWork',
        'emailWork',
        'website',
      ]),
    )
    expect(minimalKeys).not.toContain('department')
    expect(minimalKeys).not.toContain('street')
  })

  it('erlaubt Export nur mit ausreichenden gefilterten Kontaktdaten', () => {
    const privacy = applyPrivacyMode('business')
    expect(isPrivacyExportReady(fullContact, privacy)).toBe(true)

    const noContact = filterContactForQr(fullContact, {
      ...createBusinessIncludeMap(),
      phoneMobile: false,
      phoneWork: false,
      emailWork: false,
    })
    expect(noContact.emailWork).toBe('')
    expect(
      isPrivacyExportReady(fullContact, {
        mode: 'business',
        include: {
          ...createBusinessIncludeMap(),
          phoneMobile: false,
          phoneWork: false,
          emailWork: false,
        },
      }),
    ).toBe(false)
  })
})
