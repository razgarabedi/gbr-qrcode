import type { ReactNode } from 'react'

type SectionProps = {
  id: string
  title: string
  description?: string
  children: ReactNode
}

export function Section({ id, title, description, children }: SectionProps) {
  return (
    <section className="section" id={id} aria-labelledby={`${id}-title`}>
      <header className="section__header">
        <h2 className="section__title" id={`${id}-title`}>
          {title}
        </h2>
        {description ? <p className="section__description">{description}</p> : null}
      </header>
      <div className="section__body">{children}</div>
    </section>
  )
}
