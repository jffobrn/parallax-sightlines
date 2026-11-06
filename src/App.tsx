import { useEffect } from 'react'
import { useStore } from './state/store'
import { Toolbar } from './panels/Toolbar'
import { Rail } from './panels/Rail'
import { Inspector } from './panels/Inspector'
import { MapView } from './map/MapView'
import { Timeline } from './timeline/Timeline'
import { ClockView } from './timeline/ClockView'
import { timeExtent } from './lib/derive'

function fmtMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 16).replace('T', ' ')
}

function TimelineHead() {
  const project = useStore((s) => s.project)
  const timeBrush = useStore((s) => s.timeBrush)
  const setTimeBrush = useStore((s) => s.setTimeBrush)
  const dockView = useStore((s) => s.dockView)
  const setDockView = useStore((s) => s.setDockView)
  const extent = timeExtent(project)

  return (
    <div className="timeline-head">
      <h2 className="sec-title">Time</h2>
      <div className="seg" role="group" aria-label="dock view">
        <button type="button" aria-pressed={dockView === 'chronology'} onClick={() => setDockView('chronology')}>
          Chronology
        </button>
        <button type="button" aria-pressed={dockView === 'clock'} onClick={() => setDockView('clock')}>
          Clock
        </button>
      </div>
      {dockView === 'chronology' && extent && (
        <span className="faint" style={{ fontSize: 13 }}>
          <span className="mono">{fmtMs(extent[0])}</span> to <span className="mono">{fmtMs(extent[1])}</span> UTC
        </span>
      )}
      <div className="topbar-spacer" />
      {dockView === 'clock' ? (
        <span className="faint" style={{ fontSize: 13 }}>Sources aligned on shared events</span>
      ) : timeBrush ? (
        <button className="btn btn-sm btn-ghost" onClick={() => setTimeBrush(null)}>
          Clear filter
        </button>
      ) : (
        <span className="faint" style={{ fontSize: 13 }}>Drag across to filter</span>
      )}
    </div>
  )
}

function DockBody() {
  const dockView = useStore((s) => s.dockView)
  return dockView === 'clock' ? <ClockView /> : <Timeline />
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
        <div className="boot-mark">Parallax Sightlines</div>
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
      <div className="stage">
        <MapView />
      </div>
      <div className="timeline-dock">
        <TimelineHead />
        <DockBody />
      </div>
      <div className="inspector">
        <Inspector />
      </div>
    </div>
  )
}
