# Validation record

V2 checked 2026-11-10 in the authoring environment.

| Check | Actual result |
| --- | --- |
| Python API and numerical tests | **26 passed** |
| Frontend coordinate/URL/source-policy unit tests | **8 passed** |
| TypeScript strict checking | Passed; `next typegen` runs before `tsc` so a clean checkout does not require a prior build |
| Next.js production build | Passed; `/`, `/explore`, `/about`, and favicon generated |
| Built page asset references | All referenced local compiled assets present for the three application routes |
| API proxy routing | Compiled manifest maps `/api/*` and `/health` to the configured Python service |
| Combined dev launcher | JavaScript syntax check passed |
| Playwright suite discovery | 20 cases discovered across 1920px, 1440px, 768px and 390px projects; demo/default cases select the appropriate mode |
| Playwright interactions/screenshots | **Not executed**: managed preview relay unavailable |
| Browser console, visual layout, touch, actual scroll choreography | **Not verified in a browser** for the same infrastructure reason |
| Production deployment | Not created; the required FastAPI/NumPy backend needs Python-capable hosting |

## Preservation and visual status

All nine backend source/config/test files in the pre-redesign SHA-256 snapshot are byte-for-byte unchanged. All 26 backend tests were rerun successfully after the redesign. This verifies the preserved numerical/API behavior; it does not substitute for browser interaction checks.

The reference site was inspected in a browser. The two local NASA/Webb images were inspected separately. No screenshots of the implemented v2 app could be captured because the managed preview relay is unavailable. CSS breakpoints, reduced-motion branches and GSAP cleanup were reviewed in source, but their final appearance, performance and reversible scroll choreography remain unverified. Visual acceptance is pending.

## Backend tests exercised

Repeatable frame bytes and metadata; eight unique time-ordered epochs; image dimensions and content type; valid input boundaries; rejected invalid/nonfinite parameters; unknown frames; exact float32 subtraction; positive/negative color sign; identical-frame zero residual; rejected unregistered pairs; detector/coordinate/FOV sensitivity; moving-source displacement; variable-source brightness; Gaussian PSF support; repeatability after cache eviction; valid preset positions; disabled IRSA implementation; and FOV-dependent angular-motion scale.

Two dependency deprecation warnings appeared (the installed AnyIO pytest integration and FastAPI/Starlette TestClient's httpx compatibility). Neither was a failed test. They are dependency compatibility notices, not numerical failures.

## Frontend tests exercised

Inclusive coordinate/FOV boundaries, invalid coordinates, invalid FOV/detectors, a lossless share-URL round trip, default synthetic blocking, explicit opt-in, disabled-provider handling, and unknown-source rejection. Production compilation includes strict TypeScript checking of UI components and the supplied browser suite.

## Browser coverage supplied for local execution

`frontend/e2e/observatory.spec.ts` covers landing and target navigation, eight-frame rendering, previous/next and play/pause, zoom/fit, all comparison modes, PNG loading, URL restoration, blocking invalid coordinates before requests, detector/FOV changes, reduced-motion controls, overflow, and screenshot capture. `frontend/e2e/empty-state.spec.ts` adds unpopulated initial state, zero synthetic requests, disabled data-dependent controls, field settings without data, target selection, forward/backward navigation and overflow checks. The config provides 1920×1080, 1440×1000, 768×1024 and iPhone 13 (390px) viewports. `npm run test:e2e` selects default-state checks; `npm run test:e2e:demo` selects the preserved synthetic workflow.

The automated browser suite is **not counted as passing**. The authoring environment returned `preview relay unavailable: No such file or directory` from both preview start and status. No browser server workaround or fabricated screenshots were used. Run the documented browser tests and review screenshots on a functioning local machine before presenting the app as visually acceptance-tested.

## Tested dependency versions

- Node.js 24.22.1; Python 3.12.14
- Next.js 16.4.6; React 19.3.1; GSAP 3.15.1
- FastAPI 0.141.1; Uvicorn 0.52.1; NumPy 2.3.5; Pillow 12.3.0
- Pydantic 2.13.4; pytest 9.2.0; httpx 0.28.1

The npm lockfile is included. `backend/requirements-tested.txt` pins the exact direct Python versions used; `requirements.txt` specifies supported major-version ranges. The regenerated decorative asset script additionally uses SciPy; bundled assets require no SciPy at runtime.
