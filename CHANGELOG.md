# Changelog

All notable changes to this project are documented here. The format follows
Keep a Changelog, and the project follows Semantic Versioning.

## [1.3.1] - 2026-09-04

### Fixed

- The place-label overlay no longer loads over the File basemap. A local
  `.pmtiles` ground promises that nothing is fetched, but with Labels switched
  on it still pulled label tiles from an online host, disclosing the viewed
  area. The overlay now applies only to the online grounds, so the offline
  grounds keep their promise unconditionally, whatever the toggle says.

## [1.3.0] - 2026-09-04

The three feature commits of 2026-07-10, released and documented together with a
browser-verification pass.

### Added

- A retrievable basemap: Esri World Imagery (satellite, tokenless) is the
  default ground, with OpenStreetMap streets, Esri topographic, the offline
  coordinate grid, and a local .pmtiles file as alternatives, plus a
  place-label overlay.
- Dated imagery: with satellite active, an Imagery menu switches from the live
  mosaic to a dated release of the Esri World Imagery Wayback archive, so a
  photograph can be read against imagery near its claimed moment.
- Place search on the map: a typed coordinate resolves locally; a place name
  queries the Nominatim geocoder, and picking a result flies the map there.
- EXIF vantage ingest: an attached photograph's metadata panel reads the
  capture time, device, embedded GPS, compass direction (with its true or
  magnetic reference), and focal length with its 35mm equivalent, and an Apply
  to vantage & time action adopts them into the source in one press. The
  applied vantage is marked not safe to publish.
- A terrain line-of-sight check between a source's vantage and its subject,
  sampled from the public Terrarium elevation model, with an elevation profile
  and a clear or blocked verdict. A screening check, not a survey.
- A resection uncertainty ellipse: each vantage's bearing carries a spread from
  its stated confidence, and the crossing card reports a 95% region, drawn on
  the map around the fix.
- A measure tool on the map: a clicked path reads out its distance in metres,
  and a closed figure adds its area. A reading aid, not saved to the project.
- A sun and shadow panel for the incident place and a chosen time: azimuth,
  elevation, shadow direction, and the day's rise, noon, and set, computed
  locally.
- A Geo export: the placed points (incident place, subjects, vantages with
  bearings, the resection crossing, and located findings) as GeoJSON or CSV for
  QGIS. Full coordinates, for the researcher's own use, not the consent-cleared
  publication.

### Fixed

- The README and the researcher's guide still described the pre-1.3 posture (no
  map service called, a synthetic basemap only). Both now state the actual
  retrieval surface: basemap tiles, the geocoder, and the elevation tiles, what
  each request discloses, and that the Grid and File grounds fetch nothing.
- The EXIF hint claimed an applied vantage is withheld from every export; the
  Geo export deliberately carries full coordinates and says so. The hint now
  names the publish boundary and the exception.
- The app's own version constant (written into exported project files) had
  fallen behind the release version; it is now synced.

## [1.2.1] - 2026-06-23

### Added

- The source and finding rows in the rail are keyboard accessible: each is now a
  focusable button that activates on Enter or Space, with the standard focus
  ring, so the investigation can be navigated without a mouse.

### Fixed

- Readout counts read in the singular when there is one (1 source, not
  1 sources).

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
