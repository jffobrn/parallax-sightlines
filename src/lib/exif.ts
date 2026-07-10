/**
 * A small, defensive EXIF reader (shared core). It walks a JPEG's APP1 / TIFF IFDs
 * and pulls only the handful of fields that carry forensic weight: capture time,
 * GPS position, the camera's compass direction (GPSImgDirection), and the focal
 * length in 35mm-equivalent terms, from which a horizontal field of view follows.
 * It also reports make / model and editing software. It runs locally over bytes
 * already held; nothing is uploaded, and anything it cannot parse it omits.
 *
 * The return type is a plain struct with no project-model import, so this file is
 * byte-identical across the tools and each maps it into its own shapes.
 */

export interface ExifData {
  /** DateTimeOriginal (or DateTime), normalised to an ISO-ish string when possible. */
  capturedAtIso?: string
  /** "Make Model", trimmed. */
  device?: string
  software?: string
  gps?: { lat: number; lng: number }
  /** GPSImgDirection in degrees (0 = north, clockwise). */
  imgDirectionDeg?: number
  /** 'T' true north, 'M' magnetic north, when the file records it. */
  imgDirectionRef?: 'T' | 'M'
  focalLengthMm?: number
  focalLength35mm?: number
  /** Horizontal field of view (degrees), from the 35mm-equivalent focal length. */
  hFovDeg?: number
  /** Miscellaneous readable fields, for display. */
  fields: { key: string; value: string }[]
}

// EXIF tag ids of interest.
const TAG = {
  Make: 0x010f,
  Model: 0x0110,
  Software: 0x0131,
  DateTime: 0x0132,
  ExifIFD: 0x8769,
  GPSIFD: 0x8825,
  DateTimeOriginal: 0x9003,
  FocalLength: 0x920a,
  FocalLength35mm: 0xa405,
  GPSLatitudeRef: 0x0001,
  GPSLatitude: 0x0002,
  GPSLongitudeRef: 0x0003,
  GPSLongitude: 0x0004,
  GPSImgDirectionRef: 0x0010,
  GPSImgDirection: 0x0011,
}

interface Cursor {
  view: DataView
  /** TIFF header base offset (all IFD offsets are relative to this). */
  base: number
  little: boolean
}

interface RawTag {
  type: number
  count: number
  valueOffset: number // absolute offset into the view for the value/pointer field
}

function readAscii(c: Cursor, t: RawTag): string {
  // ASCII values > 4 bytes are stored at an offset (relative to base); else inline.
  const start =
    t.count <= 4 ? t.valueOffset : c.base + c.view.getUint32(t.valueOffset, c.little)
  let s = ''
  for (let i = 0; i < t.count; i++) {
    const ch = c.view.getUint8(start + i)
    if (ch === 0) break
    s += String.fromCharCode(ch)
  }
  return s.trim()
}

function readRationals(c: Cursor, t: RawTag): number[] {
  // RATIONAL is 8 bytes, so any count needs an out-of-line offset.
  const start = c.base + c.view.getUint32(t.valueOffset, c.little)
  const out: number[] = []
  for (let i = 0; i < t.count; i++) {
    const num = c.view.getUint32(start + i * 8, c.little)
    const den = c.view.getUint32(start + i * 8 + 4, c.little)
    out.push(den === 0 ? 0 : num / den)
  }
  return out
}

/** A SHORT (type 3) with count 1 sits inline in the value field. */
function readShort(c: Cursor, t: RawTag): number {
  return c.view.getUint16(t.valueOffset, c.little)
}

/** Read one IFD into a tag map. */
function readIfd(c: Cursor, ifdOffset: number): Map<number, RawTag> {
  const tags = new Map<number, RawTag>()
  const entryCount = c.view.getUint16(c.base + ifdOffset, c.little)
  let p = c.base + ifdOffset + 2
  for (let i = 0; i < entryCount; i++) {
    const tag = c.view.getUint16(p, c.little)
    const type = c.view.getUint16(p + 2, c.little)
    const count = c.view.getUint32(p + 4, c.little)
    tags.set(tag, { type, count, valueOffset: p + 8 })
    p += 12
  }
  return tags
}

/** Convert a [deg, min, sec] rational triple plus a ref to signed degrees. */
function dms(parts: number[], ref: string): number | undefined {
  if (parts.length < 3) return undefined
  const deg = parts[0] + parts[1] / 60 + parts[2] / 3600
  const sign = ref === 'S' || ref === 'W' ? -1 : 1
  return Math.round(deg * sign * 1e6) / 1e6
}

/** Horizontal field of view (degrees) for a 35mm-equivalent focal length. */
function hFovFrom35(f: number): number | undefined {
  if (!(f > 0)) return undefined
  const hfov = 2 * Math.atan(36 / (2 * f)) * (180 / Math.PI)
  return Math.round(hfov * 10) / 10
}

export async function readExif(file: File): Promise<ExifData | undefined> {
  if (!/jpe?g$/i.test(file.type) && !/\.jpe?g$/i.test(file.name)) return undefined
  try {
    const buf = await file.arrayBuffer()
    const view = new DataView(buf)
    if (view.getUint16(0) !== 0xffd8) return undefined // not a JPEG

    // Walk JPEG segments to find APP1 (0xFFE1) carrying "Exif\0\0".
    let offset = 2
    let app1 = -1
    while (offset < view.byteLength - 4) {
      if (view.getUint8(offset) !== 0xff) break
      const marker = view.getUint8(offset + 1)
      const size = view.getUint16(offset + 2)
      if (marker === 0xe1) {
        app1 = offset + 4
        break
      }
      if (marker === 0xda) break // start of scan; no more metadata
      offset += 2 + size
    }
    if (app1 < 0) return undefined
    if (
      String.fromCharCode(
        view.getUint8(app1),
        view.getUint8(app1 + 1),
        view.getUint8(app1 + 2),
        view.getUint8(app1 + 3),
      ) !== 'Exif'
    )
      return undefined

    const tiff = app1 + 6
    const byteOrder = view.getUint16(tiff)
    const little = byteOrder === 0x4949
    const c: Cursor = { view, base: tiff, little }

    const ifd0Offset = view.getUint32(tiff + 4, little)
    const ifd0 = readIfd(c, ifd0Offset)

    const out: ExifData = { fields: [] }
    const make = ifd0.get(TAG.Make)
    const model = ifd0.get(TAG.Model)
    const software = ifd0.get(TAG.Software)
    const dateTime = ifd0.get(TAG.DateTime)
    if (make) out.device = readAscii(c, make)
    if (model) out.device = [out.device, readAscii(c, model)].filter(Boolean).join(' ')
    if (software) out.software = readAscii(c, software)
    if (dateTime) out.fields.push({ key: 'DateTime', value: readAscii(c, dateTime) })

    // Exif sub-IFD: DateTimeOriginal, focal length.
    const exifPtr = ifd0.get(TAG.ExifIFD)
    if (exifPtr) {
      const exifIfd = readIfd(c, view.getUint32(exifPtr.valueOffset, little))
      const dto = exifIfd.get(TAG.DateTimeOriginal)
      if (dto) out.capturedAtIso = exifToIso(readAscii(c, dto))

      const fl = exifIfd.get(TAG.FocalLength)
      if (fl) {
        const v = readRationals(c, fl)[0]
        if (v > 0) {
          out.focalLengthMm = Math.round(v * 10) / 10
          out.fields.push({ key: 'FocalLength', value: out.focalLengthMm + ' mm' })
        }
      }
      const fl35 = exifIfd.get(TAG.FocalLength35mm)
      if (fl35) {
        const v = readShort(c, fl35)
        if (v > 0) {
          out.focalLength35mm = v
          out.hFovDeg = hFovFrom35(v)
          out.fields.push({ key: 'FocalLengthIn35mm', value: v + ' mm' })
        }
      }
    }

    // GPS sub-IFD: lat / lng, image direction.
    const gpsPtr = ifd0.get(TAG.GPSIFD)
    if (gpsPtr) {
      const gps = readIfd(c, view.getUint32(gpsPtr.valueOffset, little))
      const latRef = gps.get(TAG.GPSLatitudeRef)
      const lat = gps.get(TAG.GPSLatitude)
      const lngRef = gps.get(TAG.GPSLongitudeRef)
      const lng = gps.get(TAG.GPSLongitude)
      if (lat && lng && latRef && lngRef) {
        const la = dms(readRationals(c, lat), readAscii(c, latRef))
        const lo = dms(readRationals(c, lng), readAscii(c, lngRef))
        if (la !== undefined && lo !== undefined) out.gps = { lat: la, lng: lo }
      }
      const dir = gps.get(TAG.GPSImgDirection)
      if (dir) {
        const d = readRationals(c, dir)[0]
        if (Number.isFinite(d)) {
          out.imgDirectionDeg = Math.round((((d % 360) + 360) % 360) * 10) / 10
          const ref = gps.get(TAG.GPSImgDirectionRef)
          if (ref) {
            const r = readAscii(c, ref).toUpperCase()
            if (r === 'T' || r === 'M') out.imgDirectionRef = r
          }
        }
      }
    }

    const empty =
      !out.capturedAtIso &&
      !out.device &&
      !out.software &&
      !out.gps &&
      out.imgDirectionDeg === undefined &&
      out.focalLengthMm === undefined &&
      out.focalLength35mm === undefined
    return empty ? undefined : out
  } catch {
    return undefined
  }
}

/** EXIF datetimes look like "2021:03:14 02:12:00"; normalise to ISO if we can. */
function exifToIso(s: string): string {
  const m = s.match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/)
  if (!m) return s
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`
}
