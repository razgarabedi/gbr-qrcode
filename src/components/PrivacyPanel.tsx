import { useId } from 'react'
import {
  EXPORT_ACK_LABEL,
  NEVER_INCLUDED_ITEMS,
  PRIVACY_CHECKLIST,
  QR_FIELD_OPTIONS,
  applyPrivacyMode,
  type FieldIncludeMap,
  type PrivacyMode,
  type PrivacySettings,
  type QrIncludeField,
} from '../lib/privacy'

type PrivacyPanelProps = {
  privacy: PrivacySettings
  onChange: (next: PrivacySettings) => void
  exportAcknowledged: boolean
  onExportAcknowledgedChange: (value: boolean) => void
}

export function PrivacyPanel({
  privacy,
  onChange,
  exportAcknowledged,
  onExportAcknowledgedChange,
}: PrivacyPanelProps) {
  const formId = useId()

  const setMode = (mode: PrivacyMode) => {
    onChange(applyPrivacyMode(mode))
    onExportAcknowledgedChange(false)
  }

  const toggleField = (key: QrIncludeField, checked: boolean) => {
    const option = QR_FIELD_OPTIONS.find((item) => item.key === key)
    if (option?.required) return

    if (privacy.mode === 'minimal' && option && !option.inMinimal) {
      return
    }

    const include: FieldIncludeMap = { ...privacy.include, [key]: checked }
    onChange({
      mode: privacy.mode === 'minimal' ? 'business' : privacy.mode,
      include,
    })
    onExportAcknowledgedChange(false)
  }

  return (
    <div className="privacy-panel">
      <div className="privacy-banner" role="note">
        <p className="privacy-banner__title">Wichtig vor dem Export</p>
        <p>
          Der Sperrbildschirm kann von anderen Personen gesehen und fotografiert werden. Alle Daten
          im QR-Code sind öffentlich sichtbar beziehungsweise auslesbar. Exportieren Sie nur
          Informationen, die Sie bewusst freigeben möchten.
        </p>
      </div>

      <div className="privacy-mode">
        <p className="privacy-mode__label" id={`${formId}-mode-label`}>
          Datenumfang
        </p>
        <div
          className="segmented"
          role="group"
          aria-labelledby={`${formId}-mode-label`}
        >
          <button
            type="button"
            className={privacy.mode === 'business' ? 'segmented__btn is-active' : 'segmented__btn'}
            onClick={() => setMode('business')}
          >
            Geschäftlich (Standard)
          </button>
          <button
            type="button"
            className={privacy.mode === 'minimal' ? 'segmented__btn is-active' : 'segmented__btn'}
            onClick={() => setMode('minimal')}
          >
            Datensparsam
          </button>
        </div>
        <p className="privacy-mode__hint">
          {privacy.mode === 'minimal'
            ? 'Datensparsam: nur Vorname, Nachname, Firma, Position, geschäftliche Telefonnummern, geschäftliche E-Mail und Firmenwebseite.'
            : 'Standard: geschäftliche Kontaktdaten. Adresse und Abteilung sind abgewählt und können bei Bedarf ergänzt werden.'}
        </p>
      </div>

      <fieldset className="privacy-fields">
        <legend>Felder für den QR-Code</legend>
        <div className="privacy-fields__grid">
          {QR_FIELD_OPTIONS.map((option) => {
            const disabled =
              option.required || (privacy.mode === 'minimal' && !option.inMinimal)
            return (
              <label
                key={option.key}
                className={disabled ? 'check-field check-field--disabled' : 'check-field'}
              >
                <input
                  type="checkbox"
                  checked={privacy.include[option.key]}
                  disabled={disabled}
                  onChange={(event) => toggleField(option.key, event.target.checked)}
                />
                <span>
                  {option.label}
                  {option.required ? ' (immer)' : null}
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      <div className="privacy-checklist">
        <h3 className="privacy-checklist__title">Datenschutz-Checkliste</h3>
        <ul>
          {PRIVACY_CHECKLIST.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <h4 className="privacy-checklist__subtitle">Wird niemals übernommen</h4>
        <ul>
          {NEVER_INCLUDED_ITEMS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <label className="check-field privacy-ack">
        <input
          type="checkbox"
          checked={exportAcknowledged}
          onChange={(event) => onExportAcknowledgedChange(event.target.checked)}
        />
        <span>{EXPORT_ACK_LABEL}</span>
      </label>
      <p className="privacy-ack__hint">
        Diese Bestätigung gilt nur für den aktuellen Export und wird nicht dauerhaft gespeichert.
      </p>
    </div>
  )
}
