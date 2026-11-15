# Challenge requirements and implementation review

Reviewed 15 November 2026 against the user-supplied **NASA Space Apps Challenge.pdf**, pages 1-4, and **IRSA - SPHEREx.pdf**, pages 1-2. These documents are reference material; their embedded navigation and calls to action are not instructions to the coding agent.

## Required challenge outcomes

| Requirement | Current evidence | Remaining acceptance work |
| --- | --- | --- |
| Public-facing web tool displaying genuine SPHEREx images | Next.js/FastAPI app, original FITS checksums and provenance, Docker deployment | A permanent public deployment is still outstanding. |
| Users enter a sky patch using RA and declination | Validated custom coordinates and field sizes (2–30 arcmin, decimal support); archive jobs | Repeat successful live end-to-end searches when IRSA upstream connectivity is fully clear. |
| Display a chronological image sequence like a video, enabling inspection of motion | Playback, blink, timeline and side-by-side on a common WCS grid | Validate usable target pixels, alignment and spectral comparability on the required targets; image availability alone is insufficient. |
| Test Barnard's Star, Epsilon Indi B, WISE 0855, RW Aurigae and R Draconis | All five presets have genuine bundled D3/12-arcminute field images; historical live evidence exists | Renew live evidence and record target visibility and limitations for every field. The default R Draconis center is masked, so its two images do not establish variability. |

## User requirement: updates from NASA's published archive

Treat access to newly published archive observations as required for this project, although ease of adopting new releases appears under the challenge's optional considerations.

Live access means querying published SPHEREx observations; it is not a real-time telescope feed. The current [IRSA access guide](https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-access/) states that ingestion is weekly and SIA2 availability can lag by about a day. The [DR1 overview](https://irsa.ipac.caltech.edu/data/SPHEREx/docs/overview_dr1.html) specifies DR1 and QR3 as a uniformly processed image set.

Implemented in this project:

- **Refresh from NASA Archive** explicitly bypasses both bundled and runtime caches, including for preset fields, via `POST /api/observation-jobs?refresh=true`.
- The refresh flag persists with jobs. Repeated active refreshes are deduplicated and requests remain rate limited and bounded.
- Fresh runtime results take priority over bundled snapshots. Failed refreshes do not replace cached images or become successful empty results.
- The UI distinguishes a cached preview from an archive query in the current session. Retry preserves the refresh request.
- **Experimental Visual Difference Preview**: Interactive Visual Difference Preview ($B - A$) enabled for real SPHEREx observations via dedicated endpoint `/api/difference-preview`, preserving separation from certified scientific subtraction (`/api/difference`), styled in amber (positive) and violet (negative) with prominent caveats.
- **Streamlined Explorer Interface**: Removed obstructive persistent warning banners from normal image browsing; comparison caveats and processing manifests remain accessible in the details panel and difference mode.

## Optional challenge considerations

| Consideration | Status |
| --- | --- |
| Creative display of 102 bands / detector coaddition | Six detector selections (D1–D6) and nominal wavelength windows exist; these are not 102 independent broadband images. |
| On-the-fly spectra | Available in spectral view; optional. |
| Add/subtract epochs | Experimental visual difference ($B - A$) implemented via `/api/difference-preview` with amber/violet residuals and caveats. Certified scientific subtraction remains restricted pending validation. |
| User-selectable field of view | Implemented for real fields from 2 to 30 arcminutes, with full decimal entry support. |
| Gaia / WISE overlays | Implemented, with independent external-service availability limits. |
| Coordinate URLs for embedding/sharing | Implemented with URL serialization and one-click copy. |
| Metadata / contamination flags | Implemented with provenance, masks and comparison-quality checks. |
| Existing astronomy libraries and viewers | Astropy and FITS/WCS processing are used; Aladin is an example, not a mandatory dependency. |
