# Processing methods and scientific limits

## Real SPHEREx previews

SkyTrace queries the documented IRSA SIA2 DR1 and QR3 wide-survey collections for exposures containing the requested center. Deep-survey collections and coadded all-sky spectral cubes are not part of this temporal workflow. A result is scoped to the collections queried, not all possible NASA data.

Discovery deduplicates observation/detector identities. An approximate detector-position/orientation estimate from published footprints prioritizes potentially similar passbands; it is only a download-ranking heuristic. Candidates are spread over observation time within a maximum of 12 downloads. Exact wavelength screening uses the downloaded FITS, never the footprint estimate. The inventory records all discovered candidate URLs and observation MJDs.

Detector-aligned cutouts are padded by sqrt(2) and an interpolation margin to cover a rotated north-up output square. Output sampling is approximately 6.15 arcseconds/pixel, rather than interpolating to an artificial high-resolution grid. Partial physical detector coverage remains transparent and is quantified.

## Pixel policy and units

IMAGE is calibrated MJy/sr; VARIANCE is (MJy/sr)^2. Shapes and units are checked. We decode FLAGS bit names from the product header. SOURCE and FULLSAMPLE are retained; all other set bits, including unknown bits, are conservatively excluded. Nonfinite IMAGE/VARIANCE/ZODI or nonpositive variance also exclude a pixel.

We subtract the supplied ZODI model once from Level-2 IMAGE. This does not remove every background or incorporate zodiacal-model uncertainty. The originals remain byte-for-byte intact, named by SHA-256. The frame quality report includes the requested center pixel and valid fraction within a two-native-pixel radius. Global coverage can be high while a bright source core is entirely masked. That region is not usable for target brightness measurements. Negative science values remain valid; no gap filling or clipping is applied to measurement arrays.

## Celestial registration and uncertainties

Astropy celestial WCS maps each output ICRS TAN pixel to each input cutout. All four bilinear contributors must be valid. If weights are w_i, brightness is sum(w_i I_i), while approximate variance is sum(w_i^2 V_i). Reprojecting a variance as though it were an intensity is incorrect. Neighboring output pixels are correlated; covariance, calibration and foreground systematics are not modeled. No calibrated significance is reported.

North is up and east is left. Numeric arrays retain FITS row orientation; only the display PNG is flipped. One pooled 1st-to-99.7th-percentile asinh stretch is used across all displayed epochs. Display normalization never changes numeric science values.

Registration diagnostics use mutually matched bright field-source centroids after WCS reprojection, excluding the center target. At least three matches are required. The empirical screening threshold is RMS <=0.30 native pixels. This is a conservative prototype heuristic, not a mission accuracy specification; blends, undersampling, centroid errors and source changes can affect the diagnostic. No automatic astrometric correction is fitted to make a pair pass.

## Wavelength and comparison permissions

WCS-WAVE is evaluated at output-pixel positions in each original detector mapping, with the spectral lookup separated from celestial SIP. We record center wavelength/bandwidth and preserve per-pixel maps. WCS-WAVE is visualization-grade. Analysis-grade CWAVE/CBAND and spectral-response verification are not implemented in this release.

The preliminary screening rule is |lambda_A-lambda_B| <= 0.25 min(bandwidth_A, bandwidth_B). We measure its satisfied fraction across valid overlapping pixels; a center-only match does not approve the field. Preview screening requires at least 80% valid sky overlap and at least 90% spectral agreement within that overlap. These thresholds rank previews; they do not certify identical response curves.

A displayed multi-frame group must meet the spectral/coverage screen for every pair, not just adjacent dates. If none exists in the bounded sample, labeled spectrally different previews can still be shown with a warning. This is not evidence of brightness variability. Pair evidence also records registration, distinct observation times, and unresolved spectral-calibration, PSF/background and uncertainty checks.

**Real scientific subtraction remains disabled on both server and client.** WCS alignment and a PNG are insufficient to approve a difference. The featured pair's measured registration diagnostic also exceeds the conservative screening threshold. Claims of a discovered moving object, calibrated light curve, exact detection significance or proper motion are outside this release.

## Coordinates and temporal truth

FITS DATE-OBS (UTC), with MJD-OBS fallback, supplies the timestamp. Product release date and download date are not used as observation epochs. Named-target presets are reference sky positions, not source detections. Some positions are J2000; WISE 0855 has an unspecified coordinate epoch in the challenge brief. Preset recentering and parallax fitting are deferred. User-entered coordinates always select a fixed sky field, never a recentered moving-source frame.

## Gaia DR3 and AllWISE reference overlays

The Explorer's compact Catalogue overlays panel below the viewer independently enables Gaia DR3 circles and WISE / AllWISE Source Catalog diamonds. Both are off initially. These identify catalogue entries for context, never detections, discoveries, cross-matches or measured motion in SPHEREx. Magnitudes retain their exact passband labels and are not directly comparable with SPHEREx intensity. Entries can be selected by click/tap, keyboard, or the source picker; the picker keeps coincident entries inspectable without assigning a shared physical identity.

Gaia uses the public ESA TAP service and `gaiadr3.gaia_source` (`source_id`, `ra`, `dec`, `ref_epoch`, `pmra`, `pmdec`, `phot_g_mean_mag`, `ruwe`). AllWISE uses IRSA TAP and `allwise_p3as_psd` (`designation`, `ra`, `dec`, `w1mpro`, `w2mpro`, `ph_qual`, `cc_flags`). AllWISE is the 2013 combined WISE release, not a time-resolved WISE exposure catalogue. Its static `ra`/`dec` have no single supplied reference epoch here; J2000 must not be substituted for that missing epoch. AllWISE motion-fit coordinates are deliberately not used.

Projection reconstructs the exact explicit ICRS TAN WCS stored in the manifest. It does not recreate the grid from the requested field size. The query center is the sky coordinate of the image center. The spherical separation to all four outer pixel corners supplies an enclosing cone, including the corners, across RA=0 and near the poles. This relies on the supported TAN footprint (at most one degree radius); unsupported or incomplete older grids are refused. Returned sources are projected with Astropy's zero-origin `world_to_pixel` and retained inside pixel edges `[-.5,width-.5)` / `[-.5,height-.5)`. The PNG vertical flip is applied exactly once: `png_y = height - 1 - fits_y`. Browser placement adds half a pixel to convert pixel centers to image-edge fractions. A ResizeObserver fits the common image rectangle inside each image port; image and marker plane share the same zoom/pan transform and are clipped to image and port. No linear RA/Dec-to-CSS conversion is used.

Gaia sources with both proper-motion components and a reference epoch use Astropy `SkyCoord.apply_space_motion` from the catalogue's Julian TCB epoch to each frame's actual UTC observation date. This is angular motion without distance/radial-velocity information: annual parallax, perspective acceleration, binary motion and uncertainty propagation are not modeled. Missing astrometry retains the catalogue coordinate with `propagation_unavailable`; missing motion is never replaced by a measured zero. AllWISE retains its catalogue position, labelled `catalogue_position`. Positions are batched for all frames once and reused during single playback, blink and split viewing. There is no claim of measured motion from catalogue/image offsets.

The Gaia cone adds a fixed **120 arcsec** margin to admit sources outside the original field. This is bounded preselection, not a completeness guarantee: motion exceeding the margin, unmodeled astrometry and brightness/result caps can omit sources. The default cap of 500 (maximum 1000) bounds marker DOM nodes and all-frame projection cost in 2–30 arcminute Explorer fields, rather than attempting dense-field completeness. Results are brightness ordered; the cap covers the padded cone before projection, so even an empty projected field may have a truncated cone. Counts refer to entries inside the active image (or either split image), not confirmed detections or a complete inventory. Quality indicators are reported without silently certifying positions. See API.md for timeouts, cache lifetimes and retry states. Synthetic fields and missing WCS explicitly disable accurate real overlays.

Attribution and authoritative schemas/services:

- [ESA Gaia DR3](https://www.cosmos.esa.int/web/gaia/dr3), [Gaia archive](https://gea.esac.esa.int/archive/) (ESA/Gaia/DPAC).
- [AllWISE release documentation](https://wise2.ipac.caltech.edu/docs/release/allwise/), [AllWISE source-table columns](https://wise2.ipac.caltech.edu/docs/release/allwise/expsup/sec2_1a.html) (NASA/JPL-Caltech/UCLA; NASA/IPAC IRSA).
- [IRSA TAP protocol and schema discovery](https://irsa.ipac.caltech.edu/docs/program_interface/TAP.html).
- [Astropy space motion](https://docs.astropy.org/en/stable/coordinates/apply_space_motion.html).

Verification commands from the repository root (Windows: use `npm.cmd` and `backend/.venv/Scripts/python.exe` if needed):

```text
python -m pytest
npm --prefix frontend test
npm --prefix frontend run typecheck
npm --prefix frontend run build
npm --prefix frontend run test:e2e
python scripts/check_catalogues.py
```

Backend tests mock upstream CSV transport and cover orientation with asymmetric, off-center rectangular-grid fixtures, wrapping/polar geometry, propagation/fallback, identifiers, cache/limits and errors. Browser catalogue tests mock catalogue responses separately from genuine bundled SPHEREx imagery, covering layer states, accessibility, viewport registration, frame changes and split/blink modes. Screenshot names containing `fixture` show test catalogue positions, not live service verification. The live script queries both real services and prints success/failure without inventing fallback sources.

## Synthetic development mode

The preserved simulator generates deterministic float32 fields with seeded noise, an exaggerated moving source and a variable source. Its arbitrary units, eight illustrative dates, detector responses and common tangent grid are not observations of the named targets. Synthetic difference images calculate B − A on the float arrays before color rendering. Negative values are violet; positive values amber. Production blocks synthetic frames unless the development UI and backend flags are both explicitly set.

## References

- https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-access/
- https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-products/
- https://caltech-ipac.github.io/irsa-tutorials/spherex-intro/
- https://caltech-ipac.github.io/irsa-tutorials/spherex-cutouts/
