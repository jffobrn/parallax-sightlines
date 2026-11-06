/**
 * Smoke test: drive the built app headless and fail on anything that should
 * never reach Pages. It loads the app, visits every stage view, selects a
 * rail row, publishes, probes the published artifact for the sample's private
 * strings (scripts/smoke-probes.json), then checks New, Reset, and that the
 * project survives a reload. Any uncaught page error fails the run.
 *
 * The same file runs in every Parallax tool; only the probe list differs.
 *
 * Usage:
 *   npm run build
 *   python3 -m http.server 8099 -d dist &
 *   node scripts/smoke.mjs http://localhost:8099/
 *
 * CHROME may point at a Chrome or Chromium binary (defaults to macOS Chrome).
 */

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const HERE = dirname(fileURLToPath(import.meta.url))
const URL_BASE = process.argv[2] || 'http://localhost:8099/'
const CHROME =
  process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PROBES = JSON.parse(readFileSync(join(HERE, 'smoke-probes.json'), 'utf8'))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const pageErrors = []
let failed = false
const check = (name, pass, detail = '') => {
  results.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`)
  if (!pass) failed = true
}

// A probe that no longer appears in the sample proves nothing; warn so the
// list is refreshed when the sample changes. Numeric probes are skipped: a
// sample may compute a protected coordinate rather than write it out.
const sampleDir = join(HERE, '..', 'src', 'sample')
const sampleSrc = readdirSync(sampleDir)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => readFileSync(join(sampleDir, f), 'utf8'))
  .join('\n')
const stale = PROBES.filter((p) => !/^-?\d+(\.\d+)?$/.test(p) && !sampleSrc.includes(p))
if (stale.length) console.warn(`warn: ${stale.length} probe(s) not found in the sample: ${stale.join(' | ')}`)

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: [
    '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--window-size=1400,900',
  ],
})
const page = await browser.newPage()
await page.setViewport({ width: 1400, height: 880 })
page.on('pageerror', (e) => pageErrors.push(e.message.slice(0, 200)))

const clickIn = (scope, pattern) =>
  page.evaluate((scope, src) => {
    const re = new RegExp(src, 'i')
    const el = [...document.querySelectorAll(scope)].find((e) => re.test((e.textContent || '').trim()))
    if (!el) return false
    el.click()
    return true
  }, scope, pattern.source)
const readout = () =>
  page.evaluate(() => (document.querySelector('.readout')?.textContent || '').replace(/\s+/g, ' ').trim())
const strip = (s) => s.replace(/(Reset to the sample|New blank [a-z]+)\.?/i, '').trim().slice(0, 40)

try {
  await page.goto(URL_BASE, { waitUntil: 'networkidle2', timeout: 90000 })
  await page.waitForSelector('.topbar', { timeout: 60000 })
  await sleep(2500)
  const r0 = await readout()
  check('sample loads', /[1-9]/.test(r0), r0.slice(0, 60))

  // Every stage view, including the maps.
  const stageSel = '.stage-switch button, [role=group][aria-label^="stage"] button'
  const stages = await page.evaluate((sel) => [...document.querySelectorAll(sel)].map((b) => b.textContent.trim()), stageSel)
  for (const s of stages) {
    const before = pageErrors.length
    await clickIn(stageSel, new RegExp('^' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'))
    await sleep(2000)
    check(`stage: ${s}`, pageErrors.length === before)
  }

  const row = await page.evaluate(() => {
    const r = document.querySelector('.rail .row')
    if (!r) return false
    r.click()
    return true
  })
  await sleep(600)
  check('rail row selects', row)

  // Publish and probe the artifact. Tools without a preview frame publish by
  // download; capture that instead.
  await page.evaluate(() => {
    window.__smokeCaptured = []
    const orig = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (b) => {
      if (b instanceof Blob) b.text().then((t) => window.__smokeCaptured.push(t))
      return orig(b)
    }
  })
  await clickIn('.topbar button', /^publish$/)
  await sleep(4500)
  let artifact = await page.evaluate(() => {
    const f = [...document.querySelectorAll('iframe')].find((x) => x.srcdoc && x.srcdoc.length > 1000)
    return f ? f.srcdoc : ''
  })
  if (!artifact) {
    await page.evaluate(() => [...document.querySelectorAll('[role=dialog] .btn-primary')].pop()?.click())
    await sleep(2500)
    artifact = await page.evaluate(() => window.__smokeCaptured.find((t) => /<html|<!doctype/i.test(t)) || '')
  }
  check('publish builds an artifact', artifact.length > 1000, `${artifact.length} bytes`)
  const leaks = PROBES.filter((p) => artifact.includes(p))
  check('consent boundary holds', leaks.length === 0, leaks.length ? `LEAKED: ${leaks.join(' | ')}` : `${PROBES.length} probes clean`)
  await page.keyboard.press('Escape')
  await sleep(500)

  if (await clickIn('.topbar button', /^new$/)) {
    await sleep(300)
    await clickIn('.topbar button', /^confirm new$/)
    await sleep(1500)
    check('New empties', /\b0\b/.test(await readout()))
  }
  await clickIn('.topbar button', /^reset$/)
  await sleep(300)
  await clickIn('.topbar button', /^confirm reset$/)
  await sleep(2500)
  check('Reset restores the sample', strip(await readout()) === strip(r0))

  await sleep(800)
  await page.reload({ waitUntil: 'networkidle2', timeout: 90000 })
  await page.waitForSelector('.topbar', { timeout: 60000 })
  await sleep(2000)
  check('project persists across reload', strip(await readout()) === strip(r0))
} catch (e) {
  check('smoke run completes', false, e.message.slice(0, 200))
}
check('no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '))
await browser.close()

console.log(results.join('\n'))
process.exit(failed ? 1 : 0)
