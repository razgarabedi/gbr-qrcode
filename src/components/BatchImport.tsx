import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ContactCard, LogoAsset } from '../types/contact'
import {
  buildBatchQrZip,
  buildBatchZipArchiveName,
  downloadBatchQrZip,
} from '../lib/batchExport'
import {
  importContactsFromFiles,
  isBatchContactExportable,
  summarizeImport,
  type ContactImportResult,
} from '../lib/contactImport'
import {
  isDeviceContactPickerAvailable,
  pickDeviceContacts,
} from '../lib/deviceContacts'
import {
  QR_EXPORT_SIZES,
  type QrExportSize,
} from '../lib/qr'
import {
  QR_VISUAL_STYLES,
  type QrVisualStyle,
  qrVisualStyleLabel,
} from '../lib/qrShape'

type BatchImportProps = {
  logo: LogoAsset | null
  qrStyle: QrVisualStyle
  onLoadContact: (contact: ContactCard) => void
}

export function BatchImport({ logo, qrStyle, onLoadContact }: BatchImportProps) {
  const inputId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importResult, setImportResult] = useState<ContactImportResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const [exportSize, setExportSize] = useState<QrExportSize>(1024)
  const [batchStyle, setBatchStyle] = useState<QrVisualStyle>(qrStyle)
  const [devicePickerAvailable, setDevicePickerAvailable] = useState(false)

  useEffect(() => {
    setBatchStyle(qrStyle)
  }, [qrStyle])

  useEffect(() => {
    setDevicePickerAvailable(isDeviceContactPickerAvailable())
  }, [])

  const summary = useMemo(
    () => (importResult ? summarizeImport(importResult) : null),
    [importResult],
  )

  const applyImportedContacts = (contacts: ContactCard[], fileCount: number) => {
    const result: ContactImportResult = {
      contacts,
      issues: [],
      fileCount,
      formatHints: ['device'],
    }
    setImportResult(result)
    const stats = summarizeImport(result)
    if (stats.total === 0) {
      setError('Es wurden keine nutzbaren Kontakte ausgewählt.')
      setStatus(null)
      return
    }
    if (contacts.length === 1) {
      onLoadContact(contacts[0])
      setStatus(
        '1 Kontakt geladen und ins Formular übernommen — bereit für QR- und Hintergrund-Export.',
      )
    } else {
      setStatus(
        `${stats.total} Kontakte vom Gerät geladen · ${stats.exportable} für QR-Export geeignet.`,
      )
    }
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setBusy(true)
    setError(null)
    setStatus(null)
    try {
      const result = await importContactsFromFiles(files)
      setImportResult(result)
      const stats = summarizeImport(result)
      if (stats.total === 0) {
        setError('Es wurden keine Kontakte erkannt. Bitte VCF oder Outlook-/Google-CSV prüfen.')
      } else if (result.contacts.length === 1) {
        onLoadContact(result.contacts[0])
        setStatus(
          '1 Kontakt geladen und ins Formular übernommen — bereit für QR- und Hintergrund-Export.',
        )
      } else {
        setStatus(
          `${stats.total} Kontakte aus ${result.fileCount} Datei${
            result.fileCount === 1 ? '' : 'en'
          } geladen · ${stats.exportable} für QR-Export geeignet.`,
        )
      }
    } catch {
      setImportResult(null)
      setError('Der Import ist fehlgeschlagen.')
    } finally {
      setBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDevicePick = async () => {
    setBusy(true)
    setError(null)
    setStatus(null)
    try {
      const result = await pickDeviceContacts({ multiple: true })
      if (!result.ok) {
        setError(result.message)
        return
      }
      if (result.cancelled) {
        setStatus(null)
        return
      }
      applyImportedContacts(result.contacts, 0)
    } finally {
      setBusy(false)
    }
  }

  const handleClear = () => {
    setImportResult(null)
    setError(null)
    setStatus(null)
    setProgress(null)
  }

  const handleZipExport = async () => {
    if (!importResult || !summary || summary.exportable === 0) return
    setExportBusy(true)
    setProgress(null)
    setError(null)
    try {
      const { blob, exported, skipped } = await buildBatchQrZip(importResult.contacts, {
        style: batchStyle,
        size: exportSize,
        logo,
        onProgress: ({ current, total, label }) => {
          setProgress(`Erzeuge QR ${current} / ${total}: ${label}`)
        },
      })
      downloadBatchQrZip(blob, buildBatchZipArchiveName(exportSize))
      setStatus(
        `ZIP mit ${exported} QR-Code${exported === 1 ? '' : 's'} heruntergeladen` +
          (skipped > 0 ? ` · ${skipped} übersprungen (unvollständig).` : '.'),
      )
      setProgress(null)
    } catch {
      setError('Der ZIP-Export ist fehlgeschlagen.')
      setProgress(null)
    } finally {
      setExportBusy(false)
    }
  }

  return (
    <div className="batch-import">
      <p className="batch-import__lead">
        Auf dem Handy Kontakte direkt aus dem Adressbuch wählen (wie bei WhatsApp/Telegram) oder
        VCF-/CSV-Dateien importieren. Anschließend QR-Codes als ZIP — Dateiname jeweils{' '}
        <code>Vorname_Nachname.png</code>.
      </p>

      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        accept=".vcf,.vcard,.csv,.txt,text/vcard,text/csv,text/x-vcard"
        multiple
        hidden
        onChange={(event) => {
          void handleFiles(event.target.files)
        }}
      />

      <div className="button-row">
        {devicePickerAvailable ? (
          <button
            type="button"
            className="button"
            disabled={busy || exportBusy}
            onClick={() => {
              void handleDevicePick()
            }}
          >
            {busy ? 'Öffne Kontakte…' : 'Vom Handy auswählen'}
          </button>
        ) : null}
        <button
          type="button"
          className={devicePickerAvailable ? 'button button--secondary' : 'button'}
          disabled={busy || exportBusy}
          onClick={() => fileInputRef.current?.click()}
        >
          {busy && !devicePickerAvailable ? 'Importiere…' : 'Datei importieren'}
        </button>
        <button
          type="button"
          className="button button--secondary"
          disabled={!importResult || busy || exportBusy}
          onClick={handleClear}
        >
          Liste leeren
        </button>
      </div>

      <p className="batch-import__hint">
        {devicePickerAvailable ? (
          <>
            <strong>Vom Handy auswählen</strong> öffnet den systemeigenen Kontakt-Picker (Chrome
            Android, HTTPS). Alternativ:{' '}
          </>
        ) : (
          <>
            Direktzugriff aufs Adressbuch ist hier nicht verfügbar (u. a. iPhone/Safari oder HTTP im
            WLAN). Nutzen Sie eine VCF aus der Kontakte-App oder{' '}
          </>
        )}
        <strong>VCF / vCard</strong>, <strong>Outlook-CSV</strong>, <strong>Google-Kontakte-CSV</strong>.
      </p>

      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      {status ? (
        <p className="placeholder-note" role="status">
          {status}
        </p>
      ) : null}
      {progress ? (
        <p className="placeholder-note" role="status">
          {progress}
        </p>
      ) : null}

      {importResult && summary && summary.total > 0 ? (
        <>
          <div className="batch-import__controls">
            <label className="field" htmlFor={`${inputId}-style`}>
              <span>QR-Stil für Batch</span>
              <select
                id={`${inputId}-style`}
                value={batchStyle}
                disabled={exportBusy}
                onChange={(event) => setBatchStyle(event.target.value as QrVisualStyle)}
              >
                {QR_VISUAL_STYLES.map((style) => (
                  <option key={style} value={style}>
                    {qrVisualStyleLabel(style)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field" htmlFor={`${inputId}-size`}>
              <span>Exportgröße</span>
              <select
                id={`${inputId}-size`}
                value={exportSize}
                disabled={exportBusy}
                onChange={(event) => setExportSize(Number(event.target.value) as QrExportSize)}
              >
                {QR_EXPORT_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size} × {size} Pixel
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="button-row">
            <button
              type="button"
              className="button"
              disabled={exportBusy || summary.exportable === 0}
              onClick={() => {
                void handleZipExport()
              }}
            >
              {exportBusy
                ? 'ZIP wird erzeugt…'
                : `QR-Codes als ZIP (${summary.exportable})`}
            </button>
          </div>

          {importResult.issues.length > 0 ? (
            <details className="batch-import__issues">
              <summary>
                {importResult.issues.length} Hinweis{importResult.issues.length === 1 ? '' : 'e'} beim
                Import
              </summary>
              <ul>
                {importResult.issues.map((issue, index) => (
                  <li key={`${issue.source}-${index}`}>
                    <strong>{issue.source}:</strong> {issue.message}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          <div className="batch-import__table-wrap">
            <table className="batch-import__table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Firma</th>
                  <th>Kontakt</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {importResult.contacts.map((contact, index) => {
                  const exportable = isBatchContactExportable(contact)
                  const contactLine =
                    contact.emailWork || contact.phoneMobile || contact.phoneWork || '—'
                  return (
                    <tr key={`${contact.firstName}-${contact.lastName}-${index}`}>
                      <td>
                        {contact.firstName} {contact.lastName}
                      </td>
                      <td>{contact.organization || '—'}</td>
                      <td>{contactLine}</td>
                      <td>
                        {exportable ? (
                          <span className="batch-import__ok">OK</span>
                        ) : (
                          <span className="batch-import__warn">Unvollständig</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="button button--secondary batch-import__load"
                          onClick={() => onLoadContact(contact)}
                        >
                          In Formular
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  )
}
