import QRCode from 'qrcode'
import { PNG } from 'pngjs'
import jsQR from 'jsqr'
import { describe, expect, it } from 'vitest'
import { emptyContactCard } from '../types/contact'
import { buildVCard } from './vcard'
import {
  assessQrDensity,
  buildQrCodeOptions,
  QR_DENSE_BYTE_THRESHOLD,
  QR_MARGIN_MODULES,
} from './qr'

describe('assessQrDensity', () => {
  it('warnt bei sehr großer Nutzlast', () => {
    const large = 'A'.repeat(QR_DENSE_BYTE_THRESHOLD + 50)
    const info = assessQrDensity(large)
    expect(info.isDense).toBe(true)
    expect(info.warning).toBeTruthy()
  })

  it('warnt nicht bei typischer kurzer vCard', () => {
    const vcard = buildVCard({
      ...emptyContactCard(),
      firstName: 'Max',
      lastName: 'Mustermann',
      organization: 'Firma GmbH',
      emailWork: 'max@firma.de',
      country: '',
    })
    const info = assessQrDensity(vcard)
    expect(info.isDense).toBe(false)
    expect(info.warning).toBeNull()
    expect(info.version).toBeGreaterThan(0)
  })
})

describe('QR-Code Roundtrip', () => {
  it('encodiert die vCard und decodiert denselben Inhalt wieder', async () => {
    const contact = {
      ...emptyContactCard(),
      firstName: 'Jürgen',
      lastName: "O'Neill-Böhm",
      title: 'Co-Lead',
      organization: 'Ärztezentrum München',
      department: 'IT',
      phoneMobile: '+49 170 1234567',
      phoneWork: '+49 89 123456-0',
      emailWork: 'juergen@beispiel.de',
      website: 'www.beispiel.de',
      street: 'Hauptstraße 12-14',
      postalCode: '80331',
      city: 'München',
      country: 'Deutschland',
    }
    const vcard = buildVCard(contact)

    const pngBuffer = await QRCode.toBuffer(
      vcard,
      {
        ...buildQrCodeOptions({
          size: 512,
          errorCorrectionLevel: 'H',
          margin: QR_MARGIN_MODULES,
        }),
        type: 'png',
      },
    )

    const png = PNG.sync.read(pngBuffer)
    const decoded = jsQR(new Uint8ClampedArray(png.data.buffer), png.width, png.height, {
      inversionAttempts: 'dontInvert',
    })

    expect(decoded).not.toBeNull()
    expect(decoded?.data).toBe(vcard)
  })
})
