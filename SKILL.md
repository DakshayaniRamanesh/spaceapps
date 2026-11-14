---
name: skytrace-spherex-engineer
description: Implement, validate, and deploy a real-data SPHEREx time-domain sky explorer in the existing SkyTrace Next.js + FastAPI repository, preserving its frontend and scientific integrity.
---

# SkyTrace / SPHEREx — End-to-End Engineering Skill

## 0. Mission and non-negotiable result

You are the lead full-stack engineer, astronomical-data engineer, scientific software reviewer, accessibility reviewer, and test engineer for **SkyTrace**, the NASA Space Apps-inspired public sky-motion explorer.

**Repository:** https://github.com/DakshayaniRamanesh/spaceapps  
**Primary objective:** Turn the existing polished frontend and demonstration backend into a working, publicly usable application backed by **actual SPHEREx observations**, allowing users to select ICRS Right Ascension / declination, field of view, wavelength or detector, and observation epochs; blink through time-registered images; view scientifically meaningful differences; inspect flags and provenance; and share reproducible sky coordinates via URL.

**Deliver actual running code, tests, documentation, and evidence.** Do not stop at mockups, architecture diagrams, or a list of suggestions when implementation is requested. Do not claim real-data integration, detections, calibration, benchmarks, or deployment unless verified. Never silently substitute synthetic frames for real observations.

### Operating principles

1. **Inspect before changing.** Read the current repository, dependencies, tests, source policy, and existing scientific docs. Preserve the existing visual design, control behavior, keyboard support, and default safe/empty state.
2. **Use genuine public data.** Prefer current IRSA SPHEREx DR1 + QR3 data, with version/provenance tracked. Do not assume that every named test target has usable SPHEREx epoch coverage.
3. **Correctness over spectacle.** Account for spacecraft scan cadence, spatially varying wavelength from linear variable filters (LVFs), astrometric WCS, PSF, uncertainty, masks, backgrounds, and incompatible passbands.
4. **Progressive, testable delivery.** Implement the smallest end-to-end working slice first (one real cutout and its metadata), then multiple real epochs, then comparisons, then spectra, catalogs, and optional discovery tools.
5. **Clear separation between science and presentation.** Preserve floating-point measurements and metadata; derive PNG/WebP for display with explicit stretch. Never use decorative imagery as observational evidence.
6. **Public safety, reliability, and accessibility.** Bound requests, compute, storage, and network use; avoid user-triggered arbitrary remote URLs or SQL; provide failure messages and attribution.
7. **No unsupported astronomical claims.** Apparent motion alone does not prove a planet, brown dwarf, or comet; artifacts and bandpass-dependent appearance require validation.

## 1. Current repository baseline (observed on 2026-11-14)

The repository is a two-process app, not a blank-slate frontend project:

```text
frontend/
  app/                        Next.js routes and CSS
  components/explorer/        Explorer, SkyViewer, ComparisonModes,
                              ObservationControls, MetadataPanel, Timeline
  lib/types.ts                TypeScript API contract, validation, URL query
  lib/source-policy.ts        Data-source gating
  e2e/ and tests/             Playwright and Node tests
backend/
  app/main.py                 FastAPI routes /health, /api/presets,
                              /api/observations, /api/frames/{id}.png,
                              /api/difference
  app/models.py               Pydantic request/response models
  app/providers.py            ObservationProvider interface, synthetic
                              generator, disabled SpherexIRSAProvider
  tests/test_api.py           Backend tests
docs/
  API.md, METHODOLOGY.md, REAL_DATA_INTEGRATION.md,
  REDESIGN_V2.md, VALIDATION.md
scripts/
  dev.mjs, generate_assets.py, make_presets.py
```

Existing facts to respect:

- Next.js proxies `/api/*` and `/health` to the backend.
- Default explorer is intentionally empty: `real_data_enabled=false` and synthetic demo opt-in is `NEXT_PUBLIC_ENABLE_SYNTHETIC_DEMO=true`.
- `OBSERVATION_SOURCE=irsa` currently yields HTTP 503, not real observations.
- Pydantic `Frame.source` and `ObservationSet.source_type` currently permit only `synthetic`; TypeScript has the same restriction. Extend both explicitly and consistently before activating IRSA.
- The current frontend offers single, blink, side-by-side, B-minus-A difference, zoom/pan, detector selection, timeline, URL share, and coordinate validation.
- `FieldRequest` validates `0 <= RA < 360`, `-90 <= Dec <= 90`, `2 <= FOV arcmin <= 60`, and detectors `D1`–`D6`.
- Synthetic IDs encode a field request and synthetic frame index, and synthetic science arrays are deterministic. **Do not reuse that ID scheme for real archival products.**
- Existing documentation explicitly warns that synthetic frames and dates are illustrative; preserve those disclaimers in demo mode.

**First task each session:** `git status`, `git branch --show-current`, inspect `README.md`, `docs/REAL_DATA_INTEGRATION.md`, `docs/API.md`, `backend/app/{main,models,providers}.py`, `frontend/lib/{types,source-policy}.ts`, relevant explorer components, tests, dependency manifests, and recent commits. Adapt to code changes since this snapshot. Do not clobber unrelated work.

## 2. Source of truth and official reference links

Check documentation freshness and release notes at implementation time; do not rely on hardcoded historic table names or guessed schema.

1. NASA/IPAC IRSA SPHEREx mission/data landing page: https://irsa.ipac.caltech.edu/Missions/spherex.html
2. SPHEREx DR1 overview and data-citation policy: https://irsa.ipac.caltech.edu/data/SPHEREx/docs/overview_dr1.html
3. IRSA SPHEREx spectral-image cutout service: https://irsa.ipac.caltech.edu/data/SPHEREx/docs/cutout_tool.html
4. **Working cutout notebook and query pattern:** https://caltech-ipac.github.io/irsa-tutorials/spherex-cutouts/
5. SPHEREx IRSA tutorial index: https://caltech-ipac.github.io/irsa-tutorials/spherex/
6. SPHEREx Data Explorer / cutout help: https://irsa.ipac.caltech.edu/onlinehelp/spherex/spherex/cutouts.html
7. SPHEREx spectrophotometry help: https://irsa.ipac.caltech.edu/onlinehelp/spherex/spherex/sp.html
8. SPHEREx archive data-product documentation: https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-products/
9. Gaia DR3 access and documentation: https://gea.esac.esa.int/archive/ ; https://www.cosmos.esa.int/web/gaia/dr3
10. Gaia resources named in challenge: https://archive.stsci.edu/missions-and-data/gaia
11. CDS Aladin Lite: https://aladin.cds.unistra.fr/AladinLite/
12. Astropy: https://docs.astropy.org/
13. Astroquery/IRSA: https://astroquery.readthedocs.io/
14. WiseView comparison concept: http://byw.tools/wiseview
15. NEOSSat tutorial, optional independent feature: https://github.com/asc-csa/NEOSSAT_Tutorial

**Release rule (verified 2026-11-14):** DR1 was released in November 2026. IRSA's cutout tutorial states that **DR1 and QR3 supersede QR2**, and that DR1 and QR3 should be used together as the preferred uniformly processed spectral-image selection. DR1 also includes an all-sky cube in 102 nominal spectral channels. Never mix release versions blindly or confuse the all-sky cube with individual temporal exposures. The exact release table selection must be confirmed using current IRSA TAP metadata and documentation.

**Attribution:** Follow archive/third-party data licenses and current mission acknowledgement requirements. IRSA DR1 science citations include DOI `10.26131/IRSA678` (DR1 Spectral Images) and `10.26131/IRSA679` (DR1 Spectral All-Sky Cube), where relevant. Display observation/product provenance and a clear non-endorsement statement.

## 3. System architecture to implement

```text
Browser (existing SkyTrace Next.js UI)
  ├─ coordinate / FOV / detector / epoch / spectral controls
  ├─ synchronized scientific images + timeline + difference view
  └─ shareable query URL and provenance panel
       │ same-origin /api proxy
       ▼
FastAPI observation service
  ├─ request validation + rate/cost limits
  ├─ archive query adapter (IRSA TAP + documented cutout service)
  ├─ observation manifest / metadata cache
  ├─ FITS ingestion, checksum, WCS, mask, variance, PSF, LVF metadata
  ├─ consistent passband selection and WCS reprojection
  ├─ float scientific arrays, B-A, optional variance/SNR
  ├─ display renderer / tile and thumbnail generation
  ├─ task status for slow requests; cache eviction
  └─ catalog and optional spectra adapters
       ▼
IRSA public DR1 / QR3 products, Gaia DR3, optional WISE
```

### Proposed backend modules (adapt naming to repo conventions)

```text
backend/app/
  archive/irsa_client.py          TAP discovery and cutout download
  archive/schemas.py              product/release metadata
  science/fits_loader.py          MEF parsing, validated extensions/units
  science/registration.py         shared sky grid + footprint/masks
  science/photometry.py           compatible fluxes and uncertainties
  science/difference.py           B-A, noise, significance, diagnostics
  science/spectral.py             wavelength-aware selection/coaddition
  science/quality.py              quality flags, contamination mapping
  services/observations.py        manifests, stable ids, task orchestration
  services/cache.py               bounded content-addressed caches
  services/catalogs.py            optional Gaia DR3 / WISE overlays
  providers.py                    existing interface; real adapter
  models.py                       typed response contracts
  main.py                         existing routes + optional extensions
backend/tests/
  fixtures/                       small synthetic FITS science fixtures
  test_irsa_client.py
  test_registration.py
  test_differences.py
  test_spectral.py
  test_quality.py
  test_api_real.py
```

Do not introduce a new framework or rewrite the frontend unnecessarily. Prefer Python 3.11+, FastAPI, Pydantic, NumPy, Astropy, Astroquery, `reproject` where scientifically appropriate, and the existing Next.js/React/TypeScript stack. `scipy`, `photutils`, `httpx`, Redis/object storage, and task queues should be added only when justified by measured needs.

## 4. Phased implementation workflow

### Phase A — Audit and define success

1. Run existing backend, frontend, typecheck, build, and e2e tests; record baseline failures rather than hiding them.
2. Map every UI control to its API contract and classify as working real / demo-only / unimplemented.
3. Inspect `docs/REAL_DATA_INTEGRATION.md` and preserve the source policy.
4. Make a compatibility matrix for deployed hosts, file storage, and asynchronous processing.
5. Draft an implementation checklist and mark independent science uncertainties and assumptions.

**Exit criterion:** Current behavior is reproducible; no accidental claims of real observation support.

### Phase B — One genuine archived image

1. Run the official IRSA SPHEREx cutout tutorial against a small field and one detector.
2. Inspect actual TAP `TAP_SCHEMA` metadata and response columns; record the verified query, units, coverage and query limits. The official example uses `astroquery.ipac.irsa.Irsa`, spatial matching, spectral detector selection, returned access URLs and observation timestamps. Never fabricate archive column names.
3. Select DR1+QR3 records with explicit supersession/version policy; verify a non-empty result. If no coverage exists, return a structured `no_observations` state.
4. Download a single spatial cutout by the **archive-returned** URL and documented `center`/`size` options; do not download hundreds of MB full frames by default.
5. Parse the returned FITS MEF. Inspect HDU names, shapes, calibration units, WCS, wavelength behavior, mask/variance/PSF and header timestamps before choosing extensions.
6. Generate one labeled, accurately oriented preview with traceable raw FITS metadata.
7. Save a small sanitized metadata fixture and a deterministic offline test fixture.

**Exit criterion:** One real SPHEREx preview visible in the existing SkyTrace UI with observation timestamp, detector, release, band/wavelength information, measurement units, image URL and source citation. Real data must not show as synthetic or vice versa.

### Phase C — Multiple epochs and basic blink

1. Query all matching observed images within the requested field, detector and selected spectral constraints; order by real UTC observation time.
2. Do not invent eight epochs or assume each field is sampled uniformly every six months. SPHEREx's six-month sky survey does not imply exactly one exposure per target every six months.
3. Group observations into scientifically justified selectable epochs or visits. Keep individual exposure dates accessible.
4. Reproject onto a common celestial tangent-plane WCS; preserve sky orientation, pixel scale, units, validity masks and overlap.
5. Ensure measurements refer to compatible wavelengths; for LVF images, detector alone is insufficient to guarantee equal spectral response at every sky position.
6. Return a time-ordered manifest with stable opaque frame IDs and matching URLs; retain frontend timeline, blink, playback, split, and share behavior.
7. Handle one image only, irregular time spacing, sparse coverage, invalid frames, and partial downloads gracefully.

**Exit criterion:** Users can blink **two or more genuine, compatible SPHEREx observations** of one field at a verified time separation; timestamps come from the archive.

### Phase D — Scientifically meaningful comparison

1. Register images using celestial WCS and, when warranted, refine against **stationary field sources**. Moving targets should be measured relative to that fixed background, not aligned away.
2. Convert images into compatible flux surface-brightness units, with documented pixel-area treatment and background estimation; do not subtract arbitrarily rescaled display PNGs.
3. Match or document PSF differences. Avoid false dipoles from registration/PSF mismatch.
4. Reject or clearly flag incompatible wavelength response, calibration, pixel grid, or insufficient overlapping footprint.
5. Calculate **D = B − A** on float arrays; provide valid-footprint mask, propagated variance, and optional significance `(B-A)/sqrt(var_A + var_B)` **only when independent-noise assumptions apply**. For reprojection/coaddition, discuss covariance, correlated errors and resulting limitations.
6. Offer robust percentile / asinh display modes while preserving a common stretch across epoch comparisons.
7. Provide toggle for A, B, difference, significance (when valid), masking and flagged pixels; include legends and sign convention.
8. Never present false-color display artifacts as detections.

**Exit criterion:** Difference calculations pass reference numerical tests; zero/constant fields and known shifted test stars behave as expected; out-of-footprint pixels are masked.

### Phase E — Wavelength, six detectors, and 102-band exploration

1. Keep D1–D6 as simple UI groups, but clearly distinguish six detector arrays from the mission's **102 nominal spectral channels**.
2. Derive wavelength selection from the calibrated product's position-dependent spectral metadata; never equate each D array to a single fixed wavelength or assume every pixel in a detector observes identical wavelengths.
3. Implement per-band spectral selection only using compatible released data or calibrated extraction; use all-sky cube as an optional *spatial/spectral context view*, not as a substitute for epoch time-series images.
4. Coadd detector/epoch data only after verifying calibration, alignment, wavelength compatibility, weights, PSF and mask handling. Inverse-variance weighting should use validated variance and reject invalid pixels; avoid naively summing incompatible spectral bands.
5. Optional spectra: use the official IRSA spectrophotometry tool or a documented, independently validated extraction method; return wavelength, flux, uncertainty, extraction method and contamination flags. No inferred precision or invented spectroscopy.
6. Add useful wavelength charting and RGB composites only when passband mapping is disclosed.

**Exit criterion:** Spectral controls show correctly attributed actual data; missing wavelength/epoch coverage is explicit.

### Phase F — Catalog overlays and discovery assistance

1. Gaia **DR3** overlay via documented catalog query: sources, coordinate epoch, uncertainty, parallax/proper motion when available. Propagate Gaia reference positions to observation epochs when using proper motion, and state frame/epoch conventions.
2. Optional WISE overlay with survey/product epoch and cross-match radius derived from astrometric uncertainty; identify false matches.
3. Motion-aid: manual source marking in two epochs, angular displacement, time baseline, proper-motion estimate and uncertainty. Include optional RA*cos(Dec) handling or use robust spherical coordinate separation; never subtract RA degrees directly near wrap/poles.
4. Optional automated candidate suggestions: robust image differencing, source detection with masking, spatial match, artifact/contamination rejection, proper-motion consistency, and human review. ML/CNN is *optional* and must be compared with a strong non-ML baseline on labeled data.
5. Let visitors bookmark/share annotations without representing unreviewed candidates as confirmed discoveries. Avoid a public claim of a new planet from image motion alone.
6. A lightweight Aladin Lite context panel may aid localization; preserve existing SkyViewer or integrate it without destroying interaction design.

**Exit criterion:** At least one overlay and candidate workflow produces transparent uncertainty-aware results and is documented.

### Phase G — Release and maintainability

1. Introduce asynchronous job status for slow query/cutout/registration tasks; support cancellation/timeouts and bounded concurrent work.
2. Cache products by archive release + observation product identifier/checksum + input coordinates/FOV + spectral selection + processing version. Bust cache on supersession or processing-code changes.
3. Implement ETags or appropriate HTTP cache headers and a published `latest_checked_at` data-index update indicator; do not equate data availability with live observation.
4. Deploy Next.js plus Python-capable backend with object storage/cache appropriate to traffic; static-only Next.js deployment cannot execute scientific Python processing.
5. Add health/readiness endpoints that check actual real-provider capability, not just process liveness.
6. Add request limits, per-job memory/disk limits, allowable coordinates/fields, trusted URL host validation, retry/backoff, concurrency limits, CORS and structured logs. Prevent arbitrary URL fetch/SSRF and arbitrary ADQL injection; prefer parameter-safe validated query construction and host allowlists.
7. Publish scientific limitations, data provenance, credits, developer setup and API examples.
8. Run release-blocking unit/integration/e2e suites and confirm a production-like real-data smoke test.

**Exit criterion:** A reproducible public deployment with documented costs/limits and no mislabeling of data source.

## 5. API and contract rules

Retain endpoints for the frontend whenever possible:

| Route | Purpose | Real-data behavior |
|---|---|---|
| `GET /health` | readiness | `real_data_enabled` true only after proven real provider works; report degraded archive dependency separately |
| `GET /api/presets` | challenge target presets | supplied/referenced coordinates with epoch/provenance |
| `GET /api/observations?ra=&dec=&fov_arcmin=&detector=` | observation manifest | real timestamps and product IDs; add optional spectral/epoch filters safely |
| `GET /api/frames/{id}.png` | rendered image | generated from real calibrated FITS; source-aware caching |
| `GET /api/difference?frame_a=&frame_b=` | B-minus-A preview | scientifically validated pair, correct masks and units |
| `GET /api/observations/{id}/metadata` (optional) | provenance | WCS, release, wavelength, flags, uncertainties |
| `GET /api/jobs/{id}` (optional) | async progress | queued / running / complete / failed / cancelled |
| `GET /api/spectrum` (optional) | spectrum | real calibrated observations only |
| `GET /api/catalog/gaia` (optional) | overlay | Gaia DR3, catalog query provenance |

### Real-data response additions

Propose additive typed fields, keeping current essential fields intact:

```json
{
  "source_type": "spherex-irsa",
  "dataset_id": "opaque-stable-real-manifest-id",
  "request": {"ra": 0.0, "dec": 0.0, "fov_arcmin": 12.0, "detector": "D1"},
  "coordinate_system": "ICRS",
  "intensity_unit": "verified FITS science unit",
  "release": "DR1-or-QR3-from-product",
  "frames": [
    {
      "id": "opaque-stable-frame-id",
      "timestamp": "actual-observation-UTC-timestamp",
      "image_url": "/api/frames/opaque-stable-frame-id.png",
      "source": "spherex-irsa",
      "detector": "D1",
      "product_id": "real-archive-product-id",
      "provenance_url": "archive-provided-trusted-url",
      "quality": {
        "calibrated": true,
        "registration": "documented-method",
        "masked_fraction": 0.0,
        "flags": [],
        "notes": []
      }
    }
  ],
  "notice": "Actual archived SPHEREx data; interpretation subject to coverage, calibration and quality flags."
}
```

**This is a target shape, not sample real observations.** Never paste placeholder timestamps, flux units, archive IDs or URLs into responses marked `spherex-irsa`. Populate from verified data. Keep optional fields nullable/explicit; do not invent sigma, PSF, or calibration status.

Important status semantics: HTTP 422 for invalid user input/incompatible pair; 404 for unknown frame; 503/502/504 for actual upstream unavailability/failure; 200 with empty frames and `no_coverage` state when a valid searched field has no suitable released data. Do not treat no coverage as an external-service outage. Expand the data contract and frontend source policy in lockstep.

## 6. Scientific processing specification

### Position, time, and WCS

- Convert sexagesimal coordinates with `astropy.coordinates.SkyCoord` when accepted, but keep API canonical decimal ICRS degrees.
- Handle RA 0°/360° wrap, polar regions, RA*cos(Dec), image orientation and handedness, pixel centers and field edges.
- Use observation midtimes/metadata as provided, with explicit UTC time representation; never label publish or processing dates as observation times.
- Choose a shared TAN projection, fixed field center and pixel scale; correctly reproject science image and masks; propagate weight/variance as justified.
- Determine whether two images have overlapping valid sky footprints **before** allowing subtraction.

### Instrument, bandpasses and science fidelity

- SPHEREx is an LVF spectrophotometric survey covering approximately 0.75–5 µm. Confirm detector, wavelength, spectral response and calibration from each release's metadata.
- FITS MEFs may have distinct extension types/shapes/WCS. Inspect, do not assume `HDU[0]` is the science image or that every extension shares a coordinate system.
- Use the mission-specific cutout service to preserve spatial/spectral calibration and PSF metadata when possible.
- Carry calibration unit, bit flags, coverage, PSF/beam, variance/noise and native provenance through the entire process.
- If combining exposures, record membership, weights, quality rejections, total usable exposure and expected limits.

### Difference and detection mathematics

For compatible, registered scientific images A and B:

```text
D(x,y) = B(x,y) - A(x,y)
V_D(x,y) = V_B(x,y) + V_A(x,y)  [only with independent errors]
S(x,y) = D(x,y) / sqrt(V_D(x,y))  [only where V_D>0 and covariance is negligible]
valid(x,y) = valid_A AND valid_B AND compatible_bandpass AND valid_calibration
```

Estimate impact of reprojection covariance and PSF matching on variance and detections; suppress significance mode unless validated. A moving point source can appear as adjacent positive/negative residuals. A variable source at a fixed sky position may appear as a predominantly positive/negative residual. Artifacts can imitate both. Include a reliable no-motion reference field to measure registration error.

For motion from two ICRS coordinates, use spherical-angle separation and elapsed time, not raw pixel displacement alone. State whether results are observed/apparent motion, proper motion, or inferred physical motion. No automatic claims of distance, orbit, species or discovery from insufficient observations.

## 7. Mandatory validation targets

Use the provided real target presets from `backend/app/presets.json` and `frontend/lib/presets.json`, verifying coordinates and reference epochs. **Do not invent exact current coordinates for objects whose positions evolve.** The challenge supplies WISE 0855 as RA `08h55m10.831s`, Dec `-07°14′42.53″` (convert using Astropy; record coordinate epoch separately).

| Target | Phenomenon to explore | What to verify |
|---|---|---|
| Barnard's Star | strong stellar proper motion | astrometry, motion baseline, matching reference field |
| Epsilon Indi Ba/Bb | brown-dwarf system with motion | achievable angular resolution, contamination and observability |
| WISE 0855 | very nearby fast-moving brown dwarf | sensitivity per released wavelength, catalog positions/epochs, possible nondetection |
| RW Aurigae | variable young star | same-band photometric change vs spectral response/artifacts |
| R Draconis | long-period variable star | brightness variation, calibration, observational sampling |

For each target report: coordinates and epoch provenance; requested FOV; available real releases; number of covering exposures; selected detector/wavelength; archive timestamps; usable aligned epochs; expected signal-to-noise or non-detection; quality flags; result and limitations. SPHEREx resolution/sensitivity may not resolve close binaries or detect every candidate. **A scientifically honest 'not visible / insufficient observations' result is a valid test outcome.**

### Test ladder

**Unit:** coordinate parsing, RA wrap/poles, field validation, source switching, blank FITS, mask propagation, incompatible bands, timestamps, 0/1/N epochs, diff signs, pixel values, uncertainty arithmetic, URL verification.

**Scientific fixture:** two synthetic-but-labeled FITS frames with known WCS, subpixel offset, noise, bad pixels, known moving star, known variable star and PSF mismatch. Confirm registration and residual sign/numerics to tolerances; this tests the pipeline but is **not** proof of real sky discovery.

**Archive integration:** recorded metadata fixture plus optional network-on test fetching a small known real DR1/QR3 cutout, verifying FITS HDUs, metadata and preview orientation. Do not require public IRSA network for every CI run.

**Contract:** Python Pydantic schema ↔ TypeScript model, source-policy enforcement, stable IDs, consistent URLs, JSON/error responses.

**Frontend:** default state, working real frames, empty coverage, loading/error/retry, blink, split, difference, spectral controls, FOV limits, share-link restoration, keyboard, reduced motion, mobile overflow.

**Performance:** measure archive request count, cutout bytes, median/p95 end-to-end time, memory, cache effectiveness, and concurrency under a documented test environment. Do not invent pass thresholds as measured outcomes.

## 8. UI and user-experience requirements

Retain existing visual language and components. Aim for both novice and technical use:

- Target presets plus free-form ICRS coordinate entry, FOV and detector selection.
- Loading indicator distinguishing archive search, download, registration, and rendering when those stages exist.
- Real time-axis / UTC observation dates; allow frame pair selection independent of chronological spacing.
- Single, blink, split, B-minus-A; optional significance after validation.
- Clear legend for color/intensity stretch, positive/negative difference, sky compass, angular scale and provenance.
- Live warnings: no coverage, low signal-to-noise, contaminated source, incompatible passbands, incomplete masks, poor registration.
- Metadata drawer: mission, archive, release, product ID, timestamp, detector, verified wavelength, exposure/cutout parameters, flag legend and citation.
- URL example (query contract already partially supported): `/explore?ra=269.452077&dec=4.693365&fov=12&detector=D1`. Keep URL params sanitized and restorable; optional epoch/passband params should be additive.
- Keyboard/ARIA labels and reduced-motion support. Do not autoplay flashing rapidly; user controls blink speed.
- Clearly separate **Real SPHEREx data**, **Synthetic demo**, **Context imagery**, and **Catalog overlay**.

## 9. Data retrieval and reliability rules

- Discover observation records with documented IRSA metadata/TAP queries; prefer release-approved DR1+QR3 imagery.
- Request and cache **cutouts**, not full huge FITS files, where practical.
- Respect archive rate limits and data-use policies; use bounded concurrency, exponential backoff, timeouts, and informative upstream errors.
- Only fetch archive-returned/allowlisted IRSA URLs and verify schemes/hosts/redirects to prevent SSRF.
- Prevent query injection, memory exhaustion, path traversal, huge output and unbounded source searches.
- Support cancellation or request coalescing for duplicate fields; cache by release/product plus method version.
- Keep cutout FITS and process logs outside the git repo, with secure cleanup.
- If IRSA data is missing or down, return an honest error/state and optionally offer an explicitly labeled demo mode; no silent fallback.

## 10. Prioritized task board

- [ ] **P0** Establish baselines, preserve source policy and frontend behavior.
- [ ] **P0** Verify live IRSA DR1+QR3 discovery and implement one real cutout.
- [ ] **P0** Parse FITS and expose trustworthy metadata, source typing and one preview.
- [ ] **P0** Show real cutout in existing Explorer with clear real source label.
- [ ] **P0** Query multiple actual epochs and enable genuine blink/playback.
- [ ] **P0** WCS align, filter compatible spectral samples, display B-minus-A safely.
- [ ] **P0** Validate the five challenge targets (including honest missing-data states).
- [ ] **P1** Mask/variance propagation, quality and contamination flags.
- [ ] **P1** Add wavelength selection, scientifically valid detector coaddition and spectra.
- [ ] **P1** Gaia DR3 overlay and epoch-aware source metadata.
- [ ] **P1** Deploy public app and document update/release/caching process.
- [ ] **P2** WISE context, advanced spectral composites and comparison modes.
- [ ] **P2** Candidate scoring/manual annotations and human-verified discovery workflow.
- [ ] **P2** Optional ML-assisted candidate detection only after baseline validation.

## 11. Definition of done for any coding task

Before reporting completion:

1. Show which paths changed and why; ensure clean, scoped changes and no unexpected frontend redesign.
2. Demonstrate requested feature end-to-end, with commands and source of actual observation data.
3. Include test results **actually executed**, with pass/fail/skip and environment limitations; never present planned tests as executed tests.
4. Record limitations, science validity, data provenance, release policy and possible false positives.
5. Update README/API/methodology/real-data docs, including setup variables and reproducible archive query instructions.
6. Check usability on desktop/mobile, loading and failure paths, accessibility, and source labeling.
7. Never claim mission-endorsed status or a validated astronomical discovery unless independently substantiated.

## 12. Agent instructions and response format

When working from this skill, proceed autonomously on tasks using the existing stack and the current repository. Do not ask for information readily inspectable in code or official documentation. If the network/archive is unavailable, develop against small verified metadata fixtures and local FITS test images, **label the work offline**, and report exactly which real-data step remains unverified. Avoid large, speculative rewrites.

For substantial work, start with a short implementation plan; then execute a vertical slice. Finish with:

```text
Implemented:       features actually completed
Files changed:     exact paths and summary
Data provenance:   IRSA release/products or explicitly labeled fixtures
Verified:          exact commands, tests and results
Known limitations: incomplete science, archive issues, coverage or UX gaps
Next recommended:  smallest next P0/P1 milestone
```

## 13. Suggested initial coding-agent prompt

> Read SKILL.md, inspect the current SkyTrace repo, and preserve the frontend. Implement **Phase B** as a complete real-data vertical slice: verify current IRSA DR1+QR3 metadata using the official SPHEREx cutout tutorial; build the real `SpherexIRSAProvider` path and scientifically correct FITS/WCS cutout rendering; extend Pydantic and TypeScript to distinguish `spherex-irsa` from `synthetic`; return real timestamps and provenance; surface one genuine archival image in the existing Explorer; add offline FITS fixtures and opt-in IRSA integration tests; update documentation. Do not fake missing data, do not modify unrelated styles, and do not claim the real-data path works until you actually validate an archive response.
