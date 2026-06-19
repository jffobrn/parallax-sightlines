/**
 * Whole-project export and import as a single portable file (shared core).
 *
 * This is the one output that is NOT sanitized: it is the user's own complete
 * record, for their keeping, and it never leaves the machine unless they save
 * it. Media bytes are inlined as base64 so the project is a single file. (The
 * in-memory and IndexedDB representations keep media as Blobs; only this export
 * format inlines them, by design, to be portable.)
 *
 * Everything published, by contrast, goes through `publicClone`.
 */

import { APP_NAME, APP_VERSION } from './appInfo'
import { getMedia, putMedia, saveProject } from './db'
import { SCHEMA_VERSION, type Project, type ProjectFile } from './types'

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => {
      const result = reader.result as string
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.readAsDataURL(blob)
  })
}

function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

/** Build the single-file project envelope, pulling media out of IndexedDB. */
export async function buildProjectFile(
  project: Project,
  exportedAt: string,
): Promise<ProjectFile> {
  const media: ProjectFile['media'] = {}
  for (const source of project.sources) {
    const key = source.file?.blobKey
    if (!key || media[key]) continue
    const blob = await getMedia(key)
    if (!blob) continue
    media[key] = { mime: blob.type, base64: await blobToBase64(blob) }
  }
  return {
    format: 'sightlines-project',
    schemaVersion: SCHEMA_VERSION,
    app: { name: APP_NAME, version: APP_VERSION },
    exportedAt,
    project,
    media,
  }
}

export function isProjectFile(value: unknown): value is ProjectFile {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as ProjectFile).format === 'sightlines-project' &&
    !!(value as ProjectFile).project
  )
}

/**
 * Load a project envelope: write its media back into IndexedDB and persist the
 * project. Returns the project for the store to adopt.
 */
export async function importProjectFile(file: ProjectFile): Promise<Project> {
  if (!isProjectFile(file)) {
    throw new Error('Not a Sightlines project file.')
  }
  if (typeof file.schemaVersion === 'number' && file.schemaVersion > SCHEMA_VERSION) {
    throw new Error(
      'This project was made with a newer version of Sightlines. Update the app first.',
    )
  }
  for (const [key, entry] of Object.entries(file.media ?? {})) {
    await putMedia(key, base64ToBlob(entry.base64, entry.mime))
  }
  await saveProject(file.project)
  return file.project
}
