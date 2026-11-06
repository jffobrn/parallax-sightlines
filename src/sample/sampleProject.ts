/**
 * The sample investigation. Plainly fictional: an invented modernist cinema in
 * an invented town, with invented coordinates, timestamps, and people. Only the
 * file hashes are real, computed here over the actual exhibit bytes.
 *
 * It exercises every distinctive feature: two photographs from marked stations
 * whose bearings cross and resect the facade; a third photograph with a subject
 * but no vantage; a document and an anchored testimony; a video held as a link
 * with an archived snapshot and its hash; one embargoed source that publishing
 * drops; findings tethered to their sources (one only "probable", one that
 * loses all support on publish); and a witness location marked not safe to
 * publish so the published output withholds it.
 */

import {
  newId,
  putMedia,
  sha256OfText,
  type HeldFile,
  type Project,
  type Source,
} from '../core'

import photoA from './assets/photo-a.svg?raw'
import photoB from './assets/photo-b.svg?raw'
import photoC from './assets/photo-c.svg?raw'
import photoD from './assets/photo-d.svg?raw'
import documentSvg from './assets/document.svg?raw'

async function heldSvg(
  raw: string,
  name: string,
  w: number,
  h: number,
): Promise<HeldFile> {
  const bytes = new TextEncoder().encode(raw)
  const sha256 = await sha256OfText(raw)
  const blobKey = newId('media')
  await putMedia(blobKey, new Blob([bytes], { type: 'image/svg+xml' }))
  return { name, mime: 'image/svg+xml', bytes: bytes.byteLength, sha256, w, h, blobKey }
}

// Invented site. The cinema, the resected subject of the two night photographs.
const CINEMA = { lat: 34.405, lng: -19.85 }

export async function buildSampleProject(): Promise<Project> {
  const [fileA, fileB, fileC, fileD, fileDoc] = await Promise.all([
    heldSvg(photoA, 'station-sw-0212.svg', 1200, 800),
    heldSvg(photoB, 'station-se-0218.svg', 1200, 800),
    heldSvg(photoC, 'site-dawn.svg', 1200, 800),
    heldSvg(photoD, 'station-n-0224.svg', 1200, 800),
    heldSvg(documentSvg, 'notice-vl-0314.svg', 1000, 1294),
  ])

  // An archived snapshot record for the video link. We hash the snapshot we
  // hold, never the remote video bytes; the note says so.
  const snapshotRecord = JSON.stringify({
    capturedFrom: 'https://example.org/vela-lumina-night',
    capturedAt: '2021-03-15T09:00:00Z',
    tool: 'Wayback save (manual)',
    note: 'Hash is of the archived page snapshot we hold. Remote video bytes are not held and cannot be hashed at source.',
  })
  const archivedSha256 = await sha256OfText(snapshotRecord)

  const sources: Source[] = [
    {
      id: 'src-photo-a',
      kind: 'photograph',
      title: 'Facade from the south-west station',
      datetime: { value: '2021-03-14T02:12:00Z', precision: 'minute' },
      provider: 'Vela Resident Network',
      provenance: 'Received via secure drop on 14 Mar; contributor retains the original device file.',
      file: fileA,
      vantage: {
        lat: 34.4038,
        lng: -19.8518,
        safeToPublish: true,
        bearingDeg: 52.1,
        fovDeg: 35,
        confidence: 'attested',
      },
      consent: 'public',
      rights: 'Contributor copyright; shared for documentation.',
      note: 'Looks north-east across the square toward the blade sign.',
    },
    {
      id: 'src-photo-b',
      kind: 'photograph',
      title: 'Facade from the south-east station',
      datetime: { value: '2021-03-14T02:18:00Z', precision: 'minute' },
      provider: 'Vela Resident Network',
      provenance: 'Same contributor network as Exhibit A; second account.',
      file: fileB,
      vantage: {
        lat: 34.404,
        lng: -19.8482,
        safeToPublish: true,
        bearingDeg: 302.8,
        fovDeg: 40,
        confidence: 'attested',
      },
      consent: 'public',
      rights: 'Contributor copyright; shared for documentation.',
      note: 'Looks north-west; dust visible at the base of the structure.',
    },
    {
      id: 'src-photo-c',
      kind: 'photograph',
      title: 'Empty lot at dawn',
      datetime: { value: '2021-03-14T05:40:00Z', precision: 'day' },
      provider: 'M. Carrere (resident)',
      provenance: 'Posted publicly the following morning; downloaded same day.',
      file: fileC,
      subject: { lat: 34.40496, lng: -19.84994, safeToPublish: true },
      consent: 'public',
      rights: 'Unknown; treat as all rights reserved.',
      note: 'Subject is placed at the rubble; this frame has no recoverable camera vantage.',
    },
    {
      id: 'src-document',
      kind: 'document',
      title: 'Municipal demolition notice VL-0314',
      datetime: { value: '2021-03-10T00:00:00Z', precision: 'day' },
      provider: 'Municipal source',
      provenance: 'Leaked copy; original not independently confirmed.',
      file: fileDoc,
      consent: 'public',
      rights: 'Public record (fictional).',
      note: 'Authorizes removal between 13 and 20 March; permits work outside daylight hours.',
    },
    {
      id: 'src-testimony',
      kind: 'testimony',
      title: 'Account of a resident across the square',
      datetime: { value: '2021-03-14T02:00:00Z', precision: 'hour' },
      provider: 'Witness, identity withheld',
      provenance: 'Recorded interview; transcript held separately.',
      // The witness location is protected: not safe to publish.
      subject: { lat: 34.4047, lng: -19.8506, safeToPublish: false },
      consent: 'public',
      rights: 'Used with consent for this account.',
      note: 'Heard machinery start around 02:00 and watched from a window. Location withheld.',
    },
    {
      id: 'src-video',
      kind: 'video-link',
      title: 'Clip of the site at night (linked)',
      // The upload page's stated time. The sync places the clip's start at
      // 02:12:20, so this claim conflicts: most likely an upload time read as a
      // capture time. Kept as claimed; the conflict is shown, not overwritten.
      datetime: { value: '2021-03-14T03:05:00Z', precision: 'minute' },
      clock: { durationSec: 360 },
      vantage: {
        lat: 34.4033,
        lng: -19.8503,
        safeToPublish: true,
        bearingDeg: 9.9,
        fovDeg: 50,
        confidence: 'probable',
      },
      provider: 'Public upload (mirror)',
      provenance: 'Found on a public page; not downloaded.',
      link: {
        url: 'https://example.org/vela-lumina-night',
        archivedUrl:
          'https://web.archive.org/web/20210315090000/https://example.org/vela-lumina-night',
        archivedSha256,
        archivedAt: '2021-03-15T09:00:00Z',
      },
      consent: 'public',
      rights: 'Uploader unknown.',
      note: 'Remote bytes are not held; only the archived snapshot is hashed. Filmed from the south side of the square.',
    },
    {
      id: 'src-broadcast',
      kind: 'video-link',
      title: 'Live broadcast segment, Vela local station (linked)',
      datetime: { value: '2021-03-14T02:10:00Z', precision: 'second' },
      provider: 'Vela Local Television (fictional)',
      provenance: 'Public broadcast archive page; segment not downloaded.',
      clock: {
        durationSec: 600,
        anchor: {
          startIso: '2021-03-14T02:10:00Z',
          uncertaintySec: 1,
          basis: "The broadcaster's on-air clock, burned into the frame.",
        },
      },
      link: { url: 'https://example.org/vela-tv-0314-0210' },
      vantage: {
        lat: 34.4049,
        lng: -19.847,
        safeToPublish: true,
        bearingDeg: 271.0,
        fovDeg: 40,
        confidence: 'attested',
      },
      consent: 'public',
      rights: 'Broadcast archive (fictional).',
      note: 'Rooftop camera east of the square. Its burned-in clock anchors every clip it shares an event with.',
    },
    {
      id: 'src-embargoed',
      kind: 'photograph',
      title: 'Frame from the north station (identifying)',
      datetime: { value: '2021-03-14T02:24:00Z', precision: 'minute' },
      provider: 'Source within the contractor',
      provenance: 'Shared on condition it is not published; identifies an individual.',
      file: fileD,
      vantage: {
        lat: 34.4064,
        lng: -19.8498,
        safeToPublish: true,
        bearingDeg: 185.6,
        fovDeg: 30,
        confidence: 'probable',
      },
      clock: { durationSec: 0 },
      consent: 'embargoed',
      rights: 'Not cleared for publication.',
      note: 'Held for the account only. Embargoed, so it never crosses the consent boundary.',
    },
  ]

  const project: Project = {
    incident: {
      id: 'incident-vela-lumina',
      titles: [
        { text: 'The overnight demolition of the Cinema Lumina', lang: 'en' },
        { text: 'هدم سينما لومينا ليلاً', lang: 'ar' },
      ],
      type: 'demolition',
      place: {
        ...CINEMA,
        safeToPublish: true,
        name: 'Cinema Lumina, 14 Quai des Marais (fictional)',
      },
      window: {
        start: '2021-03-14T01:45:00Z',
        end: '2021-03-14T03:30:00Z',
        precision: 'hour',
      },
      summary:
        'A plainly fictional sample. Overnight on 14 March 2021 the modernist Cinema Lumina, in the invented town of Vela, is recorded being demolished. The town, the cinema, the coordinates, the timestamps, and the people are all invented; only the file hashes are real. Use it to watch Sightlines cross two sightlines onto the facade, hold uncertain time honestly, tether each finding to its sources, and withhold protected material when the investigation is published.',
      tags: ['fictional-sample', 'demolition', 'cinema', 'modernism'],
    },
    sources,
    findings: [
      {
        id: 'find-1',
        statement:
          'Two photographs from separate vantages (south-west and south-east) cross on the Cinema Lumina facade, placing the overnight demolition at that structure.',
        supportedBy: ['src-photo-a', 'src-photo-b'],
        certainty: 'attested',
        at: {
          time: '2021-03-14T02:15:00Z',
          place: { ...CINEMA, safeToPublish: true },
        },
      },
      {
        id: 'find-2',
        statement:
          'Heavy machinery was operating at the site after 02:00 on 14 March.',
        supportedBy: ['src-photo-a', 'src-video', 'src-testimony'],
        certainty: 'probable',
        at: { time: '2021-03-14T02:18:00Z' },
      },
      {
        id: 'find-3',
        statement:
          'A municipal notice dated 10 March authorized removal of the structure and permitted work outside daylight hours.',
        supportedBy: ['src-document'],
        certainty: 'attested',
        at: { time: '2021-03-10T00:00:00Z' },
      },
      {
        id: 'find-4',
        statement:
          'An individual visible in a fourth frame was identified as a member of the demolition crew.',
        supportedBy: ['src-embargoed'],
        certainty: 'probable',
      },
    ],
    // Four moments seen or heard in both clips. The broadcast's on-air clock
    // anchors them; the night clip is aligned through them. The fourth is read
    // 20 s off in the night clip, a planted inconsistency the screening flags.
    syncEvents: [
      {
        id: 'sync-power',
        label: 'Street lights on the square cut out',
        kind: 'visual',
        observations: [
          { sourceId: 'src-broadcast', mediaTimeSec: 254, uncertaintySec: 0.5 },
          { sourceId: 'src-video', mediaTimeSec: 114, uncertaintySec: 0.5 },
        ],
      },
      {
        id: 'sync-boom',
        label: 'The crane boom strikes the marquee',
        kind: 'both',
        observations: [
          { sourceId: 'src-broadcast', mediaTimeSec: 312, uncertaintySec: 0.5, bearingFromDeg: 268, bearingToDeg: 276, maxRangeM: 600 },
          { sourceId: 'src-video', mediaTimeSec: 172, uncertaintySec: 0.5, bearingFromDeg: 3, bearingToDeg: 13, maxRangeM: 600 },
          // The embargoed frame sees the strike too; this reading never publishes.
          { sourceId: 'src-embargoed', mediaTimeSec: 0, uncertaintySec: 2 },
        ],
        note: 'The flash and the report arrive together in both clips; the cameras are close.',
      },
      {
        id: 'sync-facade',
        label: 'Second facade section falls',
        kind: 'both',
        observations: [
          { sourceId: 'src-broadcast', mediaTimeSec: 431, uncertaintySec: 0.5 },
          { sourceId: 'src-video', mediaTimeSec: 291, uncertaintySec: 0.5 },
        ],
      },
      {
        id: 'sync-shout',
        label: 'A shout, then a horn',
        kind: 'sound',
        observations: [
          { sourceId: 'src-broadcast', mediaTimeSec: 500, uncertaintySec: 0.5 },
          { sourceId: 'src-video', mediaTimeSec: 340, uncertaintySec: 0.5, note: 'Read 20 s off the others: a possible splice in the mirrored upload.' },
        ],
      },
    ],
  }

  return project
}
