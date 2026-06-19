import { useEffect } from 'react'
import { useStore } from './state/store'
import { Toolbar } from './panels/Toolbar'
import { Rail } from './panels/Rail'
import { Inspector } from './panels/Inspector'
import { MapView } from './map/MapView'
import { Timeline } from './timeline/Timeline'
import { timeExtent } from './lib/derive'

function fmtMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 16).replace('T', ' ')
}

function TimelineHead() {
  const project = useStore((s) => s.project)
  const timeBrush = useStore((s) => s.timeBrush)
  const setTimeBrush = useStore((s) => s.setTimeBrush)
  const extent = timeExtent(project)

  return (
    <div className="timeline-head">
      <span className="label"><span className="label-num">04</span>Chronology</span>
      {extent && (
        <span className="faint mono" style={{ fontSize: 11 }}>
          {fmtMs(extent[0])} to {fmtMs(extent[1])}
        </span>
      )}
      <div className="topbar-spacer" />
      {timeBrush ? (
        <button className="btn btn-sm btn-ghost" onClick={() => setTimeBrush(null)}>
          Clear filter
        </button>
      ) : (
        <span className="faint" style={{ fontSize: 11 }}>drag to filter</span>
      )}
    </div>
  )
}

export default function App() {
  const ready = useStore((s) => s.ready)
  const init = useStore((s) => s.init)

  useEffect(() => {
    void init()
  }, [init])

  if (!ready) {
    return (
      <div className="boot">
        <div className="boot-mark mono">PARALLAX // SIGHTLINES</div>
        <div className="faint">Loading local project...</div>
      </div>
    )
  }

  return (
    <div className="app">
      <Toolbar />
      <div className="rail">
        <Rail />
      </div>
      <div className="stage ticks">
        <MapView />
      </div>
      <div className="timeline-dock">
        <TimelineHead />
        <Timeline />
      </div>
      <div className="inspector">
        <Inspector />
      </div>
    </div>
  )
}
