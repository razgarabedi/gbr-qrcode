import { useId, useRef, useState } from 'react'
import type { LogoAsset, LogoFitMode } from '../types/contact'
import {
  LOGO_ACCEPT_EXTENSIONS,
  loadLogoFromFile,
  loadLogoFromUrl,
  revokeLogoAsset,
} from '../lib/logo'
import sampleLogoUrl from '../assets/logo-geb-becker.png'

type LogoUploadProps = {
  logo: LogoAsset | null
  onChange: (logo: LogoAsset | null) => void
}

export function LogoUpload({ logo, onChange }: LogoUploadProps) {
  const inputId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const replaceLogo = async (next: LogoAsset | null) => {
    revokeLogoAsset(logo)
    onChange(next)
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const loaded = await loadLogoFromFile(file, logo?.fitMode ?? 'contain')
      await replaceLogo(loaded)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Das Logo konnte nicht geladen werden.')
    } finally {
      setBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleFitMode = (fitMode: LogoFitMode) => {
    if (!logo) return
    onChange({ ...logo, fitMode })
  }

  const handleClear = () => {
    setError(null)
    void replaceLogo(null)
  }

  const handleLoadSample = async () => {
    setBusy(true)
    setError(null)
    try {
      const loaded = await loadLogoFromUrl(
        sampleLogoUrl,
        'logo-geb-becker.png',
        'image/png',
        logo?.fitMode ?? 'contain',
      )
      await replaceLogo(loaded)
    } catch {
      setError('Das Beispiel-Logo konnte nicht geladen werden.')
    } finally {
      setBusy(false)
    }
  }

  const accept = LOGO_ACCEPT_EXTENSIONS.join(',')

  return (
    <div className="logo-upload">
      <div className="logo-dropzone" role="group" aria-label="Logo-Upload">
        <p className="logo-dropzone__title">
          {logo ? `Ausgewählt: ${logo.fileName}` : 'Noch kein Logo ausgewählt'}
        </p>
        <p className="logo-dropzone__hint">
          PNG, JPG, JPEG, WebP oder SVG, maximal 5 MB. Das Logo wird nur lokal verarbeitet und nicht
          hochgeladen. SVG wird sicher gerastert und nicht als HTML eingefügt.
        </p>

        <input
          ref={fileInputRef}
          id={inputId}
          className="visually-hidden"
          type="file"
          accept={accept}
          onChange={(event) => {
            void handleFile(event.target.files?.[0])
          }}
        />

        <div className="button-row">
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            {logo ? 'Logo ersetzen' : 'Logo auswählen'}
          </button>
          <button
            type="button"
            className="button button--secondary"
            disabled={busy}
            onClick={() => {
              void handleLoadSample()
            }}
          >
            Firmenlogo laden
          </button>
          <button
            type="button"
            className="button button--ghost"
            disabled={!logo || busy}
            onClick={handleClear}
          >
            Entfernen
          </button>
        </div>

        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      {logo ? (
        <div className="logo-preview-panel">
          <div className="logo-preview">
            <img
              src={logo.objectUrl}
              alt={`Vorschau: ${logo.fileName}`}
              className="logo-preview__image"
            />
          </div>

          <fieldset className="logo-fit">
            <legend>Darstellung im QR-Code</legend>
            <p className="logo-fit__hint">Das Seitenverhältnis bleibt erhalten.</p>
            <div className="segmented" role="radiogroup" aria-label="Logo-Einpassung">
              <button
                type="button"
                className={logo.fitMode === 'contain' ? 'segmented__btn is-active' : 'segmented__btn'}
                aria-pressed={logo.fitMode === 'contain'}
                onClick={() => handleFitMode('contain')}
              >
                Einpassen
              </button>
              <button
                type="button"
                className={logo.fitMode === 'cover' ? 'segmented__btn is-active' : 'segmented__btn'}
                aria-pressed={logo.fitMode === 'cover'}
                onClick={() => handleFitMode('cover')}
              >
                Zuschneiden
              </button>
            </div>
          </fieldset>
        </div>
      ) : null}
    </div>
  )
}
