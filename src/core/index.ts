/**
 * Sightlines / Parallax shared core.
 *
 * The typed data layer, the consent boundary (publicClone), fixity hashing,
 * resection geometry, persistence, and apparatus formatting. Later Parallax
 * tools import from here. Nothing in this folder imports React or touches the
 * network; it is the reusable spine of the suite.
 */

export * from './types'
export * from './appInfo'
export * from './id'
export * from './hash'
export * from './geo'
export * from './time'
export * from './format'
export * from './consent'
export * from './db'
export * from './projectFile'
