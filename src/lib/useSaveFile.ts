import { useCallback, useState } from 'react'
import {
  IOS_NEEDS_TAP,
  iosSaveFailureMessage,
  saveBlob,
  saveDataUrl,
  saveTextFile,
  sharePreparedFile,
  type SaveResult,
} from './download'

export function useSaveFile() {
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const report = useCallback((result: SaveResult) => {
    if (result.status === 'needs-gesture') {
      setPendingFile(result.file)
      setNotice(IOS_NEEDS_TAP)
      return
    }
    setPendingFile(null)
    if (result.status === 'failed') {
      setNotice(result.message)
      return
    }
    setNotice(null)
  }, [])

  const saveFromBlob = useCallback(
    async (blob: Blob, fileName: string, mimeType?: string) => {
      const result = await saveBlob(blob, fileName, mimeType)
      report(result)
      return result
    },
    [report],
  )

  const saveFromDataUrl = useCallback(
    async (dataUrl: string, fileName: string) => {
      const result = await saveDataUrl(dataUrl, fileName)
      report(result)
      return result
    },
    [report],
  )

  const saveFromText = useCallback(
    async (
      content: string,
      fileName: string,
      mimeType: string,
      options?: { utf8Bom?: boolean },
    ) => {
      const result = await saveTextFile(content, fileName, mimeType, options)
      report(result)
      return result
    },
    [report],
  )

  const confirmPending = useCallback(async () => {
    if (!pendingFile) return
    const result = await sharePreparedFile(pendingFile)
    if (result.status === 'needs-gesture') {
      setPendingFile(null)
      setNotice(iosSaveFailureMessage(pendingFile.name, 'unsupported'))
      return
    }
    report(result)
  }, [pendingFile, report])

  return {
    pending: pendingFile !== null,
    notice,
    report,
    saveFromBlob,
    saveFromDataUrl,
    saveFromText,
    confirmPending,
  }
}
