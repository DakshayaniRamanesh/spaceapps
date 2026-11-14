# Submission validation — 14 November 2026

These are executed checks in the implementation environment, not planned checks or inherited claims from the earlier synthetic-only version.

| Check | Actual result |
| --- | --- |
| Backend numerical/API/real-data tests | **46 passed** |
| Frontend coordinate, source, comparison and polling unit tests | **12 passed** |
| Strict TypeScript checking | **Passed** |
| Next.js production build | **Passed** |
| Production/real-data Playwright mode | **32 passed**, 8 simulator-only cases intentionally skipped |
| Explicit synthetic Playwright mode | **12 passed**, 28 real/default-state cases intentionally skipped |
| Browser viewports | **1920×1080, 1440×1000, 768×1024, 390×844** |
| Offline featured-data reproduction | **22 original FITS checksums, observation times, science/variance/wavelength/bandwidth arrays, masks, PNGs and pair reports verified** |
| Live archive discovery | **All five reference fields queried successfully**, D3 DR1/QR3 metadata; counts recorded separately |
| Live custom-coordinate job | **202 queued → running → ready → genuine two-frame result** at RA 248.1676°, Dec 66.755°, FOV 6′, D3; not a mocked network response |
| Docker image build | **Passed**, Python 3.12 / Node 24, non-root runtime |
| Production container smoke check | **Passed**: health, all five cached sets, PNG headers, cached-original FITS hashes, server-side rejection of real subtraction |
| Production browser capture | Desktop/mobile screenshots captured with no page errors |
| GitHub workflow configuration | YAML and embedded shell syntax checked; workflow runs the software, offline-reproduction, browser and container checks |
| Permanent public deployment | **Not created**; hosting setup is deferred by the project owner |
| NASA team-page submission/video | **Not submitted or fabricated**; description and demonstration script are supplied |

## Genuine bundled data

All five presets have D3, 12-arcminute field snapshots: Barnard’s Star 6 frames, Epsilon Indi B 2, WISE 0855 6, RW Aurigae 6, R Draconis 2. This verifies field-image availability, not detection of each named source or five validated scientific time-lapses.

Every snapshot includes exact original IRSA cutout bytes, SHA-256 filenames, a discovery inventory and a processing manifest. The offline verifier reads the originals again and checks the derived products. Tests with artificial FITS fixtures are separately identified as fixtures and never populate the public featured snapshots.

The default R Draconis pair is dated 2025-05-20T16:37:27.588Z and 2026-05-09T23:44:07.234Z. Their center wavelengths are approximately 1.812419 and 1.812466 µm. Wavelength screening passes over the valid overlap. The measured registration diagnostic is approximately 0.338 native-sampled pixels, exceeding the conservative 0.30 threshold. The requested central region is masked in both exposures; target brightness measurements there are unavailable. The interface and pair checks explicitly expose these limitations.

## Software behavior exercised

Validation includes nonfinite/out-of-range input rejection, deterministic simulation, exact synthetic B − A/sign behavior, source separation, real provenance, named/unknown flag masking, preservation of missing pixels, squared interpolation weights for variances, FITS/PNG orientation, center-region coverage, field-wide rather than center-only spectral screening, URL allowlisting, redirect/byte-limit rejection, epoch-spread ranking, persistent job state, duplicate suppression, queue bounds, cache reuse, no-coverage/incomplete distinctions, and server-enforced subtraction blocking.

Browser checks cover actual cached NASA image loading, all five preset cache hits, playback/blink/side-by-side, numeric input/URLs, pending/failed/empty search states, default synthetic blocking, explicitly enabled simulation, responsive layouts, horizontal overflow, reduced motion, landing navigation and runtime page errors. Error/empty UI paths use controlled route fixtures; the successful custom-coordinate network execution is separate evidence.

## Scientific limits

These checks establish software behavior and reproducibility. They are not an independent scientific certification. WCS-WAVE is visualization-grade, spectral-response equivalence is unverified, PSF matching and residual-background validation are unfinished, and propagated variance does not include spatial covariance/model systematics. No calibrated detection probability, measured proper motion or validated light curve is reported. Real subtraction remains disabled even if a client calls its endpoint directly. No alternate flag bypasses this gate.

Named-source coordinate propagation is not implemented. Presets select fixed reference fields, which may differ from present-day source positions. Metadata discovery covers the named wide-survey collections; bounded cutout assessments do not establish archive completeness.

## Evidence and reproduction

- `docs/evidence/target-discovery.json`: live archive metadata counts and scope for all five fields.
- `docs/evidence/live-custom-search.json`: the successful live custom request and genuine result manifest, including partial-search limitations.
- `docs/evidence/explorer-desktop.png`, `explorer-mobile.png`, `epsilon-comparison.png`: captures from the production container.
- `backend/data/featured/`: original FITS, derived products, inventories and immutable manifests.
- `python backend/tools/verify_featured.py`: repeat offline reproduction.
- `.github/workflows/validate.yml`: repeat automated checks on GitHub.

The container build in this managed environment used its trusted proxy CA through an optional BuildKit secret; TLS verification was retained and the certificate was not committed. A temporary Docker build-cache storage issue was resolved by removing task-created caches. The final image built and ran successfully.

Non-failing notices: Starlette reports a TestClient/httpx deprecation, and Node reports automatic module-type detection for the TypeScript test imports. Neither is counted as a passed scientific check or a failed software test.
