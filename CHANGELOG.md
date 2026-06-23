# Changelog

All notable changes to this project are documented here. The format follows
Keep a Changelog, and the project follows Semantic Versioning.

## [1.2.0] - 2026-06-23

### Added

- A New action that starts an empty investigation, alongside Reset. Both now
  confirm in two steps in the toolbar rather than through a browser dialog, so
  the action still works (and reports its outcome) in installed PWAs, which
  suppress window.confirm.

### Fixed

- The toolbar no longer overflows its single row at narrow window widths. The
  action buttons previously wrapped into a vertical stack that spilled beneath
  the bar, where the rail card painted over them and swallowed clicks, so Reset
  and the other actions silently did nothing. They are now held on one row.
- Resetting to the sample immediately after an edit could be undone by a pending
  debounced save; that save is now cancelled before the reset writes.

## [1.1.2] - 2026-06-22

### Added

- `.zenodo.json` so the Zenodo deposit records the correct creators (Parallax
  Agency and Jeff O'Brien) and the noncommercial licence. The auto-filled v1.1.1
  deposit defaulted to CC BY 4.0 because GitHub cannot detect the PolyForm licence.

## [1.1.1] - 2026-06-22

### Changed

- README rebalanced to lead with the counter-forensic method.
- Removed CITATION.cff and the README citation pointers; the tool is published for
  verifiability as part of Parallax, not as a product to cite.

### Added

- Deposited to Zenodo for a citable, versioned archival snapshot.

## [1.1.0] - 2026-06-20

### Changed

- Relicensed from MIT to a dual noncommercial licence: the source code is now
  under the PolyForm Noncommercial License 1.0.0 and the non-code assets under
  CC BY-NC-SA 4.0. The project is source-available, not open source; commercial
  use is not granted. Versions released under MIT remain available under MIT.
- Attribution updated to Parallax Agency and Jeff O'Brien.

## [1.0.0] - 2026-06-19

First release. Sightlines, the first tool of the Parallax suite, and the shared
core the suite reuses.

### Added

- Typed, client-side data model for an incident, its sources, and its findings,
  persisted in IndexedDB with media held as Blobs.
- The consent boundary `publicClone`: one function that produces every export and
  published view, dropping non-public sources, aliasing providers, hiding
  provenance, withholding unsafe coordinates, and dropping unsupported findings.
- Resection geometry: crossing vantage sightlines to fix a location, with honest
  reporting of weak (near-parallel) geometry and crossings behind a camera.
- Map built on MapLibre and deck.gl with a synthetic forensic graticule basemap
  that fetches no tiles, plus a registered `pmtiles://` protocol for bundled or
  self-hosted tiles.
- A custom visx timeline that shows uncertain time as ranges and is brushed and
  linked to the map.
- sha-256 fixity over held bytes via WebCrypto, and an honest archived-snapshot
  workflow for video links that are never downloaded.
- A self-contained, interactive published investigation (also a print dossier),
  the full JSON project file, and project import.
- An authored forensic visual identity with self-hosted type and per-string
  direction detection for Arabic (RTL).
- A plainly fictional sample that opens loaded and exercises the sightline
  crossing, the honest handling of uncertain time, and the embargo filter.

[1.0.0]: https://example.com/
