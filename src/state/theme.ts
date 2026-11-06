/**
 * Appearance: light, dark, or the system setting.
 * The choice is a per-viewer convenience kept in this browser's storage; it is
 * never part of the project. An explicit choice sets data-theme on the root;
 * System removes it and lets the media query decide.
 */

import { useSyncExternalStore } from 'react'

export type ThemePref = 'system' | 'light' | 'dark'
export type Theme = 'light' | 'dark'

const KEY = 'parallax.theme'
const EVENT = 'parallax-theme'

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

function applyPref(pref: ThemePref): void {
  const root = document.documentElement
  if (pref === 'system') delete root.dataset.theme
  else root.dataset.theme = pref
}

export function setThemePref(pref: ThemePref): void {
  try {
    if (pref === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, pref)
  } catch {
    /* storage unavailable; the choice still applies for this page */
  }
  applyPref(pref)
  window.dispatchEvent(new Event(EVENT))
}

/** Apply the stored choice before the first paint. */
export function initTheme(): void {
  applyPref(getThemePref())
}

const media = () => window.matchMedia('(prefers-color-scheme: dark)')

export function resolvedTheme(): Theme {
  const pref = getThemePref()
  if (pref !== 'system') return pref
  return media().matches ? 'dark' : 'light'
}

function subscribe(cb: () => void): () => void {
  const m = media()
  m.addEventListener('change', cb)
  window.addEventListener(EVENT, cb)
  return () => {
    m.removeEventListener('change', cb)
    window.removeEventListener(EVENT, cb)
  }
}

/** The theme in force, re-rendering when the viewer or the system changes it. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, resolvedTheme, () => 'light')
}

/** The stored preference, re-rendering when it changes. */
export function useThemePref(): ThemePref {
  return useSyncExternalStore(subscribe, getThemePref, () => 'system')
}

/** Read the current value of a design token, for canvases and SVG drawn in code. */
export function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}
