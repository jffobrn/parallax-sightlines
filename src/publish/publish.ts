/**
 * Build the published investigation: one self-contained, static HTML file with
 * the map, chronology, exhibits, and findings, plus the consent disclosure. It
 * takes a PublicProject (already through the consent boundary) and never reaches
 * back to the full project, so nothing sensitive can appear here. The same file
 * is the screen artifact and, via print CSS, the print dossier.
 */

import syneFont from '../design/fonts/syne-latin.woff2?inline'
import {
  APP_NAME,
  AUTHOR,
  DISCLAIMER,
  SUITE_NAME,
  destinationPoint,
  dirOf,
  formatBearing,
  formatDateTime,
  formatLatLng,
  redactionLines,
  resect,
  toLocal,
  type LatLng,
  type PublicProject,
  type PublicSource,
} from '../core'
import { solveClocks } from '../lib/clock'
import { originZones } from '../lib/zones'

function esc(s: string | undefined): string {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function dirAttr(s: string): string {
  return ` dir="${dirOf(s)}"`
}

/** Format a finding's asserted time without implying minute precision it lacks. */
function formatInstant(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  const d = new Date(t)
  const date = d.toISOString().slice(0, 10)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return hh === '00' && mm === '00' ? date : `${date} ${hh}:${mm} UTC`
}

interface MapPoint {
  id?: string
  kind: 'place' | 'subject' | 'vantage' | 'crossing'
  lat: number
  lng: number
  bearingDeg?: number
  coarsened?: boolean
}

function collectPoints(pub: PublicProject): MapPoint[] {
  const pts: MapPoint[] = []
  if (pub.incident.place)
    pts.push({ kind: 'place', lat: pub.incident.place.lat, lng: pub.incident.place.lng, coarsened: pub.incident.place.coarsened })
  for (const s of pub.sources) {
    if (s.subject)
      pts.push({ id: s.id, kind: 'subject', lat: s.subject.lat, lng: s.subject.lng, coarsened: s.subject.coarsened })
    if (s.vantage)
      pts.push({ id: s.id, kind: 'vantage', lat: s.vantage.lat, lng: s.vantage.lng, bearingDeg: s.vantage.bearingDeg, coarsened: s.vantage.coarsened })
  }
  const r = resect(
    pub.sources
      .filter((s) => s.vantage)
      .map((s) => ({ id: s.id, lat: s.vantage!.lat, lng: s.vantage!.lng, bearingDeg: s.vantage!.bearingDeg })),
  )
  if (r.best?.point) pts.push({ kind: 'crossing', lat: r.best.point.lat, lng: r.best.point.lng })
  return pts
}

function buildSvgMap(pub: PublicProject): string {
  const pts = collectPoints(pub)
  if (pts.length === 0) {
    return '<div class="map-empty">No publishable coordinates in this investigation.</div>'
  }

  const W = 820
  const H = 470
  const pad = 48

  const ref: LatLng =
    pub.incident.place ?? { lat: pts[0].lat, lng: pts[0].lng }
  const local = pts.map((p) => ({ p, xy: toLocal(ref, p) }))

  let minX = Math.min(...local.map((l) => l.xy.x))
  let maxX = Math.max(...local.map((l) => l.xy.x))
  let minY = Math.min(...local.map((l) => l.xy.y))
  let maxY = Math.max(...local.map((l) => l.xy.y))
  let spanX = maxX - minX
  let spanY = maxY - minY
  if (spanX < 120) { const c = (minX + maxX) / 2; minX = c - 60; maxX = c + 60; spanX = 120 }
  if (spanY < 120) { const c = (minY + maxY) / 2; minY = c - 60; maxY = c + 60; spanY = 120 }
  const scale = Math.min((W - 2 * pad) / spanX, (H - 2 * pad) / spanY)

  const X = (x: number) => pad + (x - minX) * scale
  const Y = (y: number) => H - (pad + (y - minY) * scale)
  const proj = (lat: number, lng: number) => {
    const xy = toLocal(ref, { lat, lng })
    return { x: X(xy.x), y: Y(xy.y) }
  }

  const rayLenM = Math.max(80, Math.min(900, Math.max(spanX, spanY) * 0.7))
  const parts: string[] = []

  // frame and a light internal grid
  parts.push(`<rect x="1" y="1" width="${W - 2}" height="${H - 2}" class="m-frame"/>`)
  for (let i = 1; i < 6; i++) {
    const gx = pad + ((W - 2 * pad) * i) / 6
    const gy = pad + ((H - 2 * pad) * i) / 6
    parts.push(`<line x1="${gx.toFixed(1)}" y1="${pad}" x2="${gx.toFixed(1)}" y2="${H - pad}" class="m-grid"/>`)
    parts.push(`<line x1="${pad}" y1="${gy.toFixed(1)}" x2="${W - pad}" y2="${gy.toFixed(1)}" class="m-grid"/>`)
  }

  // zones of possible origin, recomputed from the published readings
  for (const z of originZones(pub)) {
    if (z.empty || z.wedges < 2) continue
    const d = z.ring
      .map(([lng, lat], i) => {
        const c = proj(lat, lng)
        return `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`
      })
      .join(' ')
    parts.push(`<path d="${d} Z" class="m-zone"/>`)
  }

  // rays
  for (const p of pts) {
    if (p.kind !== 'vantage' || p.bearingDeg === undefined) continue
    const a = proj(p.lat, p.lng)
    const end = destinationPoint({ lat: p.lat, lng: p.lng }, p.bearingDeg, rayLenM)
    const b = proj(end.lat, end.lng)
    parts.push(`<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" class="m-ray" data-id="${esc(p.id)}"/>`)
  }

  // markers
  for (const p of pts) {
    const c = proj(p.lat, p.lng)
    const cx = c.x.toFixed(1)
    const cy = c.y.toFixed(1)
    if (p.kind === 'crossing') {
      parts.push(`<circle cx="${cx}" cy="${cy}" r="11" class="m-cross-ring"/>`)
      parts.push(`<circle cx="${cx}" cy="${cy}" r="5" class="m-cross"/>`)
    } else if (p.kind === 'place') {
      parts.push(`<circle cx="${cx}" cy="${cy}" r="8" class="m-place"/>`)
    } else if (p.kind === 'vantage') {
      parts.push(`<circle cx="${cx}" cy="${cy}" r="5" class="marker m-vantage" data-ex="${esc(p.id)}" data-id="${esc(p.id)}"/>`)
    } else {
      parts.push(`<circle cx="${cx}" cy="${cy}" r="5" class="marker m-subject" data-ex="${esc(p.id)}" data-id="${esc(p.id)}"/>`)
    }
  }

  return `<svg viewBox="0 0 ${W} ${H}" class="sitemap" role="img" aria-label="Site map">${parts.join('')}</svg>`
}

function exhibitLabel(index: number): string {
  return `Source ${index + 1}`
}

function exhibitCard(s: PublicSource, index: number): string {
  const label = exhibitLabel(index)
  // Only embed a thumbnail that is a genuine image data URL (defense in depth).
  const safeThumb =
    s.file?.thumbnailDataUrl && s.file.thumbnailDataUrl.startsWith('data:image/')
      ? s.file.thumbnailDataUrl
      : ''
  const thumb = safeThumb
    ? `<img class="ex-img" src="${safeThumb}" alt="${esc(s.title)}"/>`
    : ''
  const dt = s.datetime ? formatDateTime(s.datetime.value, s.datetime.precision) : 'undated'
  const rows: string[] = []
  rows.push(`<dt>kind</dt><dd>${esc(s.kind)}</dd>`)
  rows.push(`<dt>time</dt><dd>${esc(dt)}</dd>`)
  if (s.providerAlias) rows.push(`<dt>provider</dt><dd>${esc(s.providerAlias)}</dd>`)
  if (s.file) rows.push(`<dt>sha-256</dt><dd class="hash">${esc(s.file.sha256)}</dd>`)
  if (s.vantage) rows.push(`<dt>vantage</dt><dd>${esc(formatLatLng(s.vantage.lat, s.vantage.lng))} / ${esc(formatBearing(s.vantage.bearingDeg))}${s.vantage.coarsened ? ' (approx)' : ''}</dd>`)
  if (s.subject) rows.push(`<dt>subject</dt><dd>${esc(formatLatLng(s.subject.lat, s.subject.lng))}${s.subject.coarsened ? ' (approx)' : ''}</dd>`)
  if (s.link) {
    rows.push(`<dt>link</dt><dd class="hash">${esc(s.link.url)}</dd>`)
    if (s.link.archivedUrl) rows.push(`<dt>archived</dt><dd class="hash">${esc(s.link.archivedUrl)}</dd>`)
    if (s.link.archivedSha256) rows.push(`<dt>snapshot</dt><dd class="hash">sha256:${esc(s.link.archivedSha256)}</dd>`)
  }
  if (s.rights) rows.push(`<dt>rights</dt><dd>${esc(s.rights)}</dd>`)

  return `<article class="exhibit" data-ex="${esc(s.id)}" data-id="${esc(s.id)}">
    <div class="ex-head"><span class="ex-label">${label}</span><span class="ex-title"${dirAttr(s.title)}>${esc(s.title)}</span></div>
    ${thumb}
    <dl class="ex-meta">${rows.join('')}</dl>
    ${s.note ? `<p class="ex-note">${esc(s.note)}</p>` : ''}
  </article>`
}

function chronologyRows(pub: PublicProject, idToLabel: Map<string, string>): string {
  interface Row { sort: number; time: string; label: string; tag: string; dir: string }
  const rows: Row[] = []
  for (const s of pub.sources) {
    if (!s.datetime) continue
    const t = Date.parse(s.datetime.value)
    rows.push({
      sort: Number.isNaN(t) ? 0 : t,
      time: formatDateTime(s.datetime.value, s.datetime.precision),
      label: s.title,
      tag: idToLabel.get(s.id) ?? s.kind,
      dir: dirOf(s.title),
    })
  }
  for (const f of pub.findings) {
    if (!f.at?.time) continue
    const t = Date.parse(f.at.time)
    rows.push({
      sort: Number.isNaN(t) ? 0 : t,
      time: formatInstant(f.at.time),
      label: f.statement,
      tag: 'Finding',
      dir: dirOf(f.statement),
    })
  }
  rows.sort((a, b) => a.sort - b.sort)
  if (rows.length === 0) return '<p class="muted">No dated items.</p>'
  return `<ol class="chrono">${rows
    .map(
      (r) =>
        `<li><span class="chrono-time">${esc(r.time)}</span><span class="chrono-tag">${esc(r.tag)}</span><span class="chrono-label" dir="${r.dir}">${esc(r.label)}</span></li>`,
    )
    .join('')}</ol>`
}

/**
 * The clock alignment, recomputed from the published readings alone so the
 * artifact reproduces from itself. Shows each synced source, each event's
 * time, any reading the published evidence cannot accommodate, and where a
 * source's own claimed time disagrees with the synced one.
 */
function clockSection(pub: PublicProject, idToLabel: Map<string, string>): string {
  if (!pub.syncEvents.length) return ''
  const sol = solveClocks(pub)
  const hms = (sec: number) => new Date(sec * 1000).toISOString().slice(11, 21)
  const titleOf = (id: string) => pub.sources.find((x) => x.id === id)?.title ?? id
  const rows = Object.values(sol.sources)
    .map((c) => {
      const s = pub.sources.find((x) => x.id === c.sourceId)
      const anchor = s?.clock?.anchor
      const when = c.anchored
        ? `<span class="mono">${hms(c.startSec)}</span> UTC &plusmn; ${c.sigmaSec.toFixed(1)} s`
        : `floating, ${esc(formatSec(c.startSec))} after ${esc(titleOf(c.refSourceId!))}`
      const basis = anchor ? `<div class="muted">Anchor: ${esc(anchor.basis || 'stated start')}</div>` : ''
      const claim =
        c.claimConflict && s?.datetime
          ? `<div class="clock-flag">Claimed ${esc(formatInstant(s.datetime.value))}; the synced start disagrees.</div>`
          : ''
      return `<tr><td>${esc(idToLabel.get(c.sourceId) ?? '')}</td><td${dirAttr(titleOf(c.sourceId))}>${esc(titleOf(c.sourceId))}${basis}${claim}</td><td>${when}</td></tr>`
    })
    .join('')
  const events = pub.syncEvents
    .map((e) => {
      const t = sol.events[e.id]
      const when = t?.anchored ? `<span class="mono">${hms(t.timeSec)}</span> &plusmn; ${t.sigmaSec.toFixed(1)} s` : 'floating'
      const flags = sol.residuals.filter((r) => r.eventId === e.id && r.flagged)
      const flag = flags.length
        ? `<div class="clock-flag">${
            flags[0].ambiguous
              ? `Its two readings disagree with the other events by ${Math.abs(flags[0].residualSec).toFixed(1)} s; one is off, and the published evidence cannot say which.`
              : flags.map((r) => `The reading in ${esc(titleOf(r.sourceId))} disagrees by ${Math.abs(r.residualSec).toFixed(1)} s and is set aside.`).join(' ')
          }</div>`
        : ''
      const zone = originZones(pub).find((z) => z.eventId === e.id)
      const zoneNote =
        zone && !zone.empty && zone.wedges > 1
          ? `<div class="muted">Zone of possible origin: ${Math.round(zone.areaM2).toLocaleString('en')} m&sup2;, from ${zone.wedges} bearing bands.</div>`
          : ''
      return `<tr><td>${esc(e.kind)}</td><td${dirAttr(e.label)}>${esc(e.label)}${flag}${zoneNote}</td><td>${when}</td></tr>`
    })
    .join('')
  return `<section class="block">
  <h2 class="block-label">Clock alignment</h2>
  <p class="muted">The sources below are placed on one clock from moments they share, by weighted least squares, recomputed from the published readings only. A source no anchor reaches is aligned only relative to the others. Plus or minus values are one standard error.</p>
  <table class="clock-table"><tbody>${rows}</tbody></table>
  <table class="clock-table"><tbody>${events}</tbody></table>
</section>`
}

function formatSec(sec: number): string {
  const a = Math.abs(sec)
  const m = Math.floor(a / 60)
  const s = (a % 60).toFixed(1).padStart(4, '0')
  return `${sec < 0 ? '-' : ''}${m}:${s}`
}

export function buildPublishedHtml(pub: PublicProject): string {
  const idToLabel = new Map<string, string>()
  pub.sources.forEach((s, i) => idToLabel.set(s.id, exhibitLabel(i)))

  const title = pub.incident.titles[0]?.text ?? 'Investigation'
  const titlesHtml = pub.incident.titles
    .map(
      (t, i) =>
        `<h1 class="${i === 0 ? 'title' : 'title-alt'}"${dirAttr(t.text)}>${esc(t.text)}</h1>`,
    )
    .join('')

  const windowStr =
    pub.incident.window.start || pub.incident.window.end
      ? `${pub.incident.window.start ? formatDateTime(pub.incident.window.start, pub.incident.window.precision) : '?'} to ${pub.incident.window.end ? formatDateTime(pub.incident.window.end, pub.incident.window.precision) : '?'}`
      : 'time window not set'

  const findingsHtml = pub.findings.length
    ? pub.findings
        .map((f) => {
          const cites = f.supportedBy
            .map((id) => idToLabel.get(id))
            .filter(Boolean)
            .join(', ')
          return `<article class="finding f-${f.certainty}" data-id="${esc(f.id)}">
            <p class="f-statement"${dirAttr(f.statement)}>${esc(f.statement)}</p>
            <div class="f-meta"><span class="f-cert">${esc(f.certainty.charAt(0).toUpperCase() + f.certainty.slice(1))}</span><span class="f-cite">Cites ${esc(cites || 'no source')}</span></div>
          </article>`
        })
        .join('')
    : '<p class="muted">No publishable findings.</p>'

  const redactions = redactionLines(pub.redactions)
    .map((l) => `<li>${esc(l)}</li>`)
    .join('')

  const generated = pub.generatedAt ? esc(pub.generatedAt) : ''

  return `<!doctype html>
<html lang="${dirOf(title) === 'rtl' ? 'ar' : 'en'}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(title)}</title>
<style>${PUBLISHED_CSS}</style>
</head>
<body>
<header class="head"><div class="head-inner">
  <div class="kicker">A consent-cleared investigation</div>
  ${titlesHtml}
  <div class="head-meta">
    <span class="tag">${esc(pub.incident.type.charAt(0).toUpperCase() + pub.incident.type.slice(1).replace(/-/g, ' '))}</span>
    <span class="mono">${esc(windowStr)}</span>
    ${pub.incident.place?.name ? `<span class="mono">${esc(pub.incident.place.name)}</span>` : ''}
  </div>
  ${pub.incident.summary ? `<p class="summary">${esc(pub.incident.summary)}</p>` : ''}
</div></header>
<main class="page">

<section class="block">
  <h2 class="block-label">Site</h2>
  ${buildSvgMap(pub)}
  <div class="legend">
    <span><i class="sw sw-vantage"></i>Vantage</span>
    <span><i class="sw sw-subject"></i>Subject</span>
    <span><i class="sw sw-cross"></i>Crossing</span>
    <span><i class="sw sw-place"></i>Incident</span>
  </div>
</section>

<section class="block">
  <h2 class="block-label">Chronology</h2>
  ${chronologyRows(pub, idToLabel)}
</section>

${clockSection(pub, idToLabel)}

<section class="block">
  <h2 class="block-label">Findings</h2>
  ${findingsHtml}
</section>

<section class="block">
  <h2 class="block-label">Sources</h2>
  <div class="exhibits">
    ${pub.sources.map((s, i) => exhibitCard(s, i)).join('')}
  </div>
</section>

<section class="block disclosure">
  <h2 class="block-label">Consent disclosure</h2>
  <p>This investigation passed through the ${esc(APP_NAME)} consent boundary before publication.</p>
  <ul class="redactions">${redactions}</ul>
</section>

<footer class="foot">
  <p class="disclaimer">${esc(DISCLAIMER)}</p>
  <p class="mono">Produced with ${esc(APP_NAME)} (${esc(SUITE_NAME)}) by ${esc(AUTHOR.name)}, ${esc(AUTHOR.affiliation)}. ${generated ? 'Generated ' + generated + '.' : ''}</p>
</footer>
</main>

<script>
(function(){
  function all(id){return document.querySelectorAll('[data-id="'+id+'"]')}
  document.querySelectorAll('[data-ex]').forEach(function(n){
    var id=n.getAttribute('data-ex'); if(!id) return;
    n.addEventListener('mouseenter',function(){all(id).forEach(function(e){e.classList.add('hi')})});
    n.addEventListener('mouseleave',function(){all(id).forEach(function(e){e.classList.remove('hi')})});
  });
})();
</script>
</body>
</html>`
}

const PUBLISHED_CSS = `
@font-face{font-family:'Syne';src:url(${syneFont}) format('woff2');font-weight:400 800;font-display:swap}
:root{--field:#ead2f7;--violet:#5a1666;--mark:#c2185b;--ink:#160b18;--t2:#4b3b4f;--t3:#66546b;--line:#e6d4ee;--line2:#d8bfe5;--paper:#ffffff;--paper2:#fbf7fd;--alert:#b3261e;--subject:#5a1666}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--paper);color:var(--ink);font-family:'Syne','Helvetica Neue',Arial,sans-serif;line-height:1.55;font-size:15px}
.page{max-width:980px;margin:0 auto;padding:0 24px 80px}
.mono,.hash,.chrono-time,.head-meta .mono{font-family:'SF Mono',Menlo,Consolas,ui-monospace,monospace;font-size:.92em}
[dir=rtl]{font-family:'Noto Naskh Arabic','Syne',serif}
.head{background:var(--field);margin-bottom:32px;padding:44px 24px 30px}
.head-inner{max-width:932px;margin:0 auto}
.kicker{font-size:14px;color:var(--t2);margin-bottom:10px}
.title{font-size:34px;line-height:1.12;font-weight:700;letter-spacing:-.01em;margin-bottom:6px}
.title-alt{font-size:22px;font-weight:500;color:var(--t2);margin-bottom:4px}
.head-meta{display:flex;gap:14px;flex-wrap:wrap;margin:14px 0 0;color:var(--t2);font-size:14px;align-items:center}
.tag{background:var(--paper);border-radius:4px;padding:1px 8px;font-size:13px;color:var(--t2)}
.summary{color:var(--t2);max-width:70ch;margin-top:10px}
.block{margin:40px 0}
.m-zone{fill:rgba(194,24,91,.18);stroke:var(--mark);stroke-width:1.5}
.clock-table{width:100%;border-collapse:collapse;margin-top:12px;font-size:14px}
.clock-table td{border-top:1px solid var(--line);padding:8px;vertical-align:top}
.clock-table td:first-child{font-size:13px;color:var(--t3);white-space:nowrap}
.clock-table td:last-child{white-space:nowrap}
.clock-flag{color:var(--alert);font-size:13px;margin-top:3px}
.block-label{font-size:22px;font-weight:700;letter-spacing:-.01em;color:var(--ink);border-bottom:2px solid var(--violet);padding-bottom:8px;margin-bottom:18px}
.sitemap{width:100%;height:auto;background:var(--paper2);border-radius:8px}
.map-empty{padding:30px;background:var(--paper2);color:var(--t3);text-align:center;border-radius:8px}
.m-frame{fill:none;stroke:var(--line2)}
.m-grid{stroke:var(--line);stroke-width:1}
.m-ray{stroke:rgba(90,22,102,.45);stroke-width:1.4}
.m-ray.hi{stroke:var(--mark);stroke-width:2.4}
.marker{stroke:var(--ink);stroke-width:1.5}
.m-vantage{fill:#fff}
.m-subject{fill:var(--subject);stroke:#fff}
.m-place{fill:none;stroke:var(--t2);stroke-width:1.5}
.m-cross{fill:var(--mark);stroke:#fff;stroke-width:1}
.m-cross-ring{fill:none;stroke:rgba(194,24,91,.45);stroke-width:1.5}
.marker.hi{stroke:var(--mark);stroke-width:2.5}
.legend{display:flex;gap:16px;flex-wrap:wrap;margin-top:12px;color:var(--t2);font-size:13px}
.legend i{display:inline-block;width:10px;height:10px;margin-right:6px;vertical-align:middle;border-radius:50%}
.sw-vantage{background:#fff;border:2px solid var(--ink)}.sw-subject{background:var(--subject)}.sw-cross{background:var(--mark)}.sw-place{background:transparent;border:2px solid var(--t2)}
.chrono{list-style:none}
.chrono li{display:flex;gap:16px;align-items:baseline;padding:9px 0;border-bottom:1px solid var(--line)}
.chrono-time{color:var(--ink);min-width:170px}
.chrono-tag{font-size:13px;color:var(--t3);min-width:76px}
.chrono-label{flex:1}
.finding{border-left:3px solid var(--line2);padding:8px 0 8px 16px;margin-bottom:16px}
.finding.f-attested{border-left-color:var(--mark)}
.finding.f-probable{border-left-color:var(--violet)}
.finding.f-uncertain{border-left-color:var(--line2)}
.finding.hi{background:var(--paper2)}
.f-statement{font-size:17px;line-height:1.45}
.f-meta{display:flex;gap:12px;margin-top:6px;font-size:13px;color:var(--t3)}
.f-cert{color:var(--ink);font-weight:600}
.exhibits{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px}
.exhibit{border:1px solid var(--line2);border-radius:8px;background:var(--paper);padding:14px;transition:border-color .12s}
.exhibit.hi{border-color:var(--violet)}
.ex-head{display:flex;gap:10px;align-items:baseline;margin-bottom:10px}
.ex-label{font-size:13px;color:var(--t3);white-space:nowrap}
.ex-title{font-weight:600}
.ex-img{width:100%;height:auto;max-height:200px;object-fit:cover;border-radius:6px;margin-bottom:10px;display:block}
.ex-meta{display:grid;grid-template-columns:auto 1fr;gap:3px 12px;font-size:13px}
.ex-meta dt{color:var(--t3)}
.hash{font-size:11px;color:var(--t2);word-break:break-all}
.ex-note{margin-top:8px;color:var(--t2);font-size:14px}
.disclosure{background:var(--paper2);border-left:3px solid var(--violet);border-radius:0 8px 8px 0;padding:16px 18px}
.redactions{margin-top:8px;padding-left:18px;color:var(--t2);font-size:14px}
.muted{color:var(--t3)}
.foot{margin-top:56px;border-top:1px solid var(--line2);padding-top:18px;color:var(--t3);font-size:13px}
.disclaimer{color:var(--t2);margin-bottom:8px;max-width:70ch}
a{color:inherit;text-decoration-color:var(--mark);text-underline-offset:3px}
a:hover{color:var(--mark)}
@media print{
  .head{background:none;margin:0 0 24px;padding:0 0 16px;border-bottom:2px solid var(--violet)}
  .exhibit,.disclosure,.finding{break-inside:avoid}
  a,script{display:initial}
}
`
