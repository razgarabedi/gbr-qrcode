import { IOS_SAVE_HINT, isIosDevice } from '../lib/download'

export function IosSaveHint() {
  if (!isIosDevice()) return null
  return <p className="placeholder-note ios-save-hint">{IOS_SAVE_HINT}</p>
}

type IosSaveFollowUpProps = {
  pending: boolean
  notice: string | null
  onConfirm: () => void | Promise<void>
}

export function IosSaveFollowUp({ pending, notice, onConfirm }: IosSaveFollowUpProps) {
  if (!pending && !notice) return null
  return (
    <div className="ios-save-followup">
      {notice ? (
        <p className="placeholder-note" role="status">
          {notice}
        </p>
      ) : null}
      {pending ? (
        <div className="button-row">
          <button
            type="button"
            className="button"
            onClick={() => {
              void onConfirm()
            }}
          >
            Jetzt sichern
          </button>
        </div>
      ) : null}
    </div>
  )
}
