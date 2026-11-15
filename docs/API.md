# SkyTrace API v2

Run FastAPI on port 8000. Interactive OpenAPI documentation: `http://127.0.0.1:8000/docs`. The browser accesses the same endpoints through Next.js's `/api` proxy.

| Endpoint | Result |
| --- | --- |
| `GET /health` | Source (`synthetic` or `spherex-irsa`), service status, real-data availability |
| `GET /api/presets` | Reference fields with coordinates, classification, phenomenon, epoch and source |
| `GET /api/observations` | Validated observation set manifest (real SPHEREx DR1+QR3 or synthetic) |
| `GET /api/frames/{frame_id}.png` | Actual PNG display image (384×384 RGB) with source header |
| `GET /api/difference?frame_a=...&frame_b=...` | Actual signed B − A residual PNG on common WCS grid |

## Request

```http
GET /api/observations?ra=269.452077&dec=4.693365&fov_arcmin=12&detector=D1
```

- `ra`: finite decimal degrees, 0 ≤ RA < 360; required.
- `dec`: finite decimal degrees, −90 ≤ Dec ≤ +90; required.
- `fov_arcmin`: finite 2–60, default 12; square field.
- `detector`: D1–D6, default D1.
- `min_wavelength_um` / `max_wavelength_um`: optional positive, finite microns.
  Inclusive bounds on the **field-center** central wavelength from `WCS-WAVE`;
  either may be omitted. Minimum must not exceed maximum. Invalid bounds return
  422. Synthetic mode rejects wavelength filters with 422 because it has no
  measured spectral metadata.
- `limit`: integer 2–50, default 12. Maximum number of epochs shortlisted.
- `start_date` / `end_date`: optional ISO dates (`YYYY-MM-DD`, UTC, inclusive)
  filtering observation time. When both are supplied, `start_date` must be
  earlier than `end_date`.
- `spread`: boolean, default `false`. When true, samples approximately one
  exposure per 30-day bin across the survey (a SkyTrace heuristic, not a mission
  standard); selected epochs are kept at least 29 days apart.

For example:

```http
GET /api/observations?ra=269.452077&dec=4.693365&fov_arcmin=12&detector=D1&limit=24&spread=true
```

RA/Dec normalize to six decimal places; FOV to four. RA just below 360 is clamped below 360 after rounding.

Wavelength filtering runs **after** the existing date/detector/epoch shortlist,
so `limit` remains the maximum number of exposures inspected, rather than a
guaranteed number of spectral matches. `total_candidates` still counts archive
candidates before epoch shortlisting and wavelength filtering. Unknown wavelengths
are excluded when either bound is set; without bounds, those epochs remain
available with null spectral values. The response notice reports the number
of matches and incomplete metadata. Increase `limit` or change the epoch window
if too few matches remain. Cutout downloads are cached and limited to four at
once; retrieving spectral metadata can lengthen the first manifest request.

```http
GET /api/observations?ra=304.6935&dec=42.4436&detector=D1&limit=24&min_wavelength_um=0.9&max_wavelength_um=0.98
```

The explorer provides three sub-band buttons and 17 nominal channel windows per
detector (102 total), plus custom bounds. Channel windows come from the
`SPECTRAL_CHANNELS` table (`WL_MIN` / `WL_MAX`) in IRSA's
[cal-sch-v2-2026-229 product](https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/spectral_channels/cal-sch-v2-2026-229/spectral_channels_spx_cal-sch-v2-2026-229.fits).
They can overlap and extend slightly beyond the rounded detector ranges.
They select wavelength windows, not geometric channel membership. Changing
detector clears the pending window; sharing or reloading a field preserves the
submitted bounds as `min_wavelength_um` / `max_wavelength_um` URL parameters.

IRSA describes [WCS-WAVE as visualization-grade](https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-products/).
The displayed λ₀ and Δλ are interpolated at the requested sky position for each
epoch, with no detector-midpoint fallback. Matching λ₀ alone does not establish
identical spectral response or validate a photometric comparison. Science
analysis requires the full spectral calibration products (CWAVE/CBAND).

## Real Data Response (`source_type: "spherex-irsa"`)

```json
{
  "source_type": "spherex-irsa",
  "dataset_id": "spx-dr1-<hash>",
  "request": {
    "ra": 304.6935,
    "dec": 42.4436,
    "fov_arcmin": 12.0,
    "detector": "D1",
    "min_wavelength_um": null,
    "max_wavelength_um": null
  },
  "coordinate_system": "ICRS",
  "width": 384,
  "height": 384,
  "intensity_unit": "MJy / sr",
  "wavelength_range_um": [0.75, 1.09],
  "wavelength_model": "Field-center WCS-WAVE lookup (visualization-grade); nominal detector range is not a per-frame passband",
  "release": "DR1+QR3",
  "total_candidates": 498,
  "epoch_selection": {
    "limit": 24,
    "spread": true,
    "start_mjd": null,
    "end_mjd": null
  },
  "frames": [
    {
      "id": "spx.D1.2025W18_1B_0074_2.60794016",
      "timestamp": "2025-04-29T00:24:27.897Z",
      "image_url": "/api/frames/spx.D1.2025W18_1B_0074_2.60794016.png",
      "detector": "D1",
      "source": "spherex-irsa",
      "product_id": "2025W18_1B_0074_2",
      "provenance_url": "https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/...",
      "wavelength_um": 0.753,
      "bandwidth_um": 0.018,
      "wavelength_source": "wcs-wave",
      "quality": {
        "registration": "Astropy WCS celestial TAN projection",
        "noise_sigma": 0.5,
        "masked_fraction": 0.0,
        "calibrated": true,
        "flags": ["calibrated_dr1_qr3"],
        "notes": ["Level 2 spectral image cutout"]
      }
    }
  ],
  "notice": "Actual archived SPHEREx data (DR1+QR3); calibrated spectral image cutouts from NASA/IPAC IRSA."
}
```

## Headers and Display

- Frame PNG: `Content-Type: image/png`, `X-Data-Source: spherex-irsa` (or `synthetic`).
- Difference PNG: `Content-Type: image/png`, `X-Data-Source: spherex-irsa`, `X-Difference-Sign: B-minus-A`.
- Color mapping: Amber = positive flux residual, Violet = negative flux residual, Dark neutral = zero or unobserved footprint.
