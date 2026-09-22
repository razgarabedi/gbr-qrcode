import { importContactsFromFile, type ContactImportResult } from './contactImport'

const SHARE_CACHE = 'gbr-share-target-v1'
const SHARED_CONTACT_URL = '/__shared-contact__'

export function registerShareTargetWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // Offline/Share-Target optional — App funktioniert ohne SW.
    })
  })
}

/**
 * Liest eine über Web Share Target (z. B. WhatsApp „Kontakt teilen“) empfangene VCF.
 */
export async function consumeSharedContactImport(): Promise<ContactImportResult | null> {
  if (typeof window === 'undefined' || !('caches' in window)) return null

  const params = new URLSearchParams(window.location.search)
  if (params.get('import') !== 'shared') return null

  try {
    const cache = await caches.open(SHARE_CACHE)
    const response = await cache.match(SHARED_CONTACT_URL)
    if (!response) return null

    const blob = await response.blob()
    const fileName = response.headers.get('X-Filename') || 'geteilt.vcf'
    const file = new File([blob], fileName, {
      type: response.headers.get('Content-Type') || 'text/vcard',
    })
    await cache.delete(SHARED_CONTACT_URL)

    const result = await importContactsFromFile(file)

    const url = new URL(window.location.href)
    url.searchParams.delete('import')
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash || '#kontaktdaten'}`)

    return result
  } catch {
    return null
  }
}
