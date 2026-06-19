import { useState } from 'react'
import { type Certainty, type Finding } from '../core'
import { useStore } from '../state/store'
import {
  CERTAINTY_OPTIONS,
  ConsentBadge,
  Dir,
  EnumSeg,
  Field,
} from '../components/ui'

/**
 * A finding is an assertion the account makes, and it is only a finding while it
 * is tethered to the sources that support it. The editor makes that tether
 * explicit and warns when support rests on material that will not be published.
 */
export function FindingEditor({ finding }: { finding: Finding }) {
  const sources = useStore((s) => s.project.sources)
  const updateFinding = useStore((s) => s.updateFinding)
  const removeFinding = useStore((s) => s.removeFinding)
  const [confirmDel, setConfirmDel] = useState(false)

  const id = finding.id
  const patch = (partial: Partial<Finding>) => updateFinding(id, partial)

  const toggleSupport = (sid: string) => {
    const has = finding.supportedBy.includes(sid)
    patch({
      supportedBy: has
        ? finding.supportedBy.filter((x) => x !== sid)
        : [...finding.supportedBy, sid],
    })
  }

  const publicSupport = finding.supportedBy.filter((sid) =>
    sources.find((s) => s.id === sid && s.consent === 'public'),
  )
  const willDrop = finding.supportedBy.length > 0 && publicSupport.length === 0

  return (
    <div className="panel-body" style={{ paddingTop: 12 }}>
      <Field label="Statement">
        <textarea
          className="textarea"
          style={{ minHeight: 88 }}
          value={finding.statement}
          onChange={(e) => patch({ statement: e.target.value })}
        />
      </Field>

      <Field label="Certainty">
        <EnumSeg<Certainty>
          value={finding.certainty}
          options={CERTAINTY_OPTIONS}
          onChange={(v) => patch({ certainty: v })}
        />
      </Field>

      <Field label="Time (ISO, optional)">
        <input
          className="input input-mono"
          placeholder="2021-03-14T02:15:00Z"
          value={finding.at?.time ?? ''}
          onChange={(e) => {
            const time = e.target.value.trim()
            const at = { ...finding.at, time: time || undefined }
            patch({ at: at.time || at.place ? at : undefined })
          }}
        />
      </Field>

      <div className="divider" />
      <span className="label">Supported by</span>
      <p className="faint" style={{ fontSize: 11, margin: '4px 0 8px' }}>
        Tie this assertion to its sources.
      </p>
      <div className="stack" style={{ gap: 2 }}>
        {sources.length === 0 && <span className="faint">No sources yet.</span>}
        {sources.map((s) => {
          const checked = finding.supportedBy.includes(s.id)
          return (
            <button
              key={s.id}
              type="button"
              className="support-row"
              data-checked={checked}
              onClick={() => toggleSupport(s.id)}
            >
              <span className="support-box">{checked ? '✓' : ''}</span>
              <span className="row-title" style={{ flex: 1 }}>
                <Dir text={s.title} />
              </span>
              <ConsentBadge consent={s.consent} />
            </button>
          )
        })}
      </div>

      {willDrop && (
        <div className="warn" style={{ marginTop: 10 }}>
          All supporting sources are withheld from publication, so this finding
          will be dropped from the published investigation.
        </div>
      )}
      {!willDrop && finding.supportedBy.length > publicSupport.length && (
        <div className="note" style={{ marginTop: 10 }}>
          Some support is withheld from publication; the finding will publish with
          reduced support.
        </div>
      )}
      {finding.supportedBy.length === 0 && (
        <div className="warn" style={{ marginTop: 10 }}>
          A finding with no supporting source is an unsupported claim. Add at least
          one source.
        </div>
      )}

      <div className="divider" />
      {confirmDel ? (
        <div className="btn-row">
          <button className="btn btn-sm btn-danger" onClick={() => removeFinding(id)}>
            Confirm delete
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => setConfirmDel(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button className="btn btn-sm btn-ghost btn-danger" onClick={() => setConfirmDel(true)}>
          Delete finding
        </button>
      )}
    </div>
  )
}
