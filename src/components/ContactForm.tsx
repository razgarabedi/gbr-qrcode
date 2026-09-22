import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { ContactCard } from '../types/contact'
import { importContactsFromFiles } from '../lib/contactImport'
import {
  isDeviceContactPickerAvailable,
  pickDeviceContacts,
} from '../lib/deviceContacts'
import {
  normalizeWebsite,
  validateContact,
  type ContactField,
} from '../lib/validate'
import { ContactCardPreview } from './ContactCardPreview'

type ContactFormProps = {
  contact: ContactCard
  onChange: (next: ContactCard) => void
  sharedImportNotice?: string | null
}

const FIELD_ORDER: ContactField[] = [
  'firstName',
  'lastName',
  'title',
  'organization',
  'department',
  'phoneMobile',
  'phoneWork',
  'emailWork',
  'website',
  'street',
  'postalCode',
  'city',
  'country',
]

export function ContactForm({ contact, onChange, sharedImportNotice }: ContactFormProps) {
  const formId = useId()
  const vcfInputRef = useRef<HTMLInputElement>(null)
  const [touched, setTouched] = useState<Partial<Record<ContactField | 'contactMethod', boolean>>>(
    {},
  )
  const [showAllErrors, setShowAllErrors] = useState(false)
  const [devicePickerAvailable, setDevicePickerAvailable] = useState(false)
  const [importBusy, setImportBusy] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importStatus, setImportStatus] = useState<string | null>(null)

  useEffect(() => {
    setDevicePickerAvailable(isDeviceContactPickerAvailable())
  }, [])

  useEffect(() => {
    if (sharedImportNotice) setImportStatus(sharedImportNotice)
  }, [sharedImportNotice])

  const errors = validateContact(contact)

  const update = <K extends ContactField>(key: K, value: ContactCard[K]) => {
    onChange({ ...contact, [key]: value })
  }

  const markTouched = (key: ContactField | 'contactMethod') => {
    setTouched((prev) => ({ ...prev, [key]: true }))
  }

  const visibleError = (key: ContactField | 'contactMethod'): string | undefined => {
    if (!(showAllErrors || touched[key])) return undefined
    return errors[key]
  }

  const handleBlurWebsite = () => {
    markTouched('website')
    const normalized = normalizeWebsite(contact.website)
    if (normalized !== contact.website) {
      onChange({ ...contact, website: normalized })
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setShowAllErrors(true)
    setTouched((prev) => {
      const next = { ...prev, contactMethod: true }
      for (const field of FIELD_ORDER) next[field] = true
      return next
    })
  }

  const applyLoadedContact = (next: ContactCard, status: string) => {
    onChange(next)
    setShowAllErrors(false)
    setTouched({})
    setImportError(null)
    setImportStatus(status)
  }

  const handleDevicePick = async () => {
    setImportBusy(true)
    setImportError(null)
    setImportStatus(null)
    try {
      const result = await pickDeviceContacts({ multiple: false })
      if (!result.ok) {
        setImportError(result.message)
        return
      }
      if (result.cancelled || result.contacts.length === 0) return
      applyLoadedContact(
        result.contacts[0],
        'Kontakt aus dem Adressbuch übernommen. Tipp: Die eigene Visitenkarte fehlt oft im Picker — dann VCF laden.',
      )
    } finally {
      setImportBusy(false)
    }
  }

  const handleVcfFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setImportBusy(true)
    setImportError(null)
    setImportStatus(null)
    try {
      const result = await importContactsFromFiles(files)
      if (result.contacts.length === 0) {
        setImportError(
          'Keine Visitenkarte erkannt. Bitte eine .vcf-Datei wählen (eigene Karte aus Kontakte/WhatsApp).',
        )
        return
      }
      applyLoadedContact(
        result.contacts[0],
        result.contacts.length === 1
          ? 'Eigene Visitenkarte (VCF) ins Formular geladen.'
          : `Erste von ${result.contacts.length} Visitenkarten geladen — weitere im Stapelimport.`,
      )
    } catch {
      setImportError('Die Visitenkarte konnte nicht geladen werden.')
    } finally {
      setImportBusy(false)
      if (vcfInputRef.current) vcfInputRef.current.value = ''
    }
  }

  const contactMethodError = visibleError('contactMethod')
  const contactMethodErrorId = `${formId}-contact-method-error`

  return (
    <div className="contact-form-block">
      <form className="contact-form" noValidate onSubmit={handleSubmit}>
        <p className="form-intro">
          Mindestens Vor- oder Nachname sowie eine Kontaktmöglichkeit (E-Mail, geschäftliche
          Mobilnummer oder Festnetz) sind erforderlich. Die Firma ist optional. Die Daten bleiben
          nur in diesem Browserfenster — es findet keine Speicherung und keine Übertragung statt.
        </p>

        <input
          ref={vcfInputRef}
          id={`${formId}-vcf`}
          type="file"
          accept=".vcf,.vcard,text/vcard,text/x-vcard"
          hidden
          onChange={(event) => {
            void handleVcfFiles(event.target.files)
          }}
        />

        <div className="button-row contact-form__device-pick">
          <button
            type="button"
            className="button"
            disabled={importBusy}
            onClick={() => vcfInputRef.current?.click()}
          >
            {importBusy ? 'Lade…' : 'Eigene Visitenkarte (VCF)'}
          </button>
          {devicePickerAvailable ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={importBusy}
              onClick={() => {
                void handleDevicePick()
              }}
            >
              {importBusy ? 'Öffne Kontakte…' : 'Anderen Kontakt wählen'}
            </button>
          ) : null}
        </div>
        <p className="contact-form__import-hint">
          Die eigene Visitenkarte erscheint im Handy-Picker oft nicht (anders als in WhatsApp). Laden
          Sie eine <strong>.vcf</strong> aus der Kontakte-App oder teilen Sie einen Kontakt aus
          WhatsApp an diese App (nach Installation auf dem Homescreen).
        </p>
        {importError ? (
          <p className="field-error" role="alert">
            {importError}
          </p>
        ) : null}
        {importStatus ? (
          <p className="placeholder-note" role="status">
            {importStatus}
          </p>
        ) : null}

        <div className="form-grid">
          <Field
            id={`${formId}-firstName`}
            label="Vorname"
            required
            autoComplete="given-name"
            value={contact.firstName}
            error={visibleError('firstName')}
            onChange={(value) => update('firstName', value)}
            onBlur={() => markTouched('firstName')}
            placeholder="Max"
          />
          <Field
            id={`${formId}-lastName`}
            label="Nachname"
            required
            autoComplete="family-name"
            value={contact.lastName}
            error={visibleError('lastName')}
            onChange={(value) => update('lastName', value)}
            onBlur={() => markTouched('lastName')}
            placeholder="Mustermann"
          />
          <Field
            id={`${formId}-title`}
            label="Jobtitel"
            autoComplete="organization-title"
            value={contact.title}
            error={visibleError('title')}
            onChange={(value) => update('title', value)}
            onBlur={() => markTouched('title')}
            placeholder="Projektleitung"
          />
          <Field
            id={`${formId}-organization`}
            label="Firma"
            autoComplete="organization"
            value={contact.organization}
            error={visibleError('organization')}
            onChange={(value) => update('organization', value)}
            onBlur={() => markTouched('organization')}
            placeholder="Musterfirma GmbH"
          />
          <Field
            id={`${formId}-department`}
            label="Abteilung"
            autoComplete="organization"
            value={contact.department}
            error={visibleError('department')}
            onChange={(value) => update('department', value)}
            onBlur={() => markTouched('department')}
            placeholder="Vertrieb"
            className="field--wide"
          />
          <Field
            id={`${formId}-phoneMobile`}
            label="Geschäftliche Mobilnummer"
            type="tel"
            autoComplete="tel-national"
            inputMode="tel"
            value={contact.phoneMobile}
            error={visibleError('phoneMobile')}
            onChange={(value) => update('phoneMobile', value)}
            onBlur={() => {
              markTouched('phoneMobile')
              markTouched('contactMethod')
            }}
            placeholder="+49 170 1234567"
            describedBy={contactMethodError ? contactMethodErrorId : undefined}
          />
          <Field
            id={`${formId}-phoneWork`}
            label="Geschäftliche Festnetznummer"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            value={contact.phoneWork}
            error={visibleError('phoneWork')}
            onChange={(value) => update('phoneWork', value)}
            onBlur={() => {
              markTouched('phoneWork')
              markTouched('contactMethod')
            }}
            placeholder="+49 123 456789-0"
            describedBy={contactMethodError ? contactMethodErrorId : undefined}
          />
          <Field
            id={`${formId}-emailWork`}
            label="Geschäftliche E-Mail-Adresse"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={contact.emailWork}
            error={visibleError('emailWork')}
            onChange={(value) => update('emailWork', value)}
            onBlur={() => {
              markTouched('emailWork')
              markTouched('contactMethod')
            }}
            placeholder="max.mustermann@firma.de"
            className="field--wide"
            describedBy={contactMethodError ? contactMethodErrorId : undefined}
          />
          {contactMethodError ? (
            <p className="field-error field--wide" id={contactMethodErrorId} role="alert">
              {contactMethodError}
            </p>
          ) : null}
          <Field
            id={`${formId}-website`}
            label="Firmenwebseite"
            autoComplete="url"
            inputMode="url"
            value={contact.website}
            error={visibleError('website')}
            onChange={(value) => update('website', value)}
            onBlur={handleBlurWebsite}
            placeholder="www.firma.de"
            className="field--wide"
            hint="Ohne Protokoll wird automatisch https:// ergänzt."
          />
          <Field
            id={`${formId}-street`}
            label="Straße und Hausnummer"
            autoComplete="street-address"
            value={contact.street}
            error={visibleError('street')}
            onChange={(value) => update('street', value)}
            onBlur={() => markTouched('street')}
            placeholder="Musterstraße 1"
            className="field--wide"
          />
          <Field
            id={`${formId}-postalCode`}
            label="Postleitzahl"
            autoComplete="postal-code"
            value={contact.postalCode}
            error={visibleError('postalCode')}
            onChange={(value) => update('postalCode', value)}
            onBlur={() => markTouched('postalCode')}
            placeholder="12345"
          />
          <Field
            id={`${formId}-city`}
            label="Ort"
            autoComplete="address-level2"
            value={contact.city}
            error={visibleError('city')}
            onChange={(value) => update('city', value)}
            onBlur={() => markTouched('city')}
            placeholder="Musterstadt"
          />
          <Field
            id={`${formId}-country`}
            label="Land"
            autoComplete="country-name"
            value={contact.country}
            error={visibleError('country')}
            onChange={(value) => update('country', value)}
            onBlur={() => markTouched('country')}
            placeholder="Deutschland"
            className="field--wide"
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="button button--secondary">
            Eingaben prüfen
          </button>
          {showAllErrors && Object.keys(errors).length === 0 ? (
            <p className="form-status form-status--ok" role="status">
              Die Kontaktdaten sind vollständig und gültig.
            </p>
          ) : null}
          {showAllErrors && Object.keys(errors).length > 0 ? (
            <p className="form-status form-status--error" role="status">
              Bitte prüfen Sie die markierten Felder.
            </p>
          ) : null}
        </div>
      </form>

      <ContactCardPreview contact={contact} errors={errors} />
    </div>
  )
}

type FieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  error?: string
  required?: boolean
  type?: 'text' | 'email' | 'tel' | 'url'
  autoComplete?: string
  inputMode?: 'text' | 'email' | 'tel' | 'url'
  placeholder?: string
  className?: string
  hint?: string
  describedBy?: string
}

function Field({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  required = false,
  type = 'text',
  autoComplete,
  inputMode,
  placeholder,
  className,
  hint,
  describedBy,
}: FieldProps) {
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedByIds = [hint ? hintId : null, error ? errorId : null, describedBy ?? null]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={className ? `field ${className}` : 'field'}>
      <label htmlFor={id}>
        {label}
        {required ? (
          <>
            {' '}
            <span className="required-marker" aria-hidden="true">
              *
            </span>
            <span className="visually-hidden"> (Pflichtfeld)</span>
          </>
        ) : null}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedByIds || undefined}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
      {hint ? (
        <p className="field-hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="field-error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
