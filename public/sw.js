/* Service Worker: Web Share Target für geteilte Visitenkarten (z. B. WhatsApp). */
const SHARE_CACHE = 'gbr-share-target-v1'
const SHARED_CONTACT_URL = '/__shared-contact__'

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'POST' || url.pathname !== '/share-target') {
    return
  }

  event.respondWith(
    (async () => {
      try {
        const formData = await event.request.formData()
        const entry =
          formData.get('contacts') ||
          formData.get('file') ||
          formData.get('vcard') ||
          [...formData.values()].find((value) => value instanceof File)

        if (entry instanceof File && entry.size > 0) {
          const cache = await caches.open(SHARE_CACHE)
          const headers = new Headers({
            'Content-Type': entry.type || 'text/vcard',
            'X-Filename': entry.name || 'kontakt.vcf',
          })
          await cache.put(SHARED_CONTACT_URL, new Response(entry, { headers }))
        }
      } catch {
        // Ignorieren — Redirect trotzdem, die App zeigt ggf. einen Hinweis.
      }

      return Response.redirect('/?import=shared#kontaktdaten', 303)
    })(),
  )
})
