import { describe, expect, it } from 'vitest'
import { emptyContactCard } from '../types/contact'
import {
  hasContactMethod,
  isContactValid,
  isValidEmail,
  isValidPhone,
  isValidWebsite,
  normalizeWebsite,
  validateContact,
} from './validate'

describe('normalizeWebsite', () => {
  it('ergänzt https:// wenn kein Protokoll angegeben ist', () => {
    expect(normalizeWebsite('www.beispiel.de')).toBe('https://www.beispiel.de')
  })

  it('belässt vorhandenes Protokoll', () => {
    expect(normalizeWebsite('http://beispiel.de')).toBe('http://beispiel.de')
    expect(normalizeWebsite('https://beispiel.de/path')).toBe('https://beispiel.de/path')
  })
})

describe('Feldvalidierung', () => {
  it('akzeptiert gültige E-Mail-Adressen', () => {
    expect(isValidEmail('max@firma.de')).toBe(true)
    expect(isValidEmail('ungueltig')).toBe(false)
  })

  it('erlaubt formatierte Telefonnummern', () => {
    expect(isValidPhone('+49 (0) 170 / 123-4567')).toBe(true)
    expect(isValidPhone('abc')).toBe(false)
    expect(isValidPhone('123')).toBe(false)
  })

  it('validiert Webseiten nach Normalisierung', () => {
    expect(isValidWebsite('firma.de')).toBe(true)
    expect(isValidWebsite('https://firma.de/kontakt')).toBe(true)
    expect(isValidWebsite('nicht gültig')).toBe(false)
  })
})

describe('validateContact', () => {
  it('fordert Name und eine Kontaktmöglichkeit', () => {
    const errors = validateContact(emptyContactCard())
    expect(errors.firstName).toBeTruthy()
    expect(errors.lastName).toBeTruthy()
    expect(errors.organization).toBeUndefined()
    expect(errors.contactMethod).toBeTruthy()
    expect(hasContactMethod(emptyContactCard())).toBe(false)
  })

  it('ist gültig bei Vorname und Mobilnummer ohne Firma', () => {
    const contact = {
      ...emptyContactCard(),
      firstName: 'Max',
      phoneMobile: '+49 170 1234567',
    }
    expect(validateContact(contact)).toEqual({})
    expect(isContactValid(contact)).toBe(true)
  })

  it('ist gültig bei Nachname und Mobilnummer', () => {
    const contact = {
      ...emptyContactCard(),
      lastName: 'Mustermann',
      phoneMobile: '+49 170 1234567',
    }
    expect(validateContact(contact)).toEqual({})
    expect(isContactValid(contact)).toBe(true)
  })

  it('ist gültig bei vollständigen Mindestanforderungen', () => {
    const contact = {
      ...emptyContactCard(),
      firstName: 'Max',
      lastName: 'Mustermann',
      organization: 'Musterfirma GmbH',
      emailWork: 'max@musterfirma.de',
    }
    expect(validateContact(contact)).toEqual({})
    expect(isContactValid(contact)).toBe(true)
  })
})
