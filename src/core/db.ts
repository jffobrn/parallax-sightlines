/**
 * Local persistence (shared core): the project lives in IndexedDB via Dexie,
 * and media (images, documents, archived snapshots) are held as Blobs in a
 * separate table so a large photo set never bloats the project record and is
 * never base64'd into memory. Nothing here touches the network.
 */

import Dexie, { type Table } from 'dexie'
import type { Project } from './types'

interface AppRow {
  key: string
  value: unknown
}

interface MediaRow {
  key: string
  mime: string
  blob: Blob
}

const PROJECT_KEY = 'project'

class SightlinesDB extends Dexie {
  app!: Table<AppRow, string>
  media!: Table<MediaRow, string>

  constructor() {
    super('sightlines')
    this.version(1).stores({
      app: 'key',
      media: 'key',
    })
  }
}

export const db = new SightlinesDB()

// --- Project ---------------------------------------------------------------

export async function saveProject(project: Project): Promise<void> {
  await db.app.put({ key: PROJECT_KEY, value: project })
}

export async function loadProject(): Promise<Project | undefined> {
  const row = await db.app.get(PROJECT_KEY)
  return row?.value as Project | undefined
}

export async function clearProject(): Promise<void> {
  await db.transaction('rw', db.app, db.media, async () => {
    await db.app.delete(PROJECT_KEY)
    await db.media.clear()
  })
}

// --- Media -----------------------------------------------------------------

export async function putMedia(key: string, blob: Blob): Promise<void> {
  await db.media.put({ key, mime: blob.type, blob })
}

export async function getMedia(key: string): Promise<Blob | undefined> {
  const row = await db.media.get(key)
  return row?.blob
}

export async function deleteMedia(key: string): Promise<void> {
  await db.media.delete(key)
}

export async function getAllMediaKeys(): Promise<string[]> {
  return db.media.toCollection().primaryKeys()
}

/**
 * Drop any media blobs no longer referenced by a held file in the project.
 * Cheap housekeeping to keep storage honest after deletes.
 */
export async function pruneMedia(project: Project): Promise<number> {
  const referenced = new Set(
    project.sources
      .map((s) => s.file?.blobKey)
      .filter((k): k is string => typeof k === 'string'),
  )
  const keys = await getAllMediaKeys()
  const orphans = keys.filter((k) => !referenced.has(k))
  if (orphans.length) await db.media.bulkDelete(orphans)
  return orphans.length
}
