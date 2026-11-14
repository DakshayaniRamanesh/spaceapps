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

RA/Dec normalize to six decimal places; FOV to four. RA just below 360 is clamped below 360 after rounding.

## Real Data Response (`source_type: "spherex-irsa"`)

```json
{
  "source_type": "spherex-irsa",
  "dataset_id": "spx-dr1-<hash>",
  "request": {
    "ra": 304.6935,
    "dec": 42.4436,
    "fov_arcmin": 12.0,
    "detector": "D1"
  },
  "coordinate_system": "ICRS",
  "width": 384,
  "height": 384,
  "intensity_unit": "MJy / sr",
  "wavelength_range_um": [0.75, 1.09],
  "wavelength_model": "calibrated spectrophotometric position response",
  "release": "DR1+QR3",
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
