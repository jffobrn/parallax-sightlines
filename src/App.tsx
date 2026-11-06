import { useEffect } from 'react'
import { useStore } from './state/store'
import { Toolbar } from './panels/Toolbar'
import { Rail } from './panels/Rail'
import { Inspector } from './panels/Inspector'
import { MapView } from './map/MapView'
import { Timeline } from './timeline/Timeline'
import { ClockView } from './timeline/ClockView'
import { timeExtent } from './lib/derive'
import { StatusBar } from './panels/StatusBar'
import { CrossingCard } from './map/CrossingCard'

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

  const tab = (v: 'chronology' | 'clock' | 'crossing', label: string) => (
    <button type="button" role="tab" className="dock-tab" aria-selected={dockView === v} onClick={() => setDockView(v)}>
      {label}
    </button>
  )
  return (
    <div className="timeline-head" role="tablist" aria-label="dock view">
      {tab('chronology', 'Chronology')}
      {tab('clock', 'Clock')}
      {tab('crossing', 'Crossing')}
      <div className="topbar-spacer" />
      <span className="dock-info">
        {dockView === 'chronology' && extent && (
          <>
            <span className="mono">{fmtMs(extent[0])}</span> to <span className="mono">{fmtMs(extent[1])}</span> UTC,{' '}
            {timeBrush ? (
              <button className="btn-link" onClick={() => setTimeBrush(null)}>
                clear the filter
              </button>
            ) : (
              'drag to filter'
            )}
          </>
        )}
        {dockView === 'clock' && 'Sources aligned on shared events'}
        {dockView === 'crossing' && 'Where the vantage rays meet'}
      </span>
    </div>
  )
}

function DockBody() {
  const dockView = useStore((s) => s.dockView)
  if (dockView === 'clock') return <ClockView />
  if (dockView === 'crossing')
    return (
      <div className="timeline-wrap" style={{ overflowY: 'auto' }}>
        <CrossingCard />
      </div>
    )
  return <Timeline />
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
      <StatusBar />
    </div>
  )
}
