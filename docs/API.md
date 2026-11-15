# SkyTrace API v2.1

Real source identifier: `spherex-irsa`. Synthetic source identifier: `synthetic`.
The environment setting `OBSERVATION_SOURCE=irsa` (the default) enables the real-data workflow. It does not enable scientific subtraction.

## Workflow

1. `GET /health`: service status, source, `real_data_enabled`, `scientific_subtraction_enabled`, schema version and maximum FOV. Health describes this service, not current IRSA uptime.
2. `POST /api/observation-jobs` with `{ra, dec, fov_arcmin, detector}`. RA is decimal degrees [0,360), Dec [-90,90], FOV [2,30] arcminutes, detector D1–D6. Nonfinite values are rejected. Returns 200 for a cached ready result or 202 with a queued/running job. Synthetic mode returns 409.
3. `GET /api/jobs/{job_id}`: `queued | running | ready | failed`, stage, request and optional result URL, dataset ID, error code/message. Job failures do not mean no coverage.
4. Fetch `result_url`, which points to `GET /api/observation-sets/{dataset_id}`.

`GET /api/observations?ra=...&dec=...&fov_arcmin=...&detector=D3` serves an already prepared set. It returns 409 for an uncached real field; it does not synchronously start expensive processing. The explicitly enabled synthetic provider retains its synchronous numerical demonstration.

## ObservationSet (schema version 2)

A manifest includes source type, dataset ID, canonical request, UTC creation time, processing version, grid/WCS, dimensions, intensity units, detector range, wavelength model, shared display stretch, frames, pair assessments, warnings and search scope.

Availability is separate from job status:

- `no_coverage`: no matching records in a completed query of the specified collections.
- `single_epoch`: only one prepared exposure in a completed assessment.
- `preview`: multiple prepared exposures; this does not certify time variability.
- `search_incomplete`: metadata or cutout assessment was bounded/partial. Counts show assessed versus discovered records. Other compatible observations may exist.
- `comparable`: reserved for a future validated science workflow, not emitted by the real-data preview processor.

Each real frame requires archive observation ID, collection, original access URL and SHA-256. Additional fields preserve the exact cutout URL, pipeline version, download time, FITS observation time, center wavelength/bandwidth and quality policy. `IMAGE` calibration does not mean a pair is validated for subtraction.

Each pair records its frame IDs, `comparison_status`, `difference_allowed`, reason, sky/spectral overlap fractions and individual pass/review/blocked checks. An unknown check never passes. The current real-data release always sets `difference_allowed=false`.

## Products

- `GET /api/frames/{frame_id}.png`: preview with source header; transparent missing pixels.
- `GET /api/frames/{frame_id}/original.fits`: exact cached IRSA cutout bytes, available even if IRSA is temporarily down. SHA-256 is in the manifest.
- `GET /api/frames/{frame_id}/science.npz`: float science/variance/wavelength/bandwidth arrays and boolean missing-data mask. `allow_pickle=False` when reading with NumPy. Arrays retain FITS lower-left orientation; PNGs are flipped vertically for north-up browser display.
- `GET /api/observation-sets/{dataset_id}/manifest.json`: downloadable provenance and processing manifest.
- `GET /api/difference?frame_a=...&frame_b=...`: real pairs return 422; invalid identifiers return 404. Synthetic registered pairs return B − A PNGs; mixed sources/fields/detectors are rejected.
- `GET /api/presets`: the five challenge reference positions and coordinate provenance.

## Bounds and persistence

One worker processes at most one job; at most six jobs are queued/running in total. Uncached job submissions are limited to 12/minute per direct API client address; no client-provided forwarded IP is trusted. A same-host reverse proxy shares this admission budget. Cached featured results do not consume the archive-admission budget. Queue pressure returns 429 with Retry-After.

Each job has a 240-second archive time budget, 120 MiB total download budget, 20 MiB per cutout, 5 MiB per metadata response, a requested 2–50 shortlisted-download cap (default 12), and 2–30 arcminute FOV. Search metadata and scientific preparation can be incomplete even if some PNGs are ready. Requests use an explicit IRSA host/path allowlist and reject redirects.

Runtime positive cache TTL is 24 hours; negative cache TTL is one hour. About 1 GiB of completed runtime datasets is retained, plus the active job. Pruning can expire old URLs. Featured snapshots are immutable and have no runtime TTL. Use one process/replica per data directory; SQLite job recovery marks interrupted work failed after restart. The first version is not a distributed task service.

## Catalogue overlays

### Combined Explorer selections

Both observation GET parameters and POST job bodies accept `limit` (2–50, default 12), `spread` (default false), ISO `start_date` / `end_date`, and optional positive finite `min_wavelength_um` / `max_wavelength_um`. Dates are ordered and include the entire UTC end date; wavelength bounds are inclusive and ordered. Synthetic data rejects wavelength filters. Real custom searches remain asynchronous through `/api/observation-jobs`; the GET endpoint reads prepared results. The field-center WCS-WAVE measurement supplies both `lambda_um` and the compatible `wavelength_um` alias; unknown values stay null.

Date and wavelength selections, monthly sampling and the cap can filter an existing cached preview without contacting IRSA. Such a derived manifest explicitly says it is a **cached preview subset**, sets `search_complete=false`, keeps the exact source frame URLs and WCS, and does not claim a new full archive search. Requests above the default 12-epoch cap require a new bounded archive job. Custom jobs honor the selection while retaining the 240-second / 120 MiB budgets, so a requested 50 epochs is a maximum, not a guaranteed count. Monthly spacing is a SkyTrace heuristic (30-day bins with at least 29 days between selected epochs).

`GET /api/frames/{frame_id}.png?overlay=mask` highlights excluded/missing pixels in amber using the exact stored science mask and PNG vertical orientation; good image pixels retain the shared stretch unchanged. Real-image `/api/difference` remains blocked, including significance-view requests. The former coordinate-only `/api/catalog/gaia` path is replaced by the dataset-aware endpoint below.

### Catalogue contract

`GET /api/observation-sets/{dataset_id}/catalogues/{catalogue}?limit=500`

`catalogue` is `gaia` (ESA `gaiadr3.gaia_source`, Gaia DR3) or `wise` (IRSA `allwise_p3as_psd`, **AllWISE Source Catalog**, not NEOWISE time series). `limit` is an integer from 1–1000; default 500. The existing same-origin `/api` rewrite proxies this endpoint. No arbitrary URLs, ADQL, coordinates, frame IDs or epoch options are accepted. All frame IDs and epochs come from the stored dataset. This bounded synchronous path does not enter the FITS job queue.

Response fields (also exposed in FastAPI OpenAPI via the `Overlay` response model):

| Field | Meaning |
| --- | --- |
| `dataset_id`, `catalogue`, `release` | Exact dataset, layer and selected release |
| `width`, `height` | Manifest common output PNG dimensions |
| `frames` | Frame-ID to observation UTC timestamp map; all frames projected together |
| `sources` | Entries inside at least one frame, with exact string `source_id` |
| Source `ra`, `dec`, `reference_epoch` | Original catalogue coordinates in degrees, Julian reference year when supplied (Gaia TCB); AllWISE epoch null |
| Source `pmra`, `pmdec`, `proper_motion_unit` | Nullable mas/yr; RA component includes cos(dec) |
| Source `magnitudes`, `quality`, `warnings` | Labelled passbands (Gaia G, WISE W1/W2); RUWE or AllWISE `ph_qual`/`cc_flags`; caveats |
| Source `positions` | Frame-ID to `{x,y,ra,dec,treatment}`; absent if outside that frame |
| Position `x`, `y` | Zero-origin PNG pixel centers; top-left origin. CSS position is `(x+.5)/width`, `(y+.5)/height` |
| Position `treatment` | `propagated_position`, `catalogue_position`, or `propagation_unavailable` |
| `retrieved_at`, `provenance_url`, `service_url` | UTC retrieval time and fixed official documentation/service links |
| `result_limit`, `preselection_count`, `truncated` | Cone-query row cap, retained preselection rows and extra-row overflow detection |
| `query_radius_deg`, `motion_margin_arcsec` | Spherical WCS footprint cone radius and Gaia 120 arcsec expansion |
| `completeness`, `warnings` | Explicit limited-inventory and science caveats |

All missing measurements are JSON null. Identifiers are never parsed as floating point. Sources are ordered by ascending Gaia G or AllWISE W1 and identifier as a deterministic tie breaker; no photometric quality cut is imposed. The cap applies **before** clipping to the image; the displayed count may therefore be much smaller. Fetching cap+1 detects truncation; a truncated query never claims an inventory of the field.

Errors: 404 unknown/expired dataset; 422 invalid catalogue/limit; 409 synthetic, empty or unsupported/missing WCS; 503 timeout, upstream rate limit, malformed response or service busy, with `Retry-After: 30`. A failure is never returned or cached as a successful empty layer. Redirects are rejected. Upstream connect timeout is 8 seconds, read timeout 25 seconds, with a streaming elapsed-budget check of 30 seconds and a 2 MiB body ceiling. One in-flight query per catalogue per API process bounds upstream concurrency; busy callers get a retryable error without queued FITS work.

Separate in-memory LRU caches hold raw queries and projected frame batches (32 entries each, 15-minute success TTL, 60-second empty-query TTL). Keys include processing version, release, exact generated geometry/query and cap; projection keys additionally include dataset ID, exact WCS, dimensions and frame IDs/times. No failure caching or automatic retry. Browser caches successful layer results for the current mounted field and aborts obsolete requests; playback, zoom, pan and repeated toggles do not request new queries. Changing datasets clears selections and layers.
