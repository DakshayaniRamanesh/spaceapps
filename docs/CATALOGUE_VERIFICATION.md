# Catalogue overlay delivery — 15 November 2026

Implemented Gaia DR3 and WISE / AllWISE Source Catalog overlays in the existing SkyTrace Explorer. The Catalogue overlays panel is directly below the existing image viewer. Each checkbox is independent; enable either or both. Select a marker with click/tap or keyboard, or choose an entry in the source picker to inspect overlapping entries individually. The source card follows the active observation date; split mode retains the selected image's date. Position caveats and provenance are expandable.

Run `npm.cmd run dev` on Windows, open `/explore`, load a featured real field, then enable Gaia DR3 and/or WISE. A failed layer offers Retry while the other layer and SPHEREx images remain usable. Both layers start off. Synthetic mode and manifests without supported WCS explicitly disable real overlays.

The backend projects genuine upstream catalogue coordinates on the stored common ICRS TAN grid, converts FITS zero-origin coordinates to the vertically flipped PNG, and batches positions for every frame. The browser fits image and markers into one rectangle with a shared transform, including letterboxing, zoom and pan. Gaia proper motion is applied only when supplied; AllWISE stays at its static catalogue position. The default cone cap is 500, maximum 1000, with deterministic brightness ordering and extra-row truncation detection. Query and projected caches are separate and bounded. API and methodology details are in [API.md](API.md) and [METHODOLOGY.md](METHODOLOGY.md).

## Checks

- Full backend suite: **56 passed**, including the existing source-policy, FITS, archive, job, provenance and subtraction safeguards. The new catalogue tests cover exact identifiers, nullable measurements, errors/timeouts, bounds, caches, endpoint serialization, asymmetric WCS orientation/corners, wrapping/polar fields and deterministic proper motion into a field. Pytest required access to its normal temporary directory outside the sandbox. A dependency deprecation warning remains in Starlette's httpx TestClient integration.
- Frontend unit tests: **14 passed**.
- TypeScript checking: **passed**.
- Final Next.js production build: **passed**.
- Existing browser regressions: **16 applicable desktop/mobile tests passed**; four synthetic-only cases were skipped in the real-provider run. The overlay tests are recorded separately below.
- Desktop/mobile overlay verification: **8 passed**, including the corrected mobile controls setup and deterministic loading/resize assertions.
- Explicit synthetic development mode: **8 desktop/mobile tests passed**, covering disabled real overlays plus the existing playback, comparison modes, coordinate controls and responsive regression checks.
- Desktop/mobile screenshots were visually inspected with overlays off and with both layers enabled. No horizontal document overflow was found by browser assertions. Fixture markers are intentionally asymmetric and off-center to expose registration mistakes. Resize measurements read image and marker rectangles in the same browser task.

## Live service attempts and limits

`backend/.venv/Scripts/python.exe scripts/check_catalogues.py` attempted both actual public TAP services against a bundled real dataset, separately from the mocked tests. It was run first in the sandbox, then with approved network access, and again after the environment enabled unrestricted network access. The final diagnostic run reported:

```text
Gaia: ConnectTimeout: timed out
AllWISE: ReadTimeout: The read operation timed out
```

**Neither live catalogue query succeeded in this environment.** No live-service success or real marker correspondence is claimed. The production code contains only upstream retrieval; test fixtures are confined to test files. No replacement stars or positions are used on failure. The live script prints underlying errors and can be rerun when the services are reachable.

Coverage remains limited by catalogue availability, query caps and the Gaia 120 arcsec preselection margin. Angular propagation omits parallax, radial velocity, perspective acceleration, uncertainties and binary motion. AllWISE has no single reference epoch in this contract and is not propagated; its J2000 / 2MASS frame is treated as ICRS for preview without frame-systematic correction. WISE magnitudes can be upper limits. Markers are contextual reference positions, never confirmed detections, moving objects or physical cross-matches. Real-image subtraction remains disabled and the pair thresholds, original FITS and featured datasets are unchanged.

## Screenshots

These files are generated local test artifacts, ignored by Git. The underlying images are genuine bundled SPHEREx previews. Screenshots with both layers use **mock catalogue fixtures**, not live returned sources:

- [Desktop, overlays off](../frontend/test-results/catalogues-off-desktop.png)
- [Mobile, overlays off](../frontend/test-results/catalogues-off-mobile.png)
- [Desktop, both fixture layers](../frontend/test-results/catalogues-both-fixture-desktop.png)
- [Mobile, both fixture layers](../frontend/test-results/catalogues-both-fixture-mobile.png)

## Files changed for this feature

- `README.md` — Windows startup commands and instructions for finding and trying the overlays.
- `backend/app/catalogues.py` — retrieval, typed normalization, propagation/projection and bounded caches.
- `backend/app/main.py` — dataset-aware catalogue endpoint.
- `backend/tests/test_catalogues.py` — deterministic backend and API coverage.
- `frontend/lib/catalogues.ts` — typed overlay contract, availability and image fitting.
- `frontend/lib/types.ts` — expose existing manifest WCS grid.
- `frontend/components/explorer/CatalogueExplorer.tsx` — independent layer requests, controls, status, retry and details.
- `frontend/components/explorer/RegisteredImage.tsx` — fitted image/marker plane and accessible markers.
- `frontend/components/explorer/SkyViewer.tsx` — use registered image plane in existing viewer modes.
- `frontend/components/explorer/Explorer.tsx` — integrate catalogue controls around the current viewer.
- `frontend/app/styles/explorer.css` — local styles following existing panels, typography and colors.
- `frontend/tests/catalogues.test.mjs` — fitting and availability unit tests.
- `frontend/e2e/catalogues.spec.ts` — independent layers, registration, stale requests, state and accessibility tests.
- `frontend/e2e/catalogue-synthetic.spec.ts` — synthetic mode disables real overlays.
- `scripts/check_catalogues.py` — genuine upstream smoke queries with diagnostics.
- `docs/API.md`, `docs/METHODOLOGY.md`, `docs/CATALOGUE_VERIFICATION.md` — contract, science limits, testing and delivery record.

The existing user changes to `frontend/package-lock.json` and generated `frontend/next-env.d.ts` were preserved; no dependency change was required for the feature. An ignored backend virtual environment was created from the existing requirements for verification.
