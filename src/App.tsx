import { useEffect, useRef, useState } from 'react'
import { BatchImport } from './components/BatchImport'
import { ContactForm } from './components/ContactForm'
import { ExportActions } from './components/ExportActions'
import { LogoUpload } from './components/LogoUpload'
import { QrPreview } from './components/QrPreview'
import { Section } from './components/Section'
import {
  createDefaultWallpaperSettings,
  WallpaperPreview,
} from './components/WallpaperPreview'
import { revokeLogoAsset } from './lib/logo'
import type { QrVisualStyle } from './lib/qrShape'
import { consumeSharedContactImport } from './lib/shareTarget'
import { isContactValid } from './lib/validate'
import {
  emptyContactCard,
  type ContactCard,
  type LogoAsset,
} from './types/contact'
import type { WallpaperSettings } from './types/wallpaper'

export default function App() {
  const [contact, setContact] = useState<ContactCard>(() => emptyContactCard())
  const [logo, setLogo] = useState<LogoAsset | null>(null)
  const [wallpaperBackground, setWallpaperBackground] = useState<LogoAsset | null>(null)
  const [qrStyle, setQrStyle] = useState<QrVisualStyle>('classic')
  const [wallpaperSettings, setWallpaperSettings] = useState<WallpaperSettings>(() =>
    createDefaultWallpaperSettings(),
  )
  const [sharedImportNotice, setSharedImportNotice] = useState<string | null>(null)
  const logoRef = useRef<LogoAsset | null>(null)
  const wallpaperBgRef = useRef<LogoAsset | null>(null)
  logoRef.current = logo
  wallpaperBgRef.current = wallpaperBackground

  const canExport = isContactValid(contact)

  useEffect(() => {
    return () => {
      revokeLogoAsset(logoRef.current)
      revokeLogoAsset(wallpaperBgRef.current)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const result = await consumeSharedContactImport()
      if (cancelled || !result || result.contacts.length === 0) return
      setContact(result.contacts[0])
      setSharedImportNotice(
        result.contacts.length === 1
          ? 'Geteilte Visitenkarte (z. B. aus WhatsApp) übernommen.'
          : `Geteilte Datei: erste von ${result.contacts.length} Visitenkarten übernommen.`,
      )
      document.getElementById('kontaktdaten')?.scrollIntoView({ behavior: 'smooth' })
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="app">
      <a className="skip-link" href="#inhalt">
        Zum Inhalt springen
      </a>

      <header className="hero">
        <div className="hero__inner">
          <p className="hero__eyebrow">Lokal · Datenschutzfreundlich · Ohne Cloud</p>
          <h1 className="hero__title">Digital Business Card QR Generator</h1>
          <p className="hero__lead">
            Erstellen Sie aus geschäftlichen Kontaktdaten einen QR-Code mit vCard und ein
            professionelles Hintergrundbild für Smartphone oder Desktop. Alle Eingaben bleiben
            ausschließlich in Ihrem Browser — es gibt kein Backend und keine Datenübertragung.
          </p>
        </div>
      </header>

      <main className="main" id="inhalt">
        <Section
          id="kontaktdaten"
          title="Kontaktdaten"
          description="Formular ausfüllen, eigene Visitenkarte (VCF) laden oder einen anderen Kontakt vom Handy wählen."
        >
          <ContactForm
            contact={contact}
            onChange={setContact}
            sharedImportNotice={sharedImportNotice}
          />
        </Section>

        <Section
          id="stapelimport"
          title="Stapelimport & Batch-QR"
          description="Eigene VCF/CSV laden oder andere Kontakte vom Handy wählen und QR-Codes als ZIP (Vorname_Nachname.png) exportieren."
        >
          <BatchImport
            logo={logo}
            qrStyle={qrStyle}
            onLoadContact={setContact}
          />
        </Section>

        <Section
          id="logo"
          title="Logo"
          description="Optional: Firmenlogo für die Mitte des QR-Codes und dezent im Hintergrundbild."
        >
          <LogoUpload logo={logo} onChange={setLogo} />
        </Section>

        <div className="split">
          <Section
            id="qr-vorschau"
            title="QR-Code-Vorschau"
            description="Lokal erzeugter QR-Code aus der vCard. Klassisch oder integriert (rot/navy)."
          >
            <QrPreview
              contact={contact}
              logo={logo}
              canGenerate={canExport}
              style={qrStyle}
              onStyleChange={setQrStyle}
            />
          </Section>

          <Section
            id="hintergrundbild"
            title="Hintergrundbild-Vorschau"
            description="Sperrbildschirm- und Desktop-Hintergründe. Optional eigenes Foto. Der QR folgt dem gewählten Stil (Klassisch oder Integriert)."
          >
            <WallpaperPreview
              contact={contact}
              logo={logo}
              backgroundImage={wallpaperBackground}
              onBackgroundImageChange={setWallpaperBackground}
              canGenerate={canExport}
              settings={wallpaperSettings}
              onSettingsChange={setWallpaperSettings}
              qrStyle={qrStyle}
            />
          </Section>
        </div>

        <Section
          id="export"
          title="Export"
          description="PNG und VCF werden lokal heruntergeladen — ohne Server und ohne Cloud."
        >
          <ExportActions
            canExport={canExport}
            contact={contact}
            logo={logo}
            backgroundImage={wallpaperBackground}
            qrStyle={qrStyle}
            wallpaperSettings={wallpaperSettings}
          />
        </Section>
      </main>

      <footer className="footer">
        <p>
          Local First: Kontaktdaten und Logo verlassen Ihren Browser nicht. Keine Tracking-,
          Analyse- oder Werbedienste.
        </p>
      </footer>
    </div>
  )
}
