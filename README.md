# Sightlines

Reconstruct a single incident or site in time and space from scattered sources.

Sightlines is the first tool of **Parallax**, a client-side, local-first suite
that brings the transferable methods of open-source investigation into art
history and archival research, at the scale of a curator, a researcher, a
student, or a community partner. It gathers dated, hashed sources; places each
photograph's subject and its camera vantage on a map; crosses the sightlines to
resect a location; orders everything on a linked timeline; states findings
tethered to their sources; and publishes a self-contained interactive
investigation.

> Sightlines produces a defensible, source-tethered account, not legal proof or a
> verified geolocation. It documents and corroborates; it does not adjudicate.

## What it does

1. **Define the incident.** Name, type, place, and a time window held with
   explicit uncertainty. Titles are multilingual, including Arabic (RTL).
2. **Gather sources.** Photographs and documents (files), video (links, never
   downloaded), audio, and testimony. Each carries a datetime with its
   precision, provenance, a sha-256 of the bytes held, rights, and a release
   state (public, restricted, embargoed).
3. **Place sources in space.** Per visual source, an optional subject (where the
   depicted thing is) and an optional vantage (camera position, the bearing it
   looked along, an optional field-of-view cone, and a confidence). Every point
   carries its own safe-to-publish flag.
4. **Cross the sightlines.** Each vantage draws a ray. Where two or more cross,
   the crossing is offered as a resected location to accept or adjust. Near
   parallel rays are reported as weak geometry, not a confident false point.
5. **Order on a timeline** linked to the map: selecting on one highlights the
   other, and uncertain times show as ranges, not false points.
6. **State findings.** Assertions the account makes, each tethered to the source
   ids that support it, with a certainty. A finding with no support is not kept.
7. **Publish and export.** A self-contained interactive investigation, the full
   JSON project file, and an optional print dossier.

## The publish boundary

Every export and every published view is produced by one function,
[`publicClone`](src/core/consent.ts). It takes the full project and returns a
sanitized copy in which:

- sources that are not public are dropped;
- provider names are reduced to stable aliases and provenance is removed;
- coordinates are withheld (or coarsened) wherever a point is not safe to publish;
- findings keep only support from surviving sources, and a finding left with no
  support is dropped.

Nothing restricted crosses that boundary: the public types simply have no field
for it, and the published artifact states plainly what was withheld.

## Stack

Best-in-class, source-available, free for noncommercial use, and client-side
local-first. The application is a static bundle; all processing happens in the
browser; data stays on the machine; a published investigation is itself a static
artifact that hosts free.

- React, TypeScript, Vite
- MapLibre GL with deck.gl overlays for points, sightline rays, cones, and the
  crossing
- A synthetic forensic graticule basemap that fetches no tiles; real tiles, when
  wanted, come from a bundled or self-hosted PMTiles archive over `pmtiles://`,
  never a third-party service
- A custom visx timeline, brushed and linked to the map
- Dexie / IndexedDB for the project, with media held as Blobs
- WebCrypto `crypto.subtle.digest` for sha-256 fixity
- Self-hosted IBM Plex Sans, IBM Plex Mono, and Noto Naskh Arabic (no font CDN)

## Safety properties

- **Tiles never leak the viewport.** The default basemap makes no network
  request at all. A sensitive area of interest cannot reach an outside server.
- **Local-first.** No accounts, no servers, no uploads. The project and its
  media live in your browser's storage and only leave when you save a file.
- **We hash only what we hold.** For a video link, the remote bytes are not
  downloaded; an archived snapshot record is hashed instead, and the interface
  says so.

## Getting started

Requirements: Node 18 or newer.

```bash
npm install
npm run dev        # start the dev server
npm run build      # type-check and build the static bundle to dist/
npm run preview    # preview the production build
```

The app opens with a plainly fictional sample loaded (the overnight demolition of
an invented modernist cinema in an invented town), so a first-time visitor can
see the sightline crossing, the honest handling of uncertain time, and the
embargo filter at work. The town, the cinema, the coordinates, the timestamps,
and the people are invented; only the file hashes are real.

### Deploy

`npm run build` produces a static `dist/` that hosts on GitHub Pages, Netlify, or
Cloudflare Pages. The base path is relative, so it also runs from a subfolder or
straight off the filesystem. A published investigation is a single self-contained
HTML file that hosts the same way or opens offline.

## Project structure

The suite's shared core lives in [`src/core`](src/core) as clean, exported
modules that later Parallax tools reuse:

- `types.ts` the typed data model, including the public (sanitized) shapes
- `consent.ts` the `publicClone` publish boundary
- `geo.ts` resection geometry (crossing sightlines)
- `hash.ts` sha-256 fixity over held bytes
- `time.ts`, `format.ts` time without false precision, and apparatus formatting
- `db.ts`, `projectFile.ts` IndexedDB persistence and single-file export/import

The design tokens in [`src/design`](src/design) are the suite's authored forensic
identity. The map, timeline, panels, and publishing layers build on top.

## Roadmap

Parallax is planned as a small suite of siblings that share this core: **Atlas**
(the image complex as a navigable space), **Situated Testimony** (model-aided oral
history), and **Verification** (a source-criticism workbench for teaching).
Sightlines is built first because it establishes the shared core.

## License

Source-available, not open source. The source code is under the
[PolyForm Noncommercial License 1.0.0](LICENSE); the non-code assets (the design,
this documentation, the bundled sample, and the investigations the tool produces)
are under [CC BY-NC-SA 4.0](ASSETS-LICENSE.md). Free to use, modify, and share for
any noncommercial purpose, including education, research, nonprofits, and
government. Commercial use is not granted here; contact the authors for commercial
licensing.

Parallax publishes these instruments for verifiability, not as products to adopt.

## Author

Parallax Agency and Jeff O'Brien. Parallax is an independent research practice for
art history and the archive, founded and directed by Jeff O'Brien (Material /
Image Research Lab, UC Santa Barbara).
