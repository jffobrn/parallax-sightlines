/**
 * Time without false precision (shared core).
 *
 * A datetime is a value plus the precision it was actually known to. The
 * timeline and the published chronology show that precision as a span, never a
 * false point: an event known only to the day is drawn across the whole day,
 * an "approximate" time as a wider fuzzy band.
 */

import type { TimePrecision } from './types'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function parseTime(value?: string): number {
  if (!value) return NaN
  const t = Date.parse(value)
  return Number.isNaN(t) ? NaN : t
}

/** The [start, end] span (ms) implied by a value and its precision. */
export function timeInterval(
  value: string,
  precision: TimePrecision,
): { start: number; end: number } | null {
  const t = parseTime(value)
  if (Number.isNaN(t)) return null
  // Floor to the precision boundary (epoch ms are UTC-aligned) so the band shows
  // the true uncertainty window: a "day" event spans its whole calendar day,
  // regardless of the time of day stored on the value.
  const floor = (unit: number) => t - ((t % unit) + unit) % unit
  switch (precision) {
    case 'minute':
      return { start: floor(MINUTE), end: floor(MINUTE) + MINUTE }
    case 'hour':
      return { start: floor(HOUR), end: floor(HOUR) + HOUR }
    case 'day':
      return { start: floor(DAY), end: floor(DAY) + DAY }
    case 'approximate':
      return { start: t - DAY / 2, end: t + DAY / 2 }
  }
}

const PRECISION_LABEL: Record<TimePrecision, string> = {
  minute: 'to the minute',
  hour: 'to the hour',
  day: 'to the day',
  approximate: 'approximate',
}

export function precisionLabel(p: TimePrecision): string {
  return PRECISION_LABEL[p]
}

/** Human-readable datetime honouring its precision. UTC, to stay deterministic. */
export function formatDateTime(value: string, precision: TimePrecision): string {
  const t = parseTime(value)
  if (Number.isNaN(t)) return value
  const d = new Date(t)
  const date = d.toISOString().slice(0, 10)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  switch (precision) {
    case 'minute':
      return `${date} ${hh}:${mm} UTC`
    case 'hour':
      return `${date} ${hh}:00 UTC`
    case 'day':
      return date
    case 'approximate':
      return `around ${date}`
  }
}

/** Compact form for dense rows. */
export function formatDateTimeShort(value: string, precision: TimePrecision): string {
  const t = parseTime(value)
  if (Number.isNaN(t)) return value
  const d = new Date(t)
  const date = d.toISOString().slice(0, 10)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  if (precision === 'day') return date
  if (precision === 'approximate') return `~${date}`
  if (precision === 'hour') return `${date} ${hh}:00`
  return `${date} ${hh}:${mm}`
}
