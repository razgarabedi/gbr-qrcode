/**
 * Lädt eine Textdatei lokal herunter (ohne Netzwerkübertragung).
 * Für VCF wird ein UTF-8-BOM ergänzt, damit Windows-Programme Umlaute zuverlässig lesen.
 */
export function downloadTextFile(
  content: string,
  fileName: string,
  mimeType: string,
  options?: { utf8Bom?: boolean },
): void {
  const payload = options?.utf8Bom ? `\uFEFF${content}` : content
  const blob = new Blob([payload], { type: mimeType })
  downloadBlob(blob, fileName)
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = fileName
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(objectUrl)
}

export function downloadDataUrl(dataUrl: string, fileName: string): void {
  const anchor = document.createElement('a')
  anchor.href = dataUrl
  anchor.download = fileName
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
}

export function downloadVcfFile(vcardText: string, fileName: string): void {
  downloadTextFile(vcardText, fileName, 'text/vcard;charset=utf-8', { utf8Bom: true })
}

