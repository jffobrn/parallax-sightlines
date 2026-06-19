/**
 * Apparatus formatting (shared core): coordinates, bearings, hashes, bytes,
 * and per-string text direction. These render the monospace "instrument"
 * readouts that give the suite its forensic register.
 */

const CARDINALS_16 = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
]

export function cardinal(bearingDeg: number): string {
  if (!Number.isFinite(bearingDeg)) return ''
  const i = Math.round(((((bearingDeg % 360) + 360) % 360) / 22.5)) % 16
  return CARDINALS_16[i]
}

export function formatBearing(bearingDeg: number): string {
  if (!Number.isFinite(bearingDeg)) return '---'
  const d = ((bearingDeg % 360) + 360) % 360
  return `${d.toFixed(0).padStart(3, '0')}° ${cardinal(d)}`
}

export function formatLat(lat: number, decimals = 5): string {
  const h = lat >= 0 ? 'N' : 'S'
  return `${Math.abs(lat).toFixed(decimals)}°${h}`
}

export function formatLng(lng: number, decimals = 5): string {
  const h = lng >= 0 ? 'E' : 'W'
  return `${Math.abs(lng).toFixed(decimals)}°${h}`
}

export function formatLatLng(lat: number, lng: number, decimals = 5): string {
  return `${formatLat(lat, decimals)} ${formatLng(lng, decimals)}`
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Per-string direction: 'rtl' if the first strong-directional character is in an
 * RTL script (Arabic, Hebrew, Syriac, Thaana), else 'ltr'. The suite decides
 * direction per string, not per document, so a mixed list renders correctly.
 */
export function dirOf(text: string): 'rtl' | 'ltr' {
  const rtl = /[\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Syriac}\p{Script=Thaana}]/u
  const ltr = /[A-Za-z]/
  for (const ch of text) {
    if (rtl.test(ch)) return 'rtl'
    if (ltr.test(ch)) return 'ltr'
  }
  return 'ltr'
}
