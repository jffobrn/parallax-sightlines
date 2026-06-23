/**
 * Application state (Zustand). Holds the one project, the selection shared by
 * the map and the timeline, the map placement mode ("drop a station"), and the
 * time brush. Mutations persist to IndexedDB on a short debounce. Media bytes
 * never live here; only the typed records do.
 */

import { create } from 'zustand'
import {
  clearProject,
  loadProject,
  pruneMedia,
  saveProject,
  type Finding,
  type GeoPoint,
  type Incident,
  type Project,
  type Source,
} from '../core'
import { buildSampleProject } from '../sample/sampleProject'

/** What a map click will set next, if anything. */
export type Placing =
  | { kind: 'incident-place' }
  | { kind: 'subject'; sourceId: string }
  | { kind: 'vantage'; sourceId: string }
  | null

export interface AppState {
  project: Project
  ready: boolean

  selectedSourceId: string | null
  selectedFindingId: string | null
  hoveredId: string | null
  editingSourceId: string | null

  timeBrush: { start: number; end: number } | null
  placing: Placing
  cursor: { lat: number; lng: number } | null

  // lifecycle
  init: () => Promise<void>
  resetToSample: () => Promise<void>
  newBlankProject: () => Promise<void>
  adoptProject: (project: Project) => void

  // incident
  patchIncident: (partial: Partial<Incident>) => void

  // sources
  addSource: (source: Source) => void
  updateSource: (id: string, partial: Partial<Source>) => void
  removeSource: (id: string) => void

  // findings
  addFinding: (finding: Finding) => void
  updateFinding: (id: string, partial: Partial<Finding>) => void
  removeFinding: (id: string) => void

  // selection / interaction
  select: (sourceId: string | null) => void
  selectFinding: (id: string | null) => void
  hover: (id: string | null) => void
  setEditingSource: (id: string | null) => void
  setTimeBrush: (range: { start: number; end: number } | null) => void
  setCursor: (c: { lat: number; lng: number } | null) => void

  // placement ("drop a station")
  setPlacing: (placing: Placing) => void
  applyPlacement: (lat: number, lng: number) => void
}

let persistTimer: ReturnType<typeof setTimeout> | null = null
function schedulePersist(project: Project) {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    void saveProject(project)
    void pruneMedia(project)
  }, 400)
}

/** Cancel a pending debounced save so it cannot clobber a direct write. */
function cancelPersist() {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
}

export const useStore = create<AppState>()((set, get) => {
  /** Apply a project mutation and queue a save. */
  const commit = (project: Project) => {
    set({ project })
    schedulePersist(project)
  }

  return {
    project: blankProject(),
    ready: false,

    selectedSourceId: null,
    selectedFindingId: null,
    hoveredId: null,
    editingSourceId: null,
    timeBrush: null,
    placing: null,
    cursor: null,

    async init() {
      const existing = await loadProject()
      if (existing) {
        set({ project: existing, ready: true })
        return
      }
      const sample = await buildSampleProject()
      await saveProject(sample)
      set({ project: sample, ready: true })
    },

    async resetToSample() {
      // A debounced save from a just-prior edit would otherwise fire after this
      // and restore the old project, so cancel it before writing the sample.
      cancelPersist()
      await clearProject()
      const sample = await buildSampleProject()
      await saveProject(sample)
      set({
        project: sample,
        selectedSourceId: null,
        selectedFindingId: null,
        editingSourceId: null,
        timeBrush: null,
        placing: null,
      })
    },

    async newBlankProject() {
      // Start an empty investigation (no sources or findings), discarding the
      // sample. Cancel any pending debounced save so it cannot restore it.
      cancelPersist()
      await clearProject()
      const project = blankProject()
      await saveProject(project)
      set({
        project,
        selectedSourceId: null,
        selectedFindingId: null,
        editingSourceId: null,
        timeBrush: null,
        placing: null,
      })
    },

    adoptProject(project) {
      set({
        project,
        selectedSourceId: null,
        selectedFindingId: null,
        editingSourceId: null,
        timeBrush: null,
        placing: null,
      })
      schedulePersist(project)
    },

    patchIncident(partial) {
      const p = get().project
      commit({ ...p, incident: { ...p.incident, ...partial } })
    },

    addSource(source) {
      const p = get().project
      commit({ ...p, sources: [...p.sources, source] })
      set({ selectedSourceId: source.id, selectedFindingId: null })
    },

    updateSource(id, partial) {
      const p = get().project
      commit({
        ...p,
        sources: p.sources.map((s) => (s.id === id ? { ...s, ...partial } : s)),
      })
    },

    removeSource(id) {
      const p = get().project
      commit({
        ...p,
        sources: p.sources.filter((s) => s.id !== id),
        findings: p.findings.map((f) => ({
          ...f,
          supportedBy: f.supportedBy.filter((sid) => sid !== id),
        })),
      })
      if (get().selectedSourceId === id) set({ selectedSourceId: null })
      if (get().editingSourceId === id) set({ editingSourceId: null })
    },

    addFinding(finding) {
      const p = get().project
      commit({ ...p, findings: [...p.findings, finding] })
      set({ selectedFindingId: finding.id, selectedSourceId: null })
    },

    updateFinding(id, partial) {
      const p = get().project
      commit({
        ...p,
        findings: p.findings.map((f) => (f.id === id ? { ...f, ...partial } : f)),
      })
    },

    removeFinding(id) {
      const p = get().project
      commit({ ...p, findings: p.findings.filter((f) => f.id !== id) })
      if (get().selectedFindingId === id) set({ selectedFindingId: null })
    },

    select(sourceId) {
      set({ selectedSourceId: sourceId, selectedFindingId: null })
    },
    selectFinding(id) {
      set({ selectedFindingId: id, selectedSourceId: null })
    },
    hover(id) {
      set({ hoveredId: id })
    },
    setEditingSource(id) {
      set({ editingSourceId: id })
      if (id) set({ selectedSourceId: id })
    },
    setTimeBrush(range) {
      set({ timeBrush: range })
    },
    setCursor(c) {
      set({ cursor: c })
    },

    setPlacing(placing) {
      set({ placing })
    },

    applyPlacement(lat, lng) {
      const placing = get().placing
      if (!placing) return
      const p = get().project
      // Round to ~0.1 m so a placed point does not carry floating-point noise.
      lat = Math.round(lat * 1e6) / 1e6
      lng = Math.round(lng * 1e6) / 1e6

      if (placing.kind === 'incident-place') {
        const prev = p.incident.place
        const place = {
          lat,
          lng,
          safeToPublish: prev?.safeToPublish ?? true,
          name: prev?.name,
        }
        commit({ ...p, incident: { ...p.incident, place } })
        set({ placing: null })
        return
      }

      const source = p.sources.find((s) => s.id === placing.sourceId)
      if (!source) {
        set({ placing: null })
        return
      }

      if (placing.kind === 'subject') {
        const prev = source.subject
        const subject: GeoPoint = {
          lat,
          lng,
          safeToPublish: prev?.safeToPublish ?? true,
        }
        get().updateSource(source.id, { subject })
      } else {
        const prev = source.vantage
        const vantage = {
          lat,
          lng,
          safeToPublish: prev?.safeToPublish ?? true,
          bearingDeg: prev?.bearingDeg ?? 0,
          fovDeg: prev?.fovDeg,
          confidence: prev?.confidence ?? ('probable' as const),
        }
        get().updateSource(source.id, { vantage })
      }
      set({ placing: null })
    },
  }
})

function blankIncident(): Incident {
  return {
    id: 'incident',
    titles: [{ text: 'Untitled incident', lang: 'en' }],
    type: 'other',
    window: { precision: 'day' },
    tags: [],
  }
}

function blankProject(): Project {
  return { incident: blankIncident(), sources: [], findings: [] }
}
