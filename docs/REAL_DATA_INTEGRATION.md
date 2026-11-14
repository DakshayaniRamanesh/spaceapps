# Real SPHEREx Data Integration

## Implementation Status (Phase B Complete)

Real data integration with NASA/IPAC IRSA SPHEREx DR1 and QR3 collections is implemented and validated.

- **Data source:** Genuine public SPHEREx DR1 and QR3 Level 2 spectral image cutouts (DOI: 10.26131/IRSA678).
- **Service endpoints:**
  - Query discovery via IVOA Simple Image Access (SIA) protocol (`https://irsa.ipac.caltech.edu/SIA`) and Table Access Protocol (TAP) (`https://irsa.ipac.caltech.edu/TAP`).
  - Spatial cutouts retrieved directly from IRSA Image Bridge Architecture (IBE) service (`https://irsa.ipac.caltech.edu/ibe/data/...`).
- **FITS MEF Structure:**
  - 7 HDUs parsed: `PRIMARY` (pipeline version), `IMAGE` (calibrated flux in `MJy / sr`), `FLAGS` (quality bitmask), `VARIANCE`, `ZODI` (zodiacal light model), `EPSF` (effective point-spread function table), `WCS-WAVE` (spectral wavelength lookup grid).
- **WCS & Astrometric Registration:**
  - Spatial WCS: `WCS(hdulist['IMAGE'].header)` with `RA---TAN-SIP` distortion.
  - Common tangent-plane grid: Reprojected using Astropy and `reproject.reproject_interp` onto a shared sky grid centered at the target (RA, Dec) with dimensions 384×384.
  - Spectral WCS: Position-dependent central wavelength and bandwidth computed via `WCS(hdulist['IMAGE'].header, fobj=hdulist, key="W")`.
- **Display & Differencing:**
  - `render_science_frame`: Robust astronomical arcsinh intensity stretch calibrated for `MJy / sr` units, mapping to the SkyTrace cool monochrome palette.
  - `render_difference_frame`: Calibrated `D = B - A` float32 subtraction on the common sky grid with signed color mapping (Amber for flux gain, Violet for flux loss, Dark neutral for zero/uncovered footprint).

## Switching Data Sources

Configure via environment variable `OBSERVATION_SOURCE`:

```bash
# Enable real SPHEREx DR1+QR3 public archival data:
export OBSERVATION_SOURCE=irsa

# Enable synthetic demonstration data (illustrative simulation):
export OBSERVATION_SOURCE=synthetic
```

When `OBSERVATION_SOURCE=irsa`:
- `/health` reports `status: "ok"`, `source: "spherex-irsa"`, `real_data_enabled: true`.
- `/api/observations` returns real timestamps, archive product IDs, provenance URLs, and `source_type: "spherex-irsa"`.
- Empty coverage: If a requested valid celestial coordinate has no covering observations in DR1+QR3, the API returns HTTP 200 with `frames: []` and an explicit notice, safely handled by the frontend empty observatory view.

## Offline Fixtures & CI Testing

For deterministic offline testing without remote IRSA network dependency:
- Set `SPHEREX_FIXTURES_MODE=1`.
- Tests use realistic 7-HDU FITS cutouts in `backend/tests/fixtures/`.
- Offline fixtures cover two genuine observation epochs with known stellar positions, moving source, variable source, bad pixel mask, and variance.

## Verified Test Coverage

- 34/34 backend tests pass across `test_api.py`, `test_api_real.py`, `test_fits_loader.py`, `test_registration.py`, and `test_difference.py`.
- 8/8 frontend unit tests pass across coordinates and source policy guards.
- Next.js typecheck (`next typegen && tsc --noEmit`) passes with 0 errors.
- Production build (`npm run build`) builds all static routes cleanly.
