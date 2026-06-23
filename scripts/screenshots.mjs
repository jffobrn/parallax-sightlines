/**
 * Generate the documentation screenshots into docs/images/.
 *
 * It drives the built app in headless Chrome and captures the reconstruction,
 * the editors, the publish dialog, and the published artifact.
 * Requires `puppeteer-core` (a dev dependency) and a local Chrome/Chromium.
 *
 * Usage:
 *   npm run build
 *   python3 -m http.server 8099 -d dist
 *   CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
 *     node scripts/screenshots.mjs http://localhost:8099
 */

import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import puppeteer from 'puppeteer-core'

const URL_BASE = process.argv[2] || 'http://localhost:8099'
const CHROME =
  process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'images')
mkdirSync(OUT, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function selectRow(page, source) {
  await page.evaluate((src) => {
    const rx = new RegExp(src, 'i')
    const row = [...document.querySelectorAll('.rail .row, .row')].find((r) => rx.test(r.textContent || ''))
    if (!row) throw new Error('row not found: ' + src)
    row.click()
  }, source)
}

async function clickTopbar(page, source) {
  await page.evaluate((src) => {
    const rx = new RegExp(src, 'i')
    const b = [...document.querySelectorAll('.topbar button')].find((e) => rx.test(e.textContent || ''))
    if (!b) throw new Error('button not found: ' + src)
    b.click()
  }, source)
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: [
    '--no-sandbox', '--disable-setuid-sandbox',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--disable-dev-shm-usage', '--user-data-dir=/tmp/slchrome', '--window-size=1400,900',
  ],
})

const page = await browser.newPage()
await page.setViewport({ width: 1400, height: 880, deviceScaleFactor: 2 })
await page.goto(URL_BASE, { waitUntil: 'networkidle0', timeout: 60000 })
await page.waitForSelector('.topbar', { timeout: 30000 })
await page.evaluate(() => window.dispatchEvent(new Event('resize'))) // nudge the map to paint
await sleep(5000)

const shot = async (name) => {
  await page.screenshot({ path: join(OUT, name) })
  console.log('wrote', name)
}

// 1. The whole reconstruction: rail, the resection on the map, inspector, timeline.
await shot('01-overview.png')

// 2. A source selected: the source editor, with the private-field labels and the
//    highlighted vantage ray.
await selectRow(page, 'south-west station')
await sleep(1200)
await shot('02-source-editor.png')

// 3. A finding selected: the finding editor and its cited sources.
await selectRow(page, 'separate vantages')
await sleep(1000)
await shot('03-finding.png')

// 4. The publish dialog: what crosses the consent boundary.
await clickTopbar(page, '^Publish$')
await page.waitForSelector('.publish-grid', { timeout: 30000 })
await sleep(2500)
await shot('04-publish-dialog.png')

// 5. The published artifact itself, rendered standalone.
const html = await page.$eval('.publish-frame', (f) => f.getAttribute('srcdoc'))
const art = await browser.newPage()
await art.setViewport({ width: 1040, height: 1100, deviceScaleFactor: 2 })
await art.setContent(html, { waitUntil: 'networkidle0' })
await sleep(800)
await art.screenshot({ path: join(OUT, '05-published-artifact.png') })
console.log('wrote 05-published-artifact.png')

await browser.close()
console.log('done')
