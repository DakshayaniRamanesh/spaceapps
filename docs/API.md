# SkyTrace API v1

Run FastAPI on port 8000. Interactive OpenAPI documentation: `http://127.0.0.1:8000/docs`. The browser accesses the same endpoints through Next.js's `/api` proxy.

| Endpoint | Result |
| --- | --- |
| `GET /health` | Source, service status, real-data availability |
| `GET /api/presets` | Five reference fields with coordinates, classification, phenomenon, epoch and source |
| `GET /api/observations` | A validated, deterministic eight-frame manifest |
| `GET /api/frames/{frame_id}.png` | Actual PNG display image (384×384 RGB) |
| `GET /api/difference?frame_a=...&frame_b=...` | Actual signed B − A residual PNG |

## Request

```http
GET /api/observations?ra=269.452077&dec=4.693365&fov_arcmin=12&detector=D1
```

- `ra`: finite decimal degrees, 0 ≤ RA < 360; required.
- `dec`: finite decimal degrees, −90 ≤ Dec ≤ +90; required.
- `fov_arcmin`: finite 2–60, default 12; square field.
- `detector`: D1–D6, default D1.

RA/Dec normalize to six decimal places; FOV to four. RA just below 360 is clamped below 360 after rounding. IDs derive from the normalized request. Display and metadata use the same normalized values.

## Response

```json
{
  "source_type": "synthetic",
  "dataset_id": "skytrace-synthetic-v1-<field-hash>",
  "request": {"ra":269.452077,"dec":4.693365,"fov_arcmin":12,"detector":"D1"},
  "coordinate_system": "ICRS field center; illustrative local tangent offsets",
  "width":384,
  "height":384,
  "intensity_unit":"arbitrary simulation units",
  "wavelength_range_um":[0.75,1.09],
  "wavelength_model":"Illustrative array-dependent response; no per-pixel wavelength calibration",
  "frames":[
    {
      "id":"<opaque-frame-id>",
      "timestamp":"2025-01-15T03:24:00+00:00",
      "image_url":"/api/frames/<opaque-frame-id>.png",
      "detector":"D1",
      "source":"synthetic",
      "quality":{
        "registration":"Common synthetic tangent-plane grid",
        "noise_sigma":2.5,
        "masked_fraction":0.0,
        "calibrated":false
      }
    }
  ],
  "notice":"Synthetic observations. Motion, variability, dates and noise are illustrative, not measurements of the named target."
}
```

Example abbreviated to one frame; actual responses contain eight. Treat IDs as opaque and use the returned image URL. Metadata comes from Pydantic response models. The frontend shares `fov` in its user-facing URLs and translates it to `fov_arcmin` at the API boundary.

## Errors

- 422: invalid query, detector, nonfinite values or incompatible difference pair.
- 404: unknown/malformed frame ID, including an out-of-range frame index.
- 503: disabled IRSA provider requested.

Errors use FastAPI's standard `detail` response. Unexpected server errors are not disguised as synthetic success.

## Display and comparison

PNG content has `Content-Type: image/png`, `X-Data-Source: synthetic`, and a one-day browser cache lifetime. Difference images also declare `X-Difference-Sign: B-minus-A`. Zero difference maps to RGB (8,14,24), positive to amber, negative to violet, with a fixed nonlinear display stretch. Raw arrays are not clipped before subtraction. A fixed intensity stretch across epochs makes variability visible.

Frames from different coordinates, fields of view or detectors cannot be subtracted. Identical-frame subtraction is permitted and yields a neutral image, which is a useful sanity check. Arrays are reproducible after cache eviction or process restart. Caches retain up to eight field arrays, 128 rendered frames and 64 rendered differences per process.
