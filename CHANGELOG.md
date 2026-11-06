# Changelog

All notable changes to this project are documented here. The format follows
Keep a Changelog, and the project follows Semantic Versioning.

## [1.5.2] - 2026-11-06

### Fixed

- Quiet destructive buttons (Delete, Remove) read in the alert colour again;
  the quiet button style had been overriding it.

## [1.5.1] - 2026-11-05

### Changed

- The crossing now reads as evidence rather than as a starburst. The fix is
  the centre of the uncertainty estimate, which weighs every ray, not the
  single best-crossing pair. Rays stop a little past the fix, so they are seen
  to converge on it; the pairwise crossings are drawn as a small cluster around
  it; a camera's field of view is drawn only for the source in focus; and a
  sync event's bearing bands and zone of possible origin are drawn only when
  that event is selected.
- Geometry is reported in words (strong, moderate, weak) with the best pair's
  crossing angle, and the spread names how many pairwise crossings it spans.
- The sample's bearings now carry realistic reading error, so its spread and
  its 95% region tell one consistent story. The sample opens on the measured
  grid, since its invented coordinates have no imagery under them.
- The grid ground uses the Workbench greys, and the page declares both light
  and dark colour schemes.

## [1.5.0] - 2026-11-05

### Changed

- A new interface, Workbench, laid out like working software: a title bar
  with Case, View, and Help menus and Publish as the one primary action; a tool
  bar of the actual tools (Select, Place vantage, Place subject, Place
  incident, Ground, Measure, Sun and shadow, and the place search); the case as
  an outline of compact tables (sources with kind, time, and consent; findings
  with certainty and citations; sync events); a Properties pane laid out as a
  grid of labelled fields; a tabbed dock (Chronology, Clock, Crossing); and a
  status bar with the cursor, the crossing, the counts, and how many sources
  are withheld from publication.
- Neutral warm greys, Archivo at 13 px, and IBM Plex Mono only for data, both
  vendored so nothing is fetched. Violet marks the selection; raspberry marks
  what the evidence converges on; red is kept for protection.
- A dark mode in the same register, following the system; View, then
  Appearance, fixes Light or Dark for this browser.
- Plain language in place of apparatus: no numbered section codes, tracked
  capitals, or status pills. Consent and certainty read as words; a restricted
  or embargoed source reads in red with a red rule on its row; consent in the
  editor is a choice with each level's meaning beside it. Sources are called
  sources throughout.
- New and Reset moved into the Case menu and confirm in a dialog.
- The crossing readout moved off the map into its own dock tab and the status
  bar, so nothing floats over the sightlines. Map marks change colour with the
  ground, light over imagery and violet over the light grounds, and the map has
  a scale bar.
- On a narrow screen the panes stack, map first.
- The published artifact is set as a plain working paper in the same
  register, with Archivo embedded so the file stays self-contained, and numbers
  its sources "Source 1" and so on.

## [1.4.0] - 2026-11-05

### Added

- One clock for many sources. Sync events record a moment observable in more
  than one source (seen, heard, or both), with a reading of where it falls in
  each source's media and how precisely. A weighted least-squares alignment
  places every linked source on one clock, with a standard error on each start
  and each event. Sources a trusted anchor reaches read in absolute time; a
  group no anchor reaches is aligned relative to a reference source and shown
  as floating.
- Readings check each other once there is redundancy: the worst-fitting
  reading beyond three of its own uncertainties is set aside and the clocks
  refitted, so a splice, an edit, or a misread shows its full disagreement. An
  event read in only two sources is flagged as inconsistent without blaming
  either one. Where nothing can be checked, the editor says so.
- Zones of possible origin: bearing bands from placed vantages are intersected
  on the map, with the zone's area.
- A Clock view in the dock (beside the Chronology), a synced track on the
  chronology with two-sigma whiskers, a Media clock section on each source
  (duration, anchor with its published basis), and a Sync events section on
  the rail.
- The claimed time and the synced time are shown side by side, and a
  disagreement is flagged; the claim is never overwritten unless you adopt the
  synced time.
- Second precision for datetimes.
- The published artifact carries a Clock alignment section (each source's
  synced start and anchor basis, each event's time, flags, and zones) and the
  zones on its static map.

### Changed

- The project schema moves to version 2 (sources gain a media clock, projects
  gain sync events). Version 1 files import unchanged, with no sync events.

### Security

- At the consent boundary, a withheld source's readings are withheld with it,
  events left with no public reading are dropped, a bearing band publishes only
  when its source's vantage does, and the published alignment is recomputed
  from public sources alone, so a withheld reading cannot move a published
  clock. The smoke test probes for the embargoed sample source's id and title.

## [1.3.2] - 2026-11-05

### Security

- MapLibre GL updated from 4.7 to 6.16, clearing a critical advisory
  (GHSA-jrc7-96c5-q579, an XSS sanitizer bypass in MapLibre's internal
  `DOM.sanitize`, affecting every version up to 6.4.0). Exposure here was low,
  since no tool passes untrusted HTML to MapLibre, but the fix ships anyway.
  deck.gl 9.4 moves with it.

### Changed

- The deck.gl overlay now draws on its own canvas over the basemap rather
  than interleaved inside MapLibre's: deck.gl's interleaved path reads MapLibre
  internals that MapLibre 6 removed, and failed on every frame. These maps are
  flat, so nothing is lost; overlay alignment and map clicks were re-verified.
- The MapLibre worker is registered explicitly, as MapLibre 6 requires under a
  bundler.

### Added

- A smoke test (`npm run smoke`) that drives the built app headless: every
  stage view, row selection, publish, New, Reset, and reload persistence, and
  probes the published artifact for the sample's private strings. It runs in
  the deploy workflow before the Pages upload, so a crashing view or a consent
  leak blocks the deploy.

### Fixed

- Recorded here: the map credit now refreshes when the ground changes
  (shipped 2026-09-04 without a version entry).

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
