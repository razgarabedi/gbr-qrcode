import { useId, useMemo, useState } from 'react'
import type { ContactCard, LogoAsset } from '../types/contact'
import type { WallpaperSettings } from '../types/wallpaper'
import { downloadDataUrl, downloadVcfFile } from '../lib/download'
import {
  assessQrDensity,
  buildQrPngFileName,
  type QrExportSize,
  QR_EXPORT_SIZES,
} from '../lib/qr'
import { type QrVisualStyle, renderQrVisual } from '../lib/qrShape'
import { buildVCard, buildVcfFileName } from '../lib/vcard'
import { buildWallpaperFileName, renderWallpaper } from '../lib/wallpaper'

type ExportActionsProps = {
  canExport: boolean
  contact: ContactCard
  logo: LogoAsset | null
  backgroundImage: LogoAsset | null
  qrStyle: QrVisualStyle
  wallpaperSettings: WallpaperSettings
}

export function ExportActions({
  canExport,
  contact,
  logo,
  backgroundImage,
  qrStyle,
  wallpaperSettings,
}: ExportActionsProps) {
  const diagnosticsId = useId()
  const [qrSize, setQrSize] = useState<QrExportSize>(1024)
  const [exportError, setExportError] = useState<string | null>(null)
  const [logoWarning, setLogoWarning] = useState<string | null>(null)
  const [wallpaperStatus, setWallpaperStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const vcardText = useMemo(() => (canExport ? buildVCard(contact) : ''), [canExport, contact])
  const fileName = useMemo(
    () => (canExport ? buildVcfFileName(contact) : 'kontakt.vcf'),
    [canExport, contact],
  )
  const density = useMemo(() => assessQrDensity(vcardText), [vcardText])

  const handleVcfDownload = () => {
    if (!canExport || !vcardText) return
    downloadVcfFile(vcardText, fileName)
  }

  const handleQrDownload = async () => {
    if (!canExport || !vcardText) return
    try {
      setExportError(null)
      const result = await renderQrVisual(vcardText, {
        style: qrStyle,
        size: qrSize,
        logo: qrStyle === 'classic' ? logo : null,
      })
      downloadDataUrl(result.dataUrl, buildQrPngFileName(contact, qrSize))
      setLogoWarning(result.warning)
    } catch {
      setExportError('Der QR-Code-Export ist fehlgeschlagen.')
    }
  }

  const handleWallpaperDownload = async () => {
    if (!canExport || !vcardText) return
    setBusy(true)
    setWallpaperStatus(null)
    try {
      const result = await renderWallpaper(
        vcardText,
        contact,
        logo,
        wallpaperSettings,
        backgroundImage,
        qrStyle,
      )
      downloadDataUrl(result.dataUrl, buildWallpaperFileName(contact, wallpaperSettings))
      setLogoWarning(result.warning)
      setWallpaperStatus(
        result.readable
          ? 'Wallpaper exportiert. QR-Code im Bild wurde erfolgreich decodiert.'
          : 'Wallpaper exportiert, aber die QR-Prüfung im Bild ist fehlgeschlagen.',
      )
    } catch {
      setExportError('Der Wallpaper-Export ist fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="export-panel">
      <p className="export-panel__text">
        Exporte entstehen ausschließlich lokal als Datei-Download. Es findet keine Übertragung an
        Server statt.
      </p>

      <label className="qr-size-field" htmlFor={`${diagnosticsId}-export-size`}>
        <span>QR-Code-Exportgröße</span>
        <select
          id={`${diagnosticsId}-export-size`}
          value={qrSize}
          disabled={!canExport}
          onChange={(event) => setQrSize(Number(event.target.value) as QrExportSize)}
        >
          {QR_EXPORT_SIZES.map((size) => (
            <option key={size} value={size}>
              {size} × {size} Pixel
            </option>
          ))}
        </select>
      </label>

      <div className="button-row">
        <button
          type="button"
          className="button"
          disabled={!canExport}
          onClick={() => {
            void handleQrDownload()
          }}
        >
          QR-Code als PNG
        </button>
        <button
          type="button"
          className="button"
          disabled={!canExport || busy}
          onClick={() => {
            void handleWallpaperDownload()
          }}
        >
          {busy ? 'Wallpaper…' : 'Hintergrundbild als PNG'}
        </button>
        <button
          type="button"
          className="button button--secondary"
          disabled={!canExport}
          onClick={handleVcfDownload}
        >
          Kontaktkarte als VCF
        </button>
      </div>

      {!canExport ? (
        <p className="placeholder-note">
          Zum Aktivieren: Vor- oder Nachname und mindestens eine gültige
          Kontaktmöglichkeit (E-Mail, Mobil oder Festnetz).
        </p>
      ) : (
        <p className="placeholder-note">
          VCF: <code>{fileName}</code> · QR-PNG:{' '}
          <code>{buildQrPngFileName(contact, qrSize)}</code> · Wallpaper:{' '}
          <code>{buildWallpaperFileName(contact, wallpaperSettings)}</code>
        </p>
      )}

      {density.warning ? (
        <p className="qr-warning" role="status">
          {density.warning}
        </p>
      ) : null}
      {logoWarning ? (
        <p className="qr-warning" role="status">
          {logoWarning}
        </p>
      ) : null}
      {wallpaperStatus ? (
        <p className="placeholder-note" role="status">
          {wallpaperStatus}
        </p>
      ) : null}
      {exportError ? (
        <p className="field-error" role="alert">
          {exportError}
        </p>
      ) : null}

      {canExport ? (
        <details className="vcard-diagnostics">
          <summary id={diagnosticsId}>vCard-Diagnose anzeigen</summary>
          <p className="vcard-diagnostics__hint">
            Rohtext der erzeugten vCard (nur lokal, zum Prüfen von Umlauten und Feldern).
          </p>
          <pre className="vcard-diagnostics__pre" aria-labelledby={diagnosticsId} tabIndex={0}>
            {vcardText}
          </pre>
        </details>
      ) : null}
    </div>
  )
}
