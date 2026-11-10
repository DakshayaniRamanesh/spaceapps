# Real SPHEREx data integration

## Current state

`OBSERVATION_SOURCE=synthetic` is the default and the only working provider. `OBSERVATION_SOURCE=irsa` selects an intentionally disabled adapter; observation requests return HTTP 503 with an explanatory error. No endpoint silently substitutes synthetic data for real data. `/health` identifies the source and reports `real_data_enabled: false`.

## Stable frontend boundary

The frontend requests a field and consumes an `ObservationSet`: source type, dataset ID, requested coordinates/FOV/detector, wavelength information, dimensions, notice, and time-ordered frames. A frame has an opaque ID, UTC timestamp, display-image endpoint, source, detector, and quality metadata. The frontend does not decode frame IDs or generate scientific images.

The working abstract provider has two operations:

1. `observations(FieldRequest) -> ObservationSet`
2. `array(frame_id) -> float32 image`

The display layer uses arrays for frame images and signed differences. A real implementation can retain these methods while adding persistent storage, masks/variance products, and richer frame records.

**Required contract extension before enabling real data:** the v1 Pydantic and TypeScript source literals currently accept only `synthetic` to prevent misleading labels. Add an explicit `spherex-irsa` source variant, real-data quality models, per-frame spectral selection metadata, and source-aware UI labels in a reviewed change. Keep the existing endpoint/field/frame shape so viewer, timeline, playback, and comparisons need no rewrite. Never simply relabel synthetic output.

## Proposed real-data pipeline

1. **Discover covering observations.** Use the currently documented IRSA SPHEREx archive search interface and product tables. Check coverage footprints, public release/version, observation time, detector and product availability. Do not hard-code assumed table names or undocumented cutout URLs.
2. **Acquire FITS products/cutouts.** Download only covering calibrated products. Retain original URLs, release identifiers, checksums and observation IDs. Use bounded storage and asynchronous jobs for larger requests.
3. **Read calibrated extensions.** Use Astropy FITS and WCS; inspect the actual release documentation for image, variance, masks and calibration metadata. Do not assume extension numbers or interpret detector counts as calibrated flux.
4. **Interpret wavelength position.** SPHEREx's linear variable filters make wavelength dependent on position. Associate sky pixels with the matching wavelength/passband and resolving power; retain the native spectral response and uncertainty. The six detector names alone do not define comparable spectral images.
5. **Select spectral comparability.** Query epochs that cover the requested region at compatible passbands. Reject or flag pairs that cannot be compared. Avoid presenting color differences caused by different passbands as time variability.
6. **Register a common WCS.** Choose a tangent-plane grid, pixel scale and footprint, including RA wrap, poles and coverage edges. Reproject flux consistently, propagate variance and masks, and document interpolation-induced covariance. Return registration uncertainty and usable overlap.
7. **Match measurement conditions.** Evaluate PSF differences, backgrounds, flux scales and calibration offsets before subtraction. For moving targets, distinguish background registration from source-centered registration. Derive exposure times from FITS; never reuse synthetic timestamps.
8. **Mask and propagate uncertainty.** Handle bad pixels, saturation, persistence, contamination and other release-specific flags. Form differences only in common valid coverage. Propagate variance for uncertainty/significance products; state independence/covariance assumptions. Significance is not the same as a stretched residual image.
9. **Render and disclose.** Use consistent stretch metadata, appropriate units and source labels. Return genuine quality flags and provenance. Explain missing coverage and low quality instead of manufacturing frames.
10. **Validate before activation.** Compare against IRSA reference displays and independently calculated cutouts. Test a stationary field, known moving object and variable source; validate spectral matching and uncertainty behavior with science review.

## Pair validation

Synthetic comparisons reject pairs from different normalized fields/detectors. Real comparisons must additionally check compatible spectral selection, common WCS, units, calibration, footprint, PSF and masks. An opaque persistent frame manifest should replace the synthetic self-describing ID scheme. Pair-specific processing can expose a job ID and polling state without rewriting the rendered viewer.

## Dependencies and infrastructure

Introduce Astropy, a documented IRSA query client, and a reprojection library only when this path is implemented. FITS storage, remote queries and registration work should run in a Python-capable service; preserve the Next.js API proxy and the existing UI. Add cancellation, timeouts, bounded concurrency and provenance-aware caches. Keep credentials server-side if an archive service requires authentication.

## Reference documentation

Reviewed 2026-11-10:

- https://spherex.caltech.edu/page/instrument
- https://irsa.ipac.caltech.edu/onlinehelp/spherex/spherex/overview.html
- https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-products/

These links are the starting point for integration, not evidence that this application has already ingested their products. Consult the current release's explanatory supplement before coding extension or flag handling.
