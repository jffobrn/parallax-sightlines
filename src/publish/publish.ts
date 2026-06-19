/**
 * Build the published investigation: one self-contained, static HTML file with
 * the map, chronology, exhibits, and findings, plus the consent disclosure. It
 * takes a PublicProject (already through the consent boundary) and never reaches
 * back to the full project, so nothing sensitive can appear here. The same file
 * is the screen artifact and, via print CSS, the print dossier.
 */

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
  return `EX-${index + 1}`
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
      tag: 'FINDING',
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
            <div class="f-meta"><span class="f-cert">${esc(f.certainty)}</span><span class="f-cite">cites ${esc(cites || 'none')}</span></div>
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
<header class="head">
  <div class="kicker">CONSENT-CLEARED INVESTIGATION</div>
  ${titlesHtml}
  <div class="head-meta">
    <span class="tag">${esc(pub.incident.type)}</span>
    <span class="mono">${esc(windowStr)}</span>
    ${pub.incident.place?.name ? `<span class="mono">${esc(pub.incident.place.name)}</span>` : ''}
  </div>
  ${pub.incident.summary ? `<p class="summary">${esc(pub.incident.summary)}</p>` : ''}
</header>

<section class="block">
  <h2 class="block-label">Site</h2>
  ${buildSvgMap(pub)}
  <div class="legend mono">
    <span><i class="sw sw-vantage"></i>vantage</span>
    <span><i class="sw sw-subject"></i>subject</span>
    <span><i class="sw sw-cross"></i>crossing</span>
    <span><i class="sw sw-place"></i>incident</span>
  </div>
</section>

<section class="block">
  <h2 class="block-label">Chronology</h2>
  ${chronologyRows(pub, idToLabel)}
</section>

<section class="block">
  <h2 class="block-label">Findings</h2>
  ${findingsHtml}
</section>

<section class="block">
  <h2 class="block-label">Exhibits</h2>
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
:root{--bg:#07090c;--bg1:#0c0f14;--bg2:#11151c;--line:#1b212b;--line2:#27303c;--text:#e7ebf0;--t2:#a7b0bd;--t3:#6f7989;--signal:#f3a93c;--signalb:#ffc163;--subject:#7fa8bf;--vantage:#d8d2c0;--alert:#e5544b;}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:'Archivo',system-ui,sans-serif;line-height:1.55;padding:40px 24px 80px;max-width:980px;margin:0 auto;font-size:14px}
.mono,.hash,.chrono-time,.head-meta .mono{font-family:'Spline Sans Mono',ui-monospace,monospace}
[dir=rtl]{font-family:'Noto Naskh Arabic','Archivo',serif}
.kicker{font-family:'Spline Sans Mono',monospace;font-size:11px;letter-spacing:.18em;color:var(--signal);margin-bottom:10px}
.title{font-size:30px;line-height:1.15;font-weight:600;margin-bottom:4px}
.title-alt{font-size:20px;font-weight:500;color:var(--t2);margin-bottom:4px}
.head{border-bottom:1px solid var(--line2);padding-bottom:20px;margin-bottom:28px}
.head-meta{display:flex;gap:14px;flex-wrap:wrap;margin:12px 0;color:var(--t3);font-size:12px;align-items:center}
.tag{border:1px solid var(--line2);border-radius:2px;padding:2px 8px;font-family:'Spline Sans Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--t2)}
.summary{color:var(--t2);max-width:70ch;margin-top:8px}
.block{margin:34px 0}
.block-label{font-family:'Spline Sans Mono',monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--t3);border-bottom:1px solid var(--line);padding-bottom:8px;margin-bottom:16px;font-weight:500}
.sitemap{width:100%;height:auto;background:var(--bg1);border:1px solid var(--line2);border-radius:4px}
.map-empty{padding:30px;border:1px dashed var(--line2);color:var(--t3);text-align:center;border-radius:4px}
.m-frame{fill:none;stroke:var(--line2)}
.m-grid{stroke:var(--line);stroke-width:1}
.m-ray{stroke:rgba(216,210,192,.5);stroke-width:1.4}
.m-ray.hi{stroke:var(--signalb);stroke-width:2.4}
.marker{stroke:#0a0c10;stroke-width:1.5}
.m-vantage{fill:var(--vantage)}
.m-subject{fill:var(--subject)}
.m-place{fill:none;stroke:var(--t2);stroke-width:1.5}
.m-cross{fill:var(--signal);stroke:#0a0c10;stroke-width:1}
.m-cross-ring{fill:none;stroke:rgba(243,169,60,.5);stroke-width:1.5}
.marker.hi{stroke:var(--signalb);stroke-width:2.5}
.legend{display:flex;gap:16px;flex-wrap:wrap;margin-top:10px;color:var(--t3);font-size:11px}
.legend i{display:inline-block;width:9px;height:9px;margin-right:5px;vertical-align:middle;border-radius:50%}
.sw-vantage{background:var(--vantage)}.sw-subject{background:var(--subject)}.sw-cross{background:var(--signal)}.sw-place{background:transparent;border:1.5px solid var(--t2)}
.chrono{list-style:none}
.chrono li{display:flex;gap:14px;align-items:baseline;padding:7px 0;border-bottom:1px solid var(--line)}
.chrono-time{color:var(--signal);min-width:170px;font-size:12px}
.chrono-tag{font-family:'Spline Sans Mono',monospace;font-size:10px;color:var(--t3);min-width:54px}
.chrono-label{flex:1}
.finding{border-left:2px solid var(--line2);padding:6px 0 6px 14px;margin-bottom:14px}
.finding.f-attested{border-left-color:var(--signal)}
.finding.f-probable{border-left-color:var(--t3)}
.finding.f-uncertain{border-left-color:var(--line2);border-left-style:dashed}
.finding.hi{background:rgba(243,169,60,.06)}
.f-statement{font-size:15px}
.f-meta{display:flex;gap:12px;margin-top:5px;font-family:'Spline Sans Mono',monospace;font-size:11px;color:var(--t3);text-transform:uppercase;letter-spacing:.05em}
.f-cert{color:var(--signalb)}
.exhibits{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
.exhibit{border:1px solid var(--line2);border-radius:4px;background:var(--bg1);padding:12px;transition:border-color .12s}
.exhibit.hi{border-color:var(--signal)}
.ex-head{display:flex;gap:8px;align-items:baseline;margin-bottom:8px}
.ex-label{font-family:'Spline Sans Mono',monospace;font-size:11px;color:var(--signal);letter-spacing:.06em}
.ex-title{font-weight:500}
.ex-img{width:100%;height:auto;max-height:200px;object-fit:cover;border-radius:3px;border:1px solid var(--line);margin-bottom:8px;display:block}
.ex-meta{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;font-size:12px}
.ex-meta dt{font-family:'Spline Sans Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--t3)}
.hash{font-family:'Spline Sans Mono',monospace;font-size:10px;color:var(--t3);word-break:break-all}
.ex-note{margin-top:8px;color:var(--t2);font-size:13px}
.disclosure{background:var(--bg1);border:1px solid var(--line2);border-radius:4px;padding:16px}
.redactions{margin-top:8px;padding-left:18px;color:var(--t2);font-size:13px}
.muted{color:var(--t3)}
.foot{margin-top:48px;border-top:1px solid var(--line2);padding-top:18px;color:var(--t3);font-size:12px}
.disclaimer{color:var(--t2);margin-bottom:8px;max-width:70ch}
@media print{
  body{background:#fff;color:#111;max-width:none;padding:0}
  .kicker{color:#7a5300}.title-alt,.summary,.ex-note,.disclaimer{color:#333}
  .sitemap{background:#fff;border-color:#bbb}.m-grid{stroke:#eee}.m-frame{stroke:#ccc}
  .m-ray{stroke:#999}.m-subject{fill:#3a6e8c}.m-cross{fill:#b3700a;stroke:#fff}.m-place{stroke:#555}
  .exhibit,.disclosure{background:#fff;border-color:#ccc;break-inside:avoid}
  .block-label,.chrono-tag,.ex-meta dt,.hash{color:#555}
  .chrono-time,.ex-label{color:#7a5300}.f-cert{color:#7a5300}
  .tag{color:#333;border-color:#bbb}
  a,script{display:initial}
}
`
