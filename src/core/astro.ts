/**
 * Solar geometry (shared core): chronolocation by shadow.
 *
 * A photograph taken outdoors carries a clock in its shadows. Given a location
 * and a date, the sun's azimuth and elevation are fixed for every instant of the
 * day; the direction a shadow falls is the reciprocal of the sun's azimuth. So
 * the bearing of a shadow measured in an image, matched against the computed sun
 * across a candidate day, bounds the time the image could have been made. This is
 * the optical counterpart to crossing sightlines: the sun is a third witness.
 *
 * The position is computed with the NOAA solar-position algorithm (the same one
 * behind the NOAA calculator), accurate to well under a degree, which is finer
 * than any shadow can be read from a photograph. Pure math: no dependency, no
 * network, deterministic for a given (lat, lng, Date).
 */

const RAD = Math.PI / 180
const DEG = 180 / Math.PI

export interface SunPosition {
  /** Compass azimuth of the sun, degrees, 0 = north, clockwise. */
  azimuthDeg: number
  /** Elevation above the horizon, degrees. Negative when the sun is down. */
  elevationDeg: number
}

/** Julian day for a UTC instant. */
function julianDay(date: Date): number {
  return date.getTime() / 86_400_000 + 2440587.5
}

/**
 * The sun's apparent position at a location and instant (UTC), by the NOAA
 * algorithm. Longitude is east-positive.
 */
export interface SolarParams {
  /** Solar declination, degrees. */
  declDeg: number
  /** Equation of time, minutes. */
  eqTimeMin: number
}

/**
 * Solar declination and the equation of time for an instant (NOAA). These are
 * the two quantities both the forward instrument (sun position at a place) and
 * the inverse instrument (the subsolar point and elevation loci) rest on, so they
 * live in one place.
 */
export function solarParams(date: Date): SolarParams {
  const jd = julianDay(date)
  const T = (jd - 2451545.0) / 36525 // Julian century

  let L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360
  if (L0 < 0) L0 += 360
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T)
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T)

  const Mrad = M * RAD
  const C =
    Math.sin(Mrad) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * Mrad) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * Mrad) * 0.000289

  const trueLong = L0 + C
  const omega = 125.04 - 1934.136 * T
  const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega * RAD)

  const seconds = 21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))
  const epsilon0 = 23 + (26 + seconds / 60) / 60
  const epsilon = epsilon0 + 0.00256 * Math.cos(omega * RAD)

  const declDeg = Math.asin(Math.sin(epsilon * RAD) * Math.sin(lambda * RAD)) * DEG

  const y = Math.tan((epsilon / 2) * RAD) ** 2
  const L0rad = L0 * RAD
  const eqTimeMin =
    4 *
    DEG *
    (y * Math.sin(2 * L0rad) -
      2 * e * Math.sin(Mrad) +
      4 * e * y * Math.sin(Mrad) * Math.cos(2 * L0rad) -
      0.5 * y * y * Math.sin(4 * L0rad) -
      1.25 * e * e * Math.sin(2 * Mrad))

  return { declDeg, eqTimeMin }
}

export function sunPosition(lat: number, lng: number, date: Date): SunPosition {
  const { declDeg: decl, eqTimeMin: eqTime } = solarParams(date)

  const utcMinutes =
    date.getUTCHours() * 60 +
    date.getUTCMinutes() +
    date.getUTCSeconds() / 60 +
    date.getUTCMilliseconds() / 60000

  let trueSolarTime = (utcMinutes + eqTime + 4 * lng) % 1440
  if (trueSolarTime < 0) trueSolarTime += 1440

  let ha = trueSolarTime / 4 - 180 // hour angle, degrees
  if (ha < -180) ha += 360

  const latRad = lat * RAD
  const declRad = decl * RAD
  const haRad = ha * RAD

  const cosZen = Math.max(
    -1,
    Math.min(
      1,
      Math.sin(latRad) * Math.sin(declRad) +
        Math.cos(latRad) * Math.cos(declRad) * Math.cos(haRad),
    ),
  )
  const zenith = Math.acos(cosZen) // radians
  const elevationDeg = 90 - zenith * DEG

  let azimuthDeg: number
  const denom = Math.cos(latRad) * Math.sin(zenith)
  if (Math.abs(denom) < 1e-9) {
    azimuthDeg = elevationDeg > 0 ? 180 : 0
  } else {
    let cosAz = (Math.sin(latRad) * Math.cos(zenith) - Math.sin(declRad)) / denom
    cosAz = Math.max(-1, Math.min(1, cosAz))
    const az = Math.acos(cosAz) * DEG // 0..180, measured from north
    azimuthDeg = ha > 0 ? (az + 180) % 360 : (540 - az) % 360
  }

  return { azimuthDeg, elevationDeg }
}

/** The compass bearing a shadow points, given the sun's azimuth (reciprocal). */
export function shadowBearing(sunAzimuthDeg: number): number {
  return (sunAzimuthDeg + 180) % 360
}

/** Smallest absolute difference between two bearings, 0..180. */
export function bearingDelta(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360) + 360) % 360
  return d > 180 ? 360 - d : d
}

export interface SunDaySample {
  /** Minutes past UTC midnight on the sampled date. */
  minute: number
  /** ISO instant of the sample. */
  iso: string
  azimuthDeg: number
  elevationDeg: number
  /** Shadow bearing, only meaningful while the sun is up. */
  shadowBearingDeg: number
}

/** Parse an ISO day (YYYY-MM-DD or full ISO) to its UTC midnight ms. */
export function dayStartMs(dateIso: string): number {
  const day = dateIso.slice(0, 10)
  const t = Date.parse(`${day}T00:00:00Z`)
  return Number.isNaN(t) ? NaN : t
}

/**
 * Sweep the sun across a UTC day at a location, one sample per `stepMin` minutes.
 * Used to draw the day's sun path and to search for shadow matches.
 */
export function sunDay(
  lat: number,
  lng: number,
  dateIso: string,
  stepMin = 5,
): SunDaySample[] {
  const start = dayStartMs(dateIso)
  if (Number.isNaN(start)) return []
  const out: SunDaySample[] = []
  for (let m = 0; m <= 1440; m += stepMin) {
    const d = new Date(start + m * 60_000)
    const p = sunPosition(lat, lng, d)
    out.push({
      minute: m,
      iso: d.toISOString(),
      azimuthDeg: p.azimuthDeg,
      elevationDeg: p.elevationDeg,
      shadowBearingDeg: shadowBearing(p.azimuthDeg),
    })
  }
  return out
}

export interface SunEvents {
  /** Solar-noon instant (highest elevation) for the day, ISO, or null. */
  noonIso: string | null
  noonElevationDeg: number
  /** Approximate sunrise / sunset instants (elevation crosses 0), ISO or null. */
  sunriseIso: string | null
  sunsetIso: string | null
}

/** Sunrise, solar noon, and sunset for a day at a location (minute resolution). */
export function sunEvents(lat: number, lng: number, dateIso: string): SunEvents {
  const samples = sunDay(lat, lng, dateIso, 1)
  let noon: SunDaySample | null = null
  let sunrise: string | null = null
  let sunset: string | null = null
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]
    if (!noon || s.elevationDeg > noon.elevationDeg) noon = s
    if (i > 0) {
      const prev = samples[i - 1]
      if (prev.elevationDeg < 0 && s.elevationDeg >= 0 && !sunrise) sunrise = s.iso
      if (prev.elevationDeg >= 0 && s.elevationDeg < 0 && !sunset) sunset = s.iso
    }
  }
  return {
    noonIso: noon ? noon.iso : null,
    noonElevationDeg: noon ? noon.elevationDeg : -90,
    sunriseIso: sunrise,
    sunsetIso: sunset,
  }
}

export interface ShadowMatch {
  iso: string
  minute: number
  elevationDeg: number
  shadowBearingDeg: number
  deltaDeg: number
}

/**
 * Find the times of day when the computed shadow bearing matches an observed
 * one, while the sun is above the horizon. Returns at most one match per local
 * extremum (typically a morning and an afternoon time), refined to the minute.
 */
export function matchShadow(
  lat: number,
  lng: number,
  dateIso: string,
  observedBearingDeg: number,
  toleranceDeg = 6,
): ShadowMatch[] {
  const coarse = sunDay(lat, lng, dateIso, 2)
  const matches: ShadowMatch[] = []
  // Track local minima of the bearing delta among above-horizon samples.
  for (let i = 1; i < coarse.length - 1; i++) {
    const s = coarse[i]
    if (s.elevationDeg <= 0) continue
    const d = bearingDelta(s.shadowBearingDeg, observedBearingDeg)
    const dPrev = bearingDelta(coarse[i - 1].shadowBearingDeg, observedBearingDeg)
    const dNext = bearingDelta(coarse[i + 1].shadowBearingDeg, observedBearingDeg)
    if (d <= dPrev && d <= dNext && d <= toleranceDeg) {
      // Refine to the minute around this sample.
      const start = dayStartMs(dateIso)
      let best = s
      let bestD = d
      for (let m = s.minute - 2; m <= s.minute + 2; m++) {
        if (m < 0 || m > 1440) continue
        const dd = new Date(start + m * 60_000)
        const p = sunPosition(lat, lng, dd)
        if (p.elevationDeg <= 0) continue
        const sb = shadowBearing(p.azimuthDeg)
        const delta = bearingDelta(sb, observedBearingDeg)
        if (delta < bestD) {
          bestD = delta
          best = {
            minute: m,
            iso: dd.toISOString(),
            azimuthDeg: p.azimuthDeg,
            elevationDeg: p.elevationDeg,
            shadowBearingDeg: sb,
          }
        }
      }
      matches.push({
        iso: best.iso,
        minute: best.minute,
        elevationDeg: best.elevationDeg,
        shadowBearingDeg: best.shadowBearingDeg,
        deltaDeg: bestD,
      })
    }
  }
  return matches
}

// ---- Inverse chronolocation: where, given a time and a shadow? -------------

export interface LngLat {
  lat: number
  lng: number
}

/**
 * The subsolar point: the spot on Earth where the sun is directly overhead at an
 * instant. Its latitude is the solar declination; its longitude follows from the
 * equation of time and the UTC clock (hour angle zero at true-solar-noon).
 */
export function subsolarPoint(date: Date): LngLat {
  const { declDeg, eqTimeMin } = solarParams(date)
  const utcMin =
    date.getUTCHours() * 60 +
    date.getUTCMinutes() +
    date.getUTCSeconds() / 60 +
    date.getUTCMilliseconds() / 60000
  // Hour angle is zero (sun overhead) when trueSolarTime = 720, i.e.
  // 720 = utcMin + eqTime + 4*lng  =>  lng = (720 - utcMin - eqTime) / 4.
  let lng = (720 - utcMin - eqTimeMin) / 4
  lng = ((((lng + 180) % 360) + 360) % 360) - 180 // normalise to -180..180
  return { lat: declDeg, lng }
}

/** Sun elevation derived from a vertical object's height and its shadow length. */
export function elevationFromShadow(objectHeight: number, shadowLength: number): number {
  if (shadowLength <= 0) return 90
  return Math.atan2(objectHeight, shadowLength) * DEG
}

/** Spherical great-circle destination: start, bearing (deg), angular distance (deg). */
function sphericalDestination(start: LngLat, bearingDeg: number, angDistDeg: number): LngLat {
  const phi1 = start.lat * RAD
  const lam1 = start.lng * RAD
  const theta = bearingDeg * RAD
  const delta = angDistDeg * RAD
  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta),
  )
  const lam2 =
    lam1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
      Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2),
    )
  let lng = lam2 * DEG
  lng = ((((lng + 180) % 360) + 360) % 360) - 180
  return { lat: phi2 * DEG, lng }
}

/**
 * The locus of points where the sun's elevation equals `elevationDeg` at `date`:
 * a small circle at great-circle angular radius (90 - elevation) from the
 * subsolar point. Returns a closed ring of [lng, lat] pairs for a path layer.
 */
export function elevationLocus(
  date: Date,
  elevationDeg: number,
  stepDeg = 2,
): [number, number][] {
  const sub = subsolarPoint(date)
  const radius = 90 - elevationDeg // angular distance from the subsolar point
  const ring: [number, number][] = []
  for (let b = 0; b <= 360; b += stepDeg) {
    const p = sphericalDestination(sub, b, radius)
    ring.push([p.lng, p.lat])
  }
  return ring
}

