import * as Dialog from '@radix-ui/react-dialog'
import { APP_NAME, DISCLAIMER, SUITE_NAME, TAGLINE } from '../core'

export function AboutDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content ticks">
          <Dialog.Title className="dialog-title">
            {APP_NAME} <span className="faint">// {SUITE_NAME}</span>
          </Dialog.Title>
          <Dialog.Description className="dialog-desc">{TAGLINE}</Dialog.Description>

          <div className="prose" style={{ fontSize: 13 }}>
            <p style={{ marginBottom: 12 }}>
              Reconstruct one incident or site from scattered material, keeping
              every source tethered to its provenance. Gather sources and hash
              what you hold; place each photograph&apos;s subject and its camera
              vantage on the map; cross the vantage rays to resect a location;
              order everything on the linked timeline; and state findings that
              cite the sources supporting them.
            </p>

            <span className="label">The signature move</span>
            <p style={{ margin: '6px 0 12px' }}>
              A vantage is a point plus a bearing. Drop a station on the map, drag
              the bearing dial, and watch the rays converge. Where two cross,
              accept the crossing as a subject or the incident place. Two
              near-parallel rays are reported as weak geometry, not a confident
              false point.
            </p>

            <span className="label">Consent by design</span>
            <p style={{ margin: '6px 0 12px' }}>
              One boundary function produces every export and every published
              view. It drops embargoed and restricted sources, reduces providers
              to aliases, hides provenance, and withholds coordinates marked not
              safe to publish. Nothing sensitive can leak because it never crosses
              that boundary.
            </p>

            <div className="note-box">{DISCLAIMER}</div>

            <p className="faint" style={{ marginTop: 12, fontSize: 12 }}>
              Runs entirely in your browser. The project and its media stay on
              your machine in local storage; nothing is uploaded. The basemap is a
              synthetic graticule that fetches no tiles, so a sensitive area of
              interest never reaches an outside server. The bundled sample is
              plainly fictional.
            </p>
          </div>

          <Dialog.Close asChild>
            <button className="dialog-close" aria-label="Close">&times;</button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
