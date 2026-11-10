# Synthetic data methodology

The purpose is to demonstrate time-domain navigation, not to approximate SPHEREx performance. Version: `skytrace-synthetic-v1`.

## Catalogue and geometry

A SHA-256-derived random seed from normalized center RA/Dec creates 2,600 stars distributed over a 62×62 arcminute local field, plus 14 central demonstration stars. The population is fixed when FOV or detector changes. Positions are local offsets, with raster x toward illustrative west and raster y toward illustrative south; the displayed compass uses north-up/east-left. This is not an astrometrically calibrated FITS WCS.

The 384×384 output maps the requested 2–60 arcminute square extent to pixels. Increasing FOV reveals more angular area and shrinks source separations in pixels. Different center coordinates seed different local catalogues: overlapping center requests do not reconstruct a continuous all-sky catalogue. No projection is used to infer per-pixel RA/Dec near poles or wrap boundaries.

## Sources and epochs

Static flux amplitudes follow a lognormal distribution, with per-source illustrative response slopes. Six detector selections change those amplitudes exponentially and increase the Gaussian PSF sigma from 1.15 to 1.75 pixels. These response coefficients are arbitrary and not measured filter curves. PSF width is a display-scale parameter, not an angular instrument PSF.

One source moves 0.14 arcminute horizontally and −0.075 arcminute vertically per epoch, starting near field center. Another remains fixed and changes peak amplitude sinusoidally across eight epochs. Those motions and amplitudes are independent of the chosen target's actual measured properties. At 2′–60′, the selected FOV changes their displayed separation accordingly.

The timestamps are eight synthetic epochs spaced 90 days apart from 2025-01-15 03:24 UTC. They do not represent SPHEREx observing cadence or acquisition dates. All static sources have exactly the same grid positions at every epoch. No atmosphere, parallax, real proper-motion solution, PSF drift, cosmological model, detector artifacts, source confusion treatment, or uncertainty propagation is simulated.

## Background and noise

Each float32 frame starts with a low smooth sinusoidal background around 20 arbitrary units. Gaussian source profiles are accumulated in bounded patches. Independent, reproducible Gaussian noise of sigma 2.5 is added per epoch, seeded by the full field request and frame index. The model does not use photon-counting Poisson noise.

## Rendering and subtraction

Frame display uses `arcsinh(max(array − 15, 0) / 12) / arcsinh(1500 / 12)`, clipped only for display and tinted slightly blue. This fixed stretch is shared by all frames; automatic per-frame normalization would hide variability and is intentionally avoided.

Difference arithmetic is `float32(B) − float32(A)` on unrendered arrays. Absolute residual is stretched with `arcsinh(abs(diff)/8) / arcsinh(1000/8)` and clipped to [0,1]. Positive residuals use amber, negative residuals violet, and zero uses a dark neutral color. Random noise remains in the result. The PNG is a display product, not a significance map or a calibrated photometric measurement.

## Provenance

Four preset centers were copied from SIMBAD ICRS J2000 reference coordinates on 2026-11-10. WISE 0855 uses the exact sexagesimal coordinates in the project brief, converted to degrees; no epoch was supplied. `scripts/make_presets.py` records the originals and conversions. Source URLs and verification state are in `presets.json`. No proper motion is applied to reference centers.

Hero imagery is separately generated non-scientific artwork. Landing-story frames are precomputed by this backend provider and clearly labeled. The explorer requests the backend at runtime for every field manifest; no hidden frontend synthetic provider substitutes for a failed API.
