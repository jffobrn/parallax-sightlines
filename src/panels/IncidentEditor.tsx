import {
  dirOf,
  type IncidentType,
  type LocalizedText,
  type TimePrecision,
} from '../core'
import { useStore } from '../state/store'
import { PointFields } from '../components/points'
import {
  EnumSeg,
  Field,
  INCIDENT_TYPE_OPTIONS,
  PRECISION_OPTIONS,
  SelectMenu,
} from '../components/ui'

export function IncidentEditor() {
  const incident = useStore((s) => s.project.incident)
  const patchIncident = useStore((s) => s.patchIncident)
  const setPlacing = useStore((s) => s.setPlacing)
  const placing = useStore((s) => s.placing)

  const titles = incident.titles
  const setTitle = (i: number, partial: Partial<LocalizedText>) =>
    patchIncident({
      titles: titles.map((t, j) => (j === i ? { ...t, ...partial } : t)),
    })
  const addTitle = () =>
    patchIncident({ titles: [...titles, { text: '', lang: 'en' }] })
  const removeTitle = (i: number) =>
    patchIncident({ titles: titles.filter((_, j) => j !== i) })

  return (
    <div className="panel-body" style={{ paddingTop: 12 }}>
      <span className="label">Titles</span>
      <p className="faint" style={{ fontSize: 11, margin: '4px 0 8px' }}>
        One per language. Direction is detected per string.
      </p>
      {titles.map((t, i) => (
        <div key={i} className="title-row">
          <input
            className="input"
            dir={dirOf(t.text)}
            value={t.text}
            placeholder="Title"
            onChange={(e) => setTitle(i, { text: e.target.value })}
          />
          <input
            className="input input-mono"
            style={{ width: 56 }}
            value={t.lang}
            aria-label="language"
            onChange={(e) => setTitle(i, { lang: e.target.value })}
          />
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => removeTitle(i)}
            disabled={titles.length <= 1}
            aria-label="remove title"
          >
            &times;
          </button>
        </div>
      ))}
      <button className="btn btn-sm btn-ghost" onClick={addTitle} style={{ marginTop: 4 }}>
        Add title
      </button>

      <div className="divider" />
      <Field label="Type">
        <SelectMenu
          value={incident.type}
          options={INCIDENT_TYPE_OPTIONS.map((o) => ({ value: o.value as IncidentType, label: o.label }))}
          onChange={(v) => patchIncident({ type: v })}
          ariaLabel="incident type"
        />
      </Field>

      <div className="divider" />
      <span className="label">Time window</span>
      <div style={{ height: 6 }} />
      <div className="field-row">
        <Field label="Start (ISO)">
          <input
            className="input input-mono"
            placeholder="2021-03-14T01:45:00Z"
            value={incident.window.start ?? ''}
            onChange={(e) =>
              patchIncident({
                window: { ...incident.window, start: e.target.value || undefined },
              })
            }
          />
        </Field>
        <Field label="End (ISO)">
          <input
            className="input input-mono"
            placeholder="2021-03-14T03:30:00Z"
            value={incident.window.end ?? ''}
            onChange={(e) =>
              patchIncident({
                window: { ...incident.window, end: e.target.value || undefined },
              })
            }
          />
        </Field>
      </div>
      <Field label="Window precision">
        <EnumSeg<TimePrecision>
          value={incident.window.precision}
          options={PRECISION_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          onChange={(v) =>
            patchIncident({ window: { ...incident.window, precision: v } })
          }
        />
      </Field>

      <div className="divider" />
      <Field label="Summary">
        <textarea
          className="textarea"
          style={{ minHeight: 96 }}
          value={incident.summary ?? ''}
          onChange={(e) => patchIncident({ summary: e.target.value || undefined })}
        />
      </Field>

      <Field label="Tags" hint="Comma separated.">
        <input
          className="input"
          value={incident.tags.join(', ')}
          onChange={(e) =>
            patchIncident({
              tags: e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        />
      </Field>

      <div className="divider" />
      <span className="label">Place</span>
      <div style={{ height: 6 }} />
      <Field label="Name">
        <input
          className="input"
          value={incident.place?.name ?? ''}
          placeholder="Site name"
          onChange={(e) =>
            patchIncident({
              place: incident.place
                ? { ...incident.place, name: e.target.value || undefined }
                : { lat: 0, lng: 0, safeToPublish: true, name: e.target.value || undefined },
            })
          }
        />
      </Field>
      <PointFields
        point={incident.place}
        onChange={(p) =>
          patchIncident({ place: { ...p, name: incident.place?.name } })
        }
        onRemove={() => patchIncident({ place: undefined })}
        onPlace={() => setPlacing({ kind: 'incident-place' })}
        placeLabel="Place incident on map"
        placingActive={placing?.kind === 'incident-place'}
      />
    </div>
  )
}
