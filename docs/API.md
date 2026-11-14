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

Each job has a 240-second archive time budget, 120 MiB total download budget, 20 MiB per cutout, 5 MiB per metadata response, at most 12 shortlisted downloads, and 2–30 arcminute FOV. Search metadata and scientific preparation can be incomplete even if some PNGs are ready. Requests use an explicit IRSA host/path allowlist and reject redirects.

Runtime positive cache TTL is 24 hours; negative cache TTL is one hour. About 1 GiB of completed runtime datasets is retained, plus the active job. Pruning can expire old URLs. Featured snapshots are immutable and have no runtime TTL. Use one process/replica per data directory; SQLite job recovery marks interrupted work failed after restart. The first version is not a distributed task service.
