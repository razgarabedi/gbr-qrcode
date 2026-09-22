import { describe, expect, it } from 'vitest'
import { emptyContactCard } from './contact'

describe('emptyContactCard', () => {
  it('liefert leere Pflichtfelder und Deutschland als Land', () => {
    const card = emptyContactCard()
    expect(card.firstName).toBe('')
    expect(card.lastName).toBe('')
    expect(card.organization).toBe('')
    expect(card.department).toBe('')
    expect(card.country).toBe('Deutschland')
  })
})
