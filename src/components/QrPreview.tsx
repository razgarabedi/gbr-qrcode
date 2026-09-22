import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ContactCard, LogoAsset } from '../types/contact'
import { downloadDataUrl } from '../lib/download'
import {
  assessQrDensity,
  buildQrPngFileName,
  type QrExportSize,
  QR_EXPORT_SIZES,
} from '../lib/qr'
import {
  QR_VISUAL_STYLES,
  type QrVisualStyle,
  qrVisualStyleHint,
  qrVisualStyleLabel,
  renderQrVisual,
} from '../lib/qrShape'
import { buildVCard } from '../lib/vcard'

type QrPreviewProps = {
  contact: ContactCard
  logo: LogoAsset | null
  canGenerate: boolean
  style: QrVisualStyle
  onStyleChange: (style: QrVisualStyle) => void
}

type TestResult = {
  ok: boolean
  message: string
}

export function QrPreview({
  contact,
  logo,
  canGenerate,
  style,
  onStyleChange,
}: QrPreviewProps) {
  const titleId = useId()
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [composeWarning, setComposeWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exportSize, setExportSize] = useState<QrExportSize>(1024)
  const [testOpen, setTestOpen] = useState(false)
  const [testImageUrl, setTestImageUrl] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  const vcardText = useMemo(
    () => (canGenerate ? buildVCard(contact) : ''),
    [canGenerate, contact],
  )
  const density = useMemo(() => assessQrDensity(vcardText), [vcardText])
  const usesCenterLogo = style === 'classic'

  useEffect(() => {
    let cancelled = false

    if (!canGenerate || !vcardText) {
      setPreviewUrl(null)
      setComposeWarning(null)
      setError(null)
      return
    }

    void renderQrVisual(vcardText, {
      style,
      size: 320,
      logo: usesCenterLogo ? logo : null,
    })
      .then((result) => {
        if (cancelled) return
        setPreviewUrl(result.dataUrl)
        setComposeWarning(result.warning)
        setError(null)
      })
      .catch(() => {
        if (cancelled) return
        setPreviewUrl(null)
        setComposeWarning(null)
        setError('Der QR-Code konnte nicht erzeugt werden.')
      })

    return () => {
      cancelled = true
    }
  }, [canGenerate, vcardText, logo, style, usesCenterLogo])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (testOpen && !dialog.open) {
      dialog.showModal()
    } else if (!testOpen && dialog.open) {
      dialog.close()
    }
  }, [testOpen])

  const handleDownload = async () => {
    if (!canGenerate || !vcardText) return
    const result = await renderQrVisual(vcardText, {
      style,
      size: exportSize,
      logo: usesCenterLogo ? logo : null,
    })
    downloadDataUrl(result.dataUrl, buildQrPngFileName(contact, exportSize))
    setComposeWarning(result.warning)
  }

  const handleTest = async () => {
    if (!canGenerate || !vcardText) return
    setTestResult(null)
    try {
      const result = await renderQrVisual(vcardText, {
        style,
        size: 512,
        logo: usesCenterLogo ? logo : null,
      })
      setTestImageUrl(result.dataUrl)
      setComposeWarning(result.warning)
      setTestResult({
        ok: result.readable,
        message: result.readable
          ? 'Lokaler Selbsttest erfolgreich: Der decodierte Inhalt stimmt mit der vCard überein. Scannen Sie den Code zusätzlich mit einem anderen Smartphone.'
          : result.warning ??
            'Lokaler Selbsttest fehlgeschlagen: Der QR-Code konnte nicht zuverlässig gelesen werden.',
      })
      setTestOpen(true)
    } catch {
      setTestResult({
        ok: false,
        message: 'Der QR-Code-Test konnte nicht durchgeführt werden.',
      })
      setTestOpen(true)
    }
  }

  return (
    <div className="preview-frame preview-frame--qr">
      <div className="segmented" role="radiogroup" aria-label="QR-Darstellung">
        {QR_VISUAL_STYLES.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={style === option}
            className={style === option ? 'segmented__btn is-active' : 'segmented__btn'}
            onClick={() => onStyleChange(option)}
          >
            {qrVisualStyleLabel(option)}
          </button>
        ))}
      </div>

      {canGenerate && previewUrl ? (
        <img
          className={
            style === 'integrated' ? 'qr-image qr-image--integrated' : 'qr-image'
          }
          src={previewUrl}
          alt="QR-Code der digitalen Visitenkarte"
          width={320}
          height={320}
        />
      ) : (
        <div className="qr-placeholder" aria-hidden="true">
          <span className="qr-placeholder__grid" />
        </div>
      )}

      <p className="preview-caption">
        {!canGenerate
          ? 'Bitte zuerst gültige Kontaktdaten eingeben, damit ein QR-Code erzeugt werden kann.'
          : error
            ? error
            : qrVisualStyleHint(style)}
      </p>

      {density.warning ? (
        <p className="qr-warning" role="status">
          {density.warning}
        </p>
      ) : null}
      {composeWarning ? (
        <p className="qr-warning" role="status">
          {composeWarning}
        </p>
      ) : null}

      <div className="qr-controls">
        <label className="qr-size-field" htmlFor={`${titleId}-size`}>
          <span>Exportgröße</span>
          <select
            id={`${titleId}-size`}
            value={exportSize}
            disabled={!canGenerate}
            onChange={(event) => setExportSize(Number(event.target.value) as QrExportSize)}
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
            disabled={!canGenerate}
            onClick={() => {
              void handleDownload()
            }}
          >
            QR-Code als PNG
          </button>
          <button
            type="button"
            className="button button--secondary"
            disabled={!canGenerate}
            onClick={() => {
              void handleTest()
            }}
          >
            QR-Code testen
          </button>
        </div>
      </div>

      <dialog
        className="qr-test-dialog"
        ref={dialogRef}
        onClose={() => setTestOpen(false)}
        aria-labelledby={`${titleId}-dialog`}
      >
        <div className="qr-test-dialog__inner">
          <h3 id={`${titleId}-dialog`}>QR-Code testen</h3>
          <p>
            Scannen Sie den Code mit einem anderen Smartphone. Der Inhalt bleibt lokal in diesem
            Browser.
          </p>
          {testImageUrl ? (
            <img
              className={
                style === 'integrated'
                  ? 'qr-test-dialog__image qr-image--integrated'
                  : 'qr-test-dialog__image'
              }
              src={testImageUrl}
              alt="Großer QR-Code zum Test-Scan"
              width={512}
              height={512}
            />
          ) : null}
          {testResult ? (
            <p
              className={
                testResult.ok ? 'qr-test-dialog__result is-ok' : 'qr-test-dialog__result is-error'
              }
              role="status"
            >
              {testResult.message}
            </p>
          ) : null}
          <button type="button" className="button button--secondary" onClick={() => setTestOpen(false)}>
            Schließen
          </button>
        </div>
      </dialog>
    </div>
  )
}
