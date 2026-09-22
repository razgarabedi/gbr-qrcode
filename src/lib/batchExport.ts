import JSZip from 'jszip'
import type { ContactCard, LogoAsset } from '../types/contact'
import { downloadBlob } from './download'
import { isBatchContactExportable } from './contactImport'
import { buildQrPngFileName, type QrExportSize } from './qr'
import { type QrVisualStyle, renderQrVisual } from './qrShape'
import { sanitizeFileNamePart } from './vcard'
import { buildVCard } from './vcard'

export type BatchExportProgress = {
  current: number
  total: number
  label: string
}

/**
 * Dateiname nur Vorname_Nachname.png (ohne Größen-Suffix), für Batch-ZIP.
 * Fehlende Namensbestandteile werden weggelassen.
 */
export function buildBatchQrFileName(contact: ContactCard): string {
  const parts = [contact.firstName, contact.lastName]
    .map((part) => sanitizeFileNamePart(part))
    .filter((part) => part && part !== 'Kontakt')
  const base = parts.length > 0 ? parts.join('_') : 'Kontakt'
  return `${base}.png`
}

function uniqueFileName(baseName: string, used: Map<string, number>): string {
  const lower = baseName.toLowerCase()
  const count = used.get(lower) ?? 0
  used.set(lower, count + 1)
  if (count === 0) return baseName
  const dot = baseName.lastIndexOf('.')
  if (dot < 0) return `${baseName}_${count + 1}`
  return `${baseName.slice(0, dot)}_${count + 1}${baseName.slice(dot)}`
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',')
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export async function buildBatchQrZip(
  contacts: ContactCard[],
  options: {
    style: QrVisualStyle
    size: QrExportSize
    logo: LogoAsset | null
    onProgress?: (progress: BatchExportProgress) => void
  },
): Promise<{ blob: Blob; exported: number; skipped: number }> {
  const zip = new JSZip()
  const usedNames = new Map<string, number>()
  let exported = 0
  let skipped = 0
  const exportable = contacts.filter(isBatchContactExportable)
  const total = exportable.length

  for (let index = 0; index < contacts.length; index += 1) {
    const contact = contacts[index]
    if (!isBatchContactExportable(contact)) {
      skipped += 1
      continue
    }

    const label = `${contact.firstName} ${contact.lastName}`.trim()
    options.onProgress?.({
      current: exported + 1,
      total,
      label,
    })

    const payload = buildVCard(contact)
    const result = await renderQrVisual(payload, {
      style: options.style,
      size: options.size,
      logo: options.style === 'classic' ? options.logo : null,
    })

    const fileName = uniqueFileName(buildBatchQrFileName(contact), usedNames)
    zip.file(fileName, dataUrlToUint8Array(result.dataUrl))
    exported += 1
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  return { blob, exported, skipped }
}

export function downloadBatchQrZip(blob: Blob, fileName = 'qr-codes.zip'): void {
  downloadBlob(blob, fileName)
}

/** Optionaler Hilfsname inkl. Größe (Einzelexport-Kompatibilität). */
export function buildBatchZipArchiveName(size: QrExportSize): string {
  const stamp = new Date().toISOString().slice(0, 10)
  return `qr-batch_${stamp}_${size}.zip`
}

export { buildQrPngFileName }
