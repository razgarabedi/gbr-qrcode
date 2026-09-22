import type { ContactCard } from '../types/contact'
import {
  formatDisplayName,
  normalizeWebsite,
  type ContactErrors,
} from '../lib/validate'

type ContactCardPreviewProps = {
  contact: ContactCard
  errors: ContactErrors
}

export function ContactCardPreview({ contact, errors }: ContactCardPreviewProps) {
  const name = formatDisplayName(contact)
  const hasContent = Boolean(
    name ||
      contact.title ||
      contact.organization ||
      contact.department ||
      contact.emailWork ||
      contact.phoneMobile ||
      contact.phoneWork ||
      contact.website ||
      contact.street ||
      contact.postalCode ||
      contact.city ||
      contact.country,
  )

  const addressLine = [contact.street, [contact.postalCode, contact.city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ')

  const websiteHref = contact.website ? normalizeWebsite(contact.website) : ''
  const isValidEnough = Object.keys(errors).length === 0 && Boolean(name)

  return (
    <aside className="card-preview" aria-labelledby="visitenkarte-vorschau-title">
      <h3 className="card-preview__heading" id="visitenkarte-vorschau-title">
        Vorschau der digitalen Visitenkarte
      </h3>
      <p className="card-preview__hint">
        Live-Ansicht Ihrer Angaben. Es wird nichts gespeichert oder gesendet.
      </p>

      <div className="business-card" data-valid={isValidEnough ? 'true' : 'false'}>
        <div className="business-card__accent" aria-hidden="true" />
        {!hasContent ? (
          <p className="business-card__empty">
            Sobald Sie Felder ausfüllen, erscheint hier Ihre Visitenkarte.
          </p>
        ) : (
          <div className="business-card__body">
            <p className="business-card__name">{name || 'Name fehlt noch'}</p>
            {contact.title ? <p className="business-card__title">{contact.title}</p> : null}
            {(contact.organization || contact.department) && (
              <p className="business-card__org">
                {[contact.organization, contact.department].filter(Boolean).join(' · ')}
              </p>
            )}

            <ul className="business-card__list">
              {contact.phoneMobile ? (
                <li>
                  <span className="business-card__label">Mobil</span>
                  <span>{contact.phoneMobile}</span>
                </li>
              ) : null}
              {contact.phoneWork ? (
                <li>
                  <span className="business-card__label">Festnetz</span>
                  <span>{contact.phoneWork}</span>
                </li>
              ) : null}
              {contact.emailWork ? (
                <li>
                  <span className="business-card__label">E-Mail</span>
                  <span>{contact.emailWork}</span>
                </li>
              ) : null}
              {websiteHref ? (
                <li>
                  <span className="business-card__label">Web</span>
                  <span>{websiteHref}</span>
                </li>
              ) : null}
              {addressLine || contact.country ? (
                <li>
                  <span className="business-card__label">Adresse</span>
                  <span>
                    {[addressLine, contact.country].filter(Boolean).join(', ')}
                  </span>
                </li>
              ) : null}
            </ul>
          </div>
        )}
      </div>
    </aside>
  )
}
