import { describe, expect, it } from 'vitest'
import { mapDeviceContactToCard } from './deviceContacts'

describe('mapDeviceContactToCard', () => {
  it('übernimmt Name, Mobilnummer und E-Mail', () => {
    const contact = mapDeviceContactToCard({
      name: ['Max Mustermann'],
      tel: ['+49 170 1234567'],
      email: ['max@firma.de'],
    })
    expect(contact.firstName).toBe('Max')
    expect(contact.lastName).toBe('Mustermann')
    expect(contact.phoneMobile).toBe('+49 170 1234567')
    expect(contact.emailWork).toBe('max@firma.de')
  })

  it('setzt zweite Nummer als Festnetz und Adresse/Firma', () => {
    const contact = mapDeviceContactToCard({
      name: ['Anna'],
      tel: ['+49 170 111', '+49 89 222'],
      address: [
        {
          organization: 'Firma GmbH',
          addressLine: ['Musterstr. 1'],
          postalCode: '80331',
          city: 'München',
          country: 'Deutschland',
        },
      ],
    })
    expect(contact.firstName).toBe('Anna')
    expect(contact.phoneMobile).toBe('+49 170 111')
    expect(contact.phoneWork).toBe('+49 89 222')
    expect(contact.organization).toBe('Firma GmbH')
    expect(contact.street).toBe('Musterstr. 1')
    expect(contact.city).toBe('München')
  })
})
