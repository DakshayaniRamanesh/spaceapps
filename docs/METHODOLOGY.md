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

FITS DATE-OBS (UTC), with MJD-OBS fallback, supplies the timestamp. Product release date and download date are not used as observation epochs. Named-target presets are reference sky positions, not source detections. Some positions are J2000; WISE 0855 has an unspecified coordinate epoch in the challenge brief. Trusted proper-motion propagation and parallax fitting are deferred. User-entered coordinates always select a fixed sky field, never a recentered moving-source frame.

## Synthetic development mode

The preserved simulator generates deterministic float32 fields with seeded noise, an exaggerated moving source and a variable source. Its arbitrary units, eight illustrative dates, detector responses and common tangent grid are not observations of the named targets. Synthetic difference images calculate B − A on the float arrays before color rendering. Negative values are violet; positive values amber. Production blocks synthetic frames unless the development UI and backend flags are both explicitly set.

## References

- https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-access/
- https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-products/
- https://caltech-ipac.github.io/irsa-tutorials/spherex-intro/
- https://caltech-ipac.github.io/irsa-tutorials/spherex-cutouts/
