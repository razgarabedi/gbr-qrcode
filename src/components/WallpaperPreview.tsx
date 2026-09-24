import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ContactCard, LogoAsset } from '../types/contact'
import {
  applyThemeDefaults,
  createDefaultWallpaperSettings,
  getPresetById,
  WALLPAPER_PRESETS,
  type QrWallpaperPosition,
  type WallpaperBackgroundPresetId,
  type WallpaperPresetId,
  type WallpaperSettings,
  type WallpaperTheme,
} from '../types/wallpaper'
import { downloadDataUrl } from '../lib/download'
import {
  LOGO_ACCEPT_EXTENSIONS,
  loadLogoFromFile,
  loadLogoFromUrl,
  revokeLogoAsset,
} from '../lib/logo'
import { buildWallpaperFileName, renderWallpaper } from '../lib/wallpaper'
import {
  WALLPAPER_BACKGROUND_PRESETS,
  getWallpaperBackgroundPreset,
} from '../lib/wallpaperBackgrounds'
import { buildVCard } from '../lib/vcard'
import type { QrVisualStyle } from '../lib/qrShape'

type WallpaperPreviewProps = {
  contact: ContactCard
  logo: LogoAsset | null
  backgroundImage: LogoAsset | null
  onBackgroundImageChange: (next: LogoAsset | null) => void
  canGenerate: boolean
  settings: WallpaperSettings
  onSettingsChange: (next: WallpaperSettings) => void
  qrStyle: QrVisualStyle
}

function previewSettings(settings: WallpaperSettings): WallpaperSettings {
  const maxEdge = 720
  const scale = Math.min(1, maxEdge / Math.max(settings.width, settings.height))
  return {
    ...settings,
    width: Math.max(320, Math.round(settings.width * scale)),
    height: Math.max(320, Math.round(settings.height * scale)),
  }
}

export function WallpaperPreview({
  contact,
  logo,
  backgroundImage,
  onBackgroundImageChange,
  canGenerate,
  settings,
  onSettingsChange,
  qrStyle,
}: WallpaperPreviewProps) {
  const formId = useId()
  const bgInputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportStatus, setExportStatus] = useState<string | null>(null)
  const [bgBusy, setBgBusy] = useState(false)
  const [bgError, setBgError] = useState<string | null>(null)

  const vcardText = useMemo(
    () => (canGenerate ? buildVCard(contact) : ''),
    [canGenerate, contact],
  )

  const patch = (partial: Partial<WallpaperSettings>) => {
    onSettingsChange({ ...settings, ...partial })
  }

  useEffect(() => {
    let cancelled = false
    if (!canGenerate || !vcardText) {
      setPreviewUrl(null)
      setWarning(null)
      setError(null)
      return
    }

    void renderWallpaper(
      vcardText,
      contact,
      logo,
      previewSettings(settings),
      backgroundImage,
      qrStyle,
    )
      .then((result) => {
        if (cancelled) return
        setPreviewUrl(result.dataUrl)
        setWarning(result.warning)
        setError(null)
      })
      .catch(() => {
        if (cancelled) return
        setPreviewUrl(null)
        setError('Das Hintergrundbild konnte nicht erzeugt werden.')
      })

    return () => {
      cancelled = true
    }
  }, [canGenerate, vcardText, contact, logo, backgroundImage, settings, qrStyle])

  const handlePreset = (presetId: WallpaperPresetId) => {
    if (presetId === 'custom') {
      patch({ presetId })
      return
    }
    const preset = getPresetById(presetId)
    patch({
      presetId,
      width: preset.width,
      height: preset.height,
    })
  }

  const handleTheme = (theme: WallpaperTheme) => {
    onSettingsChange(applyThemeDefaults(settings, theme))
  }

  const handleBackgroundFile = async (file: File | undefined) => {
    if (!file) return
    setBgBusy(true)
    setBgError(null)
    try {
      const loaded = await loadLogoFromFile(file, 'cover')
      revokeLogoAsset(backgroundImage)
      onBackgroundImageChange(loaded)
      patch({ backgroundPresetId: 'custom', theme: 'dark' })
    } catch (err) {
      setBgError(
        err instanceof Error ? err.message : 'Das Hintergrundbild konnte nicht geladen werden.',
      )
    } finally {
      setBgBusy(false)
      if (bgInputRef.current) bgInputRef.current.value = ''
    }
  }

  const handleClearBackground = () => {
    setBgError(null)
    revokeLogoAsset(backgroundImage)
    onBackgroundImageChange(null)
    patch({ backgroundPresetId: 'none' })
  }

  const handleBackgroundPreset = async (id: WallpaperBackgroundPresetId) => {
    if (id === 'custom') return
    if (id === 'none') {
      handleClearBackground()
      return
    }
    const preset = getWallpaperBackgroundPreset(id)
    if (!preset) return
    setBgBusy(true)
    setBgError(null)
    try {
      const loaded = await loadLogoFromUrl(preset.url, preset.fileName, 'image/jpeg', 'cover')
      revokeLogoAsset(backgroundImage)
      onBackgroundImageChange(loaded)
      onSettingsChange({
        ...settings,
        backgroundPresetId: id,
        theme: 'dark',
        backgroundColor: '#1c2b4a',
        accentColor: '#b3202a',
      })
    } catch {
      setBgError('Das vordefinierte Hintergrundmotiv konnte nicht geladen werden.')
    } finally {
      setBgBusy(false)
    }
  }

  const handleExport = async () => {
    if (!canGenerate || !vcardText) return
    setExporting(true)
    setExportStatus(null)
    try {
      const result = await renderWallpaper(
        vcardText,
        contact,
        logo,
        settings,
        backgroundImage,
        qrStyle,
      )
      downloadDataUrl(result.dataUrl, buildWallpaperFileName(contact, settings))
      setWarning(result.warning)
      setExportStatus(
        result.readable
          ? 'Export abgeschlossen. QR-Code im Wallpaper wurde erfolgreich geprüft.'
          : 'Export abgeschlossen, aber die QR-Prüfung ist fehlgeschlagen.',
      )
    } catch {
      setExportStatus('Der Wallpaper-Export ist fehlgeschlagen.')
    } finally {
      setExporting(false)
    }
  }

  const isPhone =
    settings.height >= settings.width ||
    getPresetById(settings.presetId).kind === 'phone'

  return (
    <div className="wallpaper-panel">
      <div className="wallpaper-preview">
        {canGenerate && previewUrl ? (
          <img
            className={
              isPhone ? 'wallpaper-image wallpaper-image--phone' : 'wallpaper-image wallpaper-image--desktop'
            }
            src={previewUrl}
            alt="Vorschau des Hintergrundbilds"
          />
        ) : (
          <div
            className={
              isPhone
                ? 'wallpaper-stage wallpaper-stage--phone'
                : 'wallpaper-stage wallpaper-stage--desktop'
            }
            aria-hidden="true"
          >
            <div className="wallpaper-stage__content">
              <p className="wallpaper-stage__name">Vorschau erscheint hier</p>
            </div>
          </div>
        )}

        <p className="preview-caption">
          {!canGenerate
            ? 'Bitte zuerst gültige Kontaktdaten eingeben.'
            : error
              ? error
              : qrStyle === 'integrated'
                ? 'QR-Stil: Integriert (rot/navy). Entspricht der Auswahl in der QR-Vorschau.'
                : 'QR-Stil: Klassisch. Entspricht der Auswahl in der QR-Vorschau.'}
        </p>
        {warning ? (
          <p className="qr-warning" role="status">
            {warning}
          </p>
        ) : null}
      </div>

      <div className="wallpaper-settings">
        <label className="field" htmlFor={`${formId}-preset`}>
          <span>Format</span>
          <select
            id={`${formId}-preset`}
            value={settings.presetId}
            onChange={(event) => handlePreset(event.target.value as WallpaperPresetId)}
          >
            {WALLPAPER_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>

        {settings.presetId === 'custom' ? (
          <div className="form-grid form-grid--compact">
            <label className="field" htmlFor={`${formId}-width`}>
              <span>Breite (px)</span>
              <input
                id={`${formId}-width`}
                type="number"
                min={320}
                max={7680}
                value={settings.width}
                onChange={(event) => patch({ width: Number(event.target.value) || 320 })}
              />
            </label>
            <label className="field" htmlFor={`${formId}-height`}>
              <span>Höhe (px)</span>
              <input
                id={`${formId}-height`}
                type="number"
                min={320}
                max={7680}
                value={settings.height}
                onChange={(event) => patch({ height: Number(event.target.value) || 320 })}
              />
            </label>
          </div>
        ) : null}

        <div className="form-grid form-grid--compact">
          <label className="field" htmlFor={`${formId}-bg`}>
            <span>Hintergrundfarbe</span>
            <input
              id={`${formId}-bg`}
              type="color"
              value={settings.backgroundColor}
              onChange={(event) => patch({ backgroundColor: event.target.value })}
            />
          </label>
          <label className="field" htmlFor={`${formId}-accent`}>
            <span>Akzentfarbe</span>
            <input
              id={`${formId}-accent`}
              type="color"
              value={settings.accentColor}
              onChange={(event) => patch({ accentColor: event.target.value })}
            />
          </label>
        </div>

        <fieldset className="wallpaper-bg-presets">
          <legend>Hintergrundmotiv</legend>
          <p className="wallpaper-bg-upload__hint">
            Vier vordefinierte Motive oder eigenes Bild. Motiv ersetzt die reine Hintergrundfarbe.
          </p>
          <div className="wallpaper-bg-grid" role="radiogroup" aria-label="Hintergrundmotiv">
            <button
              type="button"
              role="radio"
              aria-checked={settings.backgroundPresetId === 'none'}
              className={
                settings.backgroundPresetId === 'none'
                  ? 'wallpaper-bg-thumb is-active'
                  : 'wallpaper-bg-thumb'
              }
              disabled={bgBusy}
              onClick={() => {
                void handleBackgroundPreset('none')
              }}
            >
              <span
                className="wallpaper-bg-thumb__swatch"
                style={{ background: settings.backgroundColor }}
              />
              <span className="wallpaper-bg-thumb__label">Nur Farbe</span>
            </button>
            {WALLPAPER_BACKGROUND_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                role="radio"
                aria-checked={settings.backgroundPresetId === preset.id}
                className={
                  settings.backgroundPresetId === preset.id
                    ? 'wallpaper-bg-thumb is-active'
                    : 'wallpaper-bg-thumb'
                }
                disabled={bgBusy}
                onClick={() => {
                  void handleBackgroundPreset(preset.id)
                }}
              >
                <img
                  className="wallpaper-bg-thumb__img"
                  src={preset.url}
                  alt=""
                  width={72}
                  height={128}
                />
                <span className="wallpaper-bg-thumb__label">{preset.label}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="wallpaper-bg-upload" role="group" aria-label="Eigenes Hintergrundbild">
          <p className="wallpaper-bg-upload__title">
            {settings.backgroundPresetId === 'custom' && backgroundImage
              ? `Eigenes Bild: ${backgroundImage.fileName}`
              : 'Oder eigenes Foto hochladen'}
          </p>
          <p className="wallpaper-bg-upload__hint">
            PNG, JPG, JPEG, WebP oder SVG, maximal 5 MB. Wird als Cover eingepasst.
          </p>
          <input
            ref={bgInputRef}
            id={`${formId}-bg-file`}
            type="file"
            accept={LOGO_ACCEPT_EXTENSIONS.join(',')}
            hidden
            onChange={(event) => {
              void handleBackgroundFile(event.target.files?.[0])
            }}
          />
          <div className="button-row">
            <button
              type="button"
              className="button button--secondary"
              disabled={bgBusy}
              onClick={() => bgInputRef.current?.click()}
            >
              {bgBusy ? 'Lade…' : 'Eigenes Bild wählen'}
            </button>
            <button
              type="button"
              className="button button--secondary"
              disabled={!backgroundImage || bgBusy}
              onClick={handleClearBackground}
            >
              Bild entfernen
            </button>
          </div>
          {bgError ? (
            <p className="field-error" role="alert">
              {bgError}
            </p>
          ) : null}
        </div>

        <fieldset className="logo-fit">
          <legend>Design</legend>
          <div className="segmented" role="group" aria-label="Helles oder dunkles Design">
            <button
              type="button"
              className={settings.theme === 'dark' ? 'segmented__btn is-active' : 'segmented__btn'}
              onClick={() => handleTheme('dark')}
            >
              Dunkel
            </button>
            <button
              type="button"
              className={settings.theme === 'light' ? 'segmented__btn is-active' : 'segmented__btn'}
              onClick={() => handleTheme('light')}
            >
              Hell
            </button>
          </div>
        </fieldset>

        <label className="field" htmlFor={`${formId}-pos`}>
          <span>QR-Code-Position</span>
          <select
            id={`${formId}-pos`}
            value={settings.qrPosition}
            onChange={(event) =>
              patch({ qrPosition: event.target.value as QrWallpaperPosition })
            }
          >
            <option value="upper">Weiter oben (Safe Area)</option>
            <option value="center">Zentriert</option>
            <option value="lower">Weiter unten (Safe Area)</option>
          </select>
        </label>

        <label className="field" htmlFor={`${formId}-qrsize`}>
          <span>QR-Code-Größe ({Math.round(settings.qrSizePercent * 100)} %)</span>
          <input
            id={`${formId}-qrsize`}
            type="range"
            min={22}
            max={48}
            value={Math.round(settings.qrSizePercent * 100)}
            onChange={(event) => patch({ qrSizePercent: Number(event.target.value) / 100 })}
          />
        </label>

        {settings.backgroundPresetId === 'none' ? (
          <label className="field" htmlFor={`${formId}-logo-opacity`}>
            <span>Logo-Deckkraft im Hintergrund ({Math.round(settings.logoOpacity * 100)} %)</span>
            <input
              id={`${formId}-logo-opacity`}
              type="range"
              min={0}
              max={40}
              value={Math.round(settings.logoOpacity * 100)}
              onChange={(event) => patch({ logoOpacity: Number(event.target.value) / 100 })}
            />
          </label>
        ) : null}

        <label className="check-field">
          <input
            type="checkbox"
            checked={settings.includeLogoInQr}
            disabled={qrStyle === 'integrated'}
            onChange={(event) => patch({ includeLogoInQr: event.target.checked })}
          />
          <span>
            Logo im QR-Code anzeigen
            {qrStyle === 'integrated' ? ' (nur im klassischen Modus)' : ''}
          </span>
        </label>

        <label className="check-field">
          <input
            type="checkbox"
            checked={settings.showText}
            onChange={(event) => patch({ showText: event.target.checked })}
          />
          <span>Text anzeigen (Name, Position, „Kontakt speichern“)</span>
        </label>

        <div className="button-row">
          <button
            type="button"
            className="button"
            disabled={!canGenerate || exporting}
            onClick={() => {
              void handleExport()
            }}
          >
            {exporting ? 'Exportiere…' : 'Hintergrundbild als PNG'}
          </button>
        </div>
        {exportStatus ? (
          <p className="placeholder-note" role="status">
            {exportStatus}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export { createDefaultWallpaperSettings }
