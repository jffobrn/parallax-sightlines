import { useRef, useState } from 'react'
import {
  formatBearing,
  formatBytes,
  formatDateTime,
  type Certainty,
  type Source,
  type TimePrecision,
} from '../core'
import { useStore } from '../state/store'
import { useMediaUrl } from '../state/useMediaUrl'
import { ingestFile } from '../lib/ingest'
import { findWaybackSnapshot } from '../lib/wayback'
import { BearingDial } from '../components/BearingDial'
import { PointFields } from '../components/points'
import {
  CERTAINTY_OPTIONS,
  CONSENT_OPTIONS,
  Dir,
  EnumSeg,
  Field,
  KIND_OPTIONS,
  PRECISION_OPTIONS,
  SelectMenu,
} from '../components/ui'

const CONSENT_NOTE: Record<Source['consent'], string> = {
  public: 'Included in exports and the published investigation.',
  restricted: 'Kept in your project file, withheld from anything published.',
  embargoed: 'Kept in your project file, withheld from anything published.',
}

export function SourceEditor({ source }: { source: Source }) {
  const updateSource = useStore((s) => s.updateSource)
  const removeSource = useStore((s) => s.removeSource)
  const setPlacing = useStore((s) => s.setPlacing)
  const placing = useStore((s) => s.placing)

  const fileInput = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [wb, setWb] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const previewUrl = useMediaUrl(source.file?.blobKey)

  const id = source.id
  const patch = (partial: Partial<Source>) => updateSource(id, partial)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setBusy('Hashing file...')
    try {
      const held = await ingestFile(file)
      patch({ file: held })
    } finally {
      setBusy(null)
    }
  }

  const requestSnapshot = async () => {
    if (!source.link?.url) return
    setWb('Asking the Internet Archive...')
    try {
      const snap = await findWaybackSnapshot(source.link.url)
      if (!snap) {
        setWb('No snapshot found for that URL.')
        return
      }
      patch({ link: { ...source.link, ...snap } })
      setWb('Snapshot found and hashed.')
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      setWb(
        /fetch|network|load failed/i.test(msg)
          ? 'Could not reach the Internet Archive (offline, blocked, or CORS). The link is saved; try again when online.'
          : msg || 'Lookup failed.',
      )
    }
  }

  const isVideo = source.kind === 'video-link'

  return (
    <div className="panel-body" style={{ paddingTop: 12 }}>
      {/* identity */}
      <Field label="Title">
        <input
          className="input"
          value={source.title}
          dir={undefined}
          onChange={(e) => patch({ title: e.target.value })}
        />
      </Field>
      <Field label="Kind">
        <SelectMenu
          value={source.kind}
          options={KIND_OPTIONS}
          onChange={(v) => patch({ kind: v })}
          ariaLabel="source kind"
        />
      </Field>

      <div className="divider" />
      <span className="label">Time</span>
      <div style={{ height: 6 }} />
      <Field label="Datetime (ISO, UTC)" hint="Leave blank if unknown.">
        <input
          className="input input-mono"
          placeholder="2021-03-14T02:12:00Z"
          value={source.datetime?.value ?? ''}
          onChange={(e) => {
            const value = e.target.value.trim()
            if (!value) patch({ datetime: undefined })
            else
              patch({
                datetime: {
                  value,
                  precision: source.datetime?.precision ?? 'minute',
                },
              })
          }}
        />
      </Field>
      {source.datetime && (
        <>
          <Field label="Precision">
            <EnumSeg<TimePrecision>
              value={source.datetime.precision}
              options={PRECISION_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              onChange={(v) =>
                patch({ datetime: { value: source.datetime!.value, precision: v } })
              }
            />
          </Field>
          <p className="faint" style={{ fontSize: 11, marginTop: -4 }}>
            {formatDateTime(source.datetime.value, source.datetime.precision)}
          </p>
        </>
      )}

      <div className="divider" />
      <span className="label">Provenance &amp; rights</span>
      <div style={{ height: 6 }} />
      <Field label="Provider" hint="Reduced to an alias in anything published.">
        <input
          className="input"
          value={source.provider ?? ''}
          onChange={(e) => patch({ provider: e.target.value || undefined })}
        />
      </Field>
      <Field label="Provenance" hint="Origin and how obtained. Never published.">
        <textarea
          className="textarea"
          value={source.provenance ?? ''}
          onChange={(e) => patch({ provenance: e.target.value || undefined })}
        />
      </Field>
      <Field label="Rights">
        <input
          className="input"
          value={source.rights ?? ''}
          onChange={(e) => patch({ rights: e.target.value || undefined })}
        />
      </Field>

      <div className="divider" />
      <span className="label">Consent</span>
      <div style={{ height: 6 }} />
      <EnumSeg
        value={source.consent}
        options={CONSENT_OPTIONS}
        onChange={(v) => patch({ consent: v })}
      />
      <p
        className={source.consent === 'public' ? 'faint' : 'alert'}
        style={{ fontSize: 11, marginTop: 6 }}
      >
        {CONSENT_NOTE[source.consent]}
      </p>

      <div className="divider" />
      {isVideo ? (
        <>
          <span className="label">Link &amp; archive</span>
          <div style={{ height: 6 }} />
          <Field label="URL" hint="The remote video is never downloaded.">
            <input
              className="input input-mono"
              value={source.link?.url ?? ''}
              onChange={(e) =>
                patch({ link: { ...source.link, url: e.target.value } })
              }
            />
          </Field>
          <button className="btn btn-sm" onClick={requestSnapshot} disabled={!source.link?.url}>
            Request archived snapshot
          </button>
          {wb && <p className="faint" style={{ fontSize: 11, marginTop: 6 }}>{wb}</p>}
          {source.link?.archivedUrl && (
            <dl className="kv" style={{ marginTop: 10 }}>
              <dt>Archived</dt>
              <dd className="mono" style={{ wordBreak: 'break-all', fontSize: 11 }}>
                {source.link.archivedUrl}
              </dd>
              {source.link.archivedAt && (
                <>
                  <dt>Captured</dt>
                  <dd className="mono">{source.link.archivedAt}</dd>
                </>
              )}
              {source.link.archivedSha256 && (
                <>
                  <dt>Snapshot</dt>
                  <dd className="hash">sha256:{source.link.archivedSha256}</dd>
                </>
              )}
            </dl>
          )}
          <p className="faint" style={{ fontSize: 11, marginTop: 6 }}>
            Remote bytes are not held and cannot be hashed at source; the hash is of
            the snapshot record.
          </p>
        </>
      ) : (
        <>
          <span className="label">File</span>
          <div style={{ height: 6 }} />
          <input
            ref={fileInput}
            type="file"
            style={{ display: 'none' }}
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          {source.file ? (
            <>
              {previewUrl && source.file.mime.startsWith('image/') && (
                <img className="exhibit-img" src={previewUrl} alt={source.title} />
              )}
              <dl className="kv" style={{ marginTop: 8 }}>
                <dt>Name</dt>
                <dd className="mono" style={{ fontSize: 11 }}>{source.file.name}</dd>
                <dt>Size</dt>
                <dd className="mono">
                  {formatBytes(source.file.bytes)}
                  {source.file.w ? ` / ${source.file.w}x${source.file.h}` : ''}
                </dd>
                <dt>sha-256</dt>
                <dd className="hash">{source.file.sha256}</dd>
              </dl>
              <button className="btn btn-sm btn-ghost" style={{ marginTop: 8 }} onClick={() => fileInput.current?.click()}>
                Replace file
              </button>
            </>
          ) : (
            <button className="btn btn-sm" onClick={() => fileInput.current?.click()}>
              {busy ?? 'Add file'}
            </button>
          )}
          {busy && source.file && <p className="faint" style={{ fontSize: 11, marginTop: 6 }}>{busy}</p>}
        </>
      )}

      <div className="divider" />
      <span className="label">Subject</span>
      <p className="faint" style={{ fontSize: 11, margin: '4px 0 8px' }}>
        Where the depicted thing is.
      </p>
      <PointFields
        point={source.subject}
        onChange={(p) => patch({ subject: p })}
        onRemove={() => patch({ subject: undefined })}
        onPlace={() => setPlacing({ kind: 'subject', sourceId: id })}
        placeLabel="Place subject on map"
        placingActive={placing?.kind === 'subject' && placing.sourceId === id}
      />

      <div className="divider" />
      <span className="label">Vantage</span>
      <p className="faint" style={{ fontSize: 11, margin: '4px 0 8px' }}>
        Where the camera was, and the way it looked.
      </p>
      <PointFields
        point={source.vantage}
        onChange={(p) =>
          patch({
            vantage: {
              ...p,
              bearingDeg: source.vantage?.bearingDeg ?? 0,
              fovDeg: source.vantage?.fovDeg,
              confidence: source.vantage?.confidence ?? 'probable',
            },
          })
        }
        onRemove={() => patch({ vantage: undefined })}
        onPlace={() => setPlacing({ kind: 'vantage', sourceId: id })}
        placeLabel="Place camera vantage on map"
        placingActive={placing?.kind === 'vantage' && placing.sourceId === id}
      />
      {source.vantage && (
        <div className="vantage-grid">
          <BearingDial
            value={source.vantage.bearingDeg}
            onChange={(deg) =>
              patch({ vantage: { ...source.vantage!, bearingDeg: deg } })
            }
          />
          <div className="stack" style={{ gap: 8, flex: 1 }}>
            <Field label={`Bearing  ${formatBearing(source.vantage.bearingDeg)}`}>
              <input
                className="input input-mono"
                type="number"
                min={0}
                max={360}
                value={source.vantage.bearingDeg}
                onChange={(e) =>
                  patch({
                    vantage: {
                      ...source.vantage!,
                      bearingDeg: ((parseFloat(e.target.value) % 360) + 360) % 360,
                    },
                  })
                }
              />
            </Field>
            <Field label="Field of view (deg, optional)">
              <input
                className="input input-mono"
                type="number"
                min={0}
                max={180}
                value={source.vantage.fovDeg ?? ''}
                onChange={(e) => {
                  const n = parseFloat(e.target.value)
                  patch({
                    vantage: {
                      ...source.vantage!,
                      fovDeg: Number.isFinite(n) ? n : undefined,
                    },
                  })
                }}
              />
            </Field>
            <Field label="Confidence">
              <EnumSeg<Certainty>
                value={source.vantage.confidence}
                options={CERTAINTY_OPTIONS}
                onChange={(v) =>
                  patch({ vantage: { ...source.vantage!, confidence: v } })
                }
              />
            </Field>
          </div>
        </div>
      )}

      <div className="divider" />
      <Field label="Note">
        <textarea
          className="textarea"
          value={source.note ?? ''}
          onChange={(e) => patch({ note: e.target.value || undefined })}
        />
      </Field>

      <div className="divider" />
      {confirmDel ? (
        <div className="btn-row">
          <button className="btn btn-sm btn-danger" onClick={() => removeSource(id)}>
            Confirm delete
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => setConfirmDel(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button className="btn btn-sm btn-ghost btn-danger" onClick={() => setConfirmDel(true)}>
          Delete source
        </button>
      )}
      <div style={{ height: 8 }} />
      <div className="row-sub" style={{ padding: 0 }}>
        <Dir text={source.title} /> &nbsp;/&nbsp; id {id}
      </div>
    </div>
  )
}
