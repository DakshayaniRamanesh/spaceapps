# SkyTrace

**See the Sky in Motion.** A cinematic, interactive infrared-sky explorer with a Next.js frontend and a FastAPI scientific demonstration backend. Built as an independent NASA Space Apps Challenge 2026 concept inspired by SPHEREx.

**The default Explorer is empty and ready for real data.** Synthetic observations require the explicit development opt-in below. No local SPHEREx FITS dataset is integrated. Reference target positions are real or supplied in the brief; simulated stars, dates, motion and brightness are not measurements of those targets. The IRSA adapter is explicitly disabled.

## Quick start

Requirements: **Node.js 22.18+ (24 recommended)**, npm, and **Python 3.11+**. No NASA account, external scientific service, or API key is required. Internet access is needed only to install dependencies. Fonts, artwork, and story frames are bundled locally.

From the `skytrace` directory:

```bash
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
npm --prefix frontend ci
npm run dev
```

Open **http://localhost:3000**. The single development command starts the Python API on port 8000 and Next.js on port 3000, and shuts both down on Ctrl+C. Set `PORT` or `API_PORT` if needed. On Windows, create the environment with `python -m venv backend/.venv`, install using `backend\.venv\Scripts\python -m pip ...`, then use the same npm commands.

### Start the servers separately

Terminal 1:

```bash
cd backend
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Terminal 2:

```bash
cd frontend
npm run dev
```

Next.js proxies `/api/*` and `/health` to the backend. If the API is elsewhere, copy `frontend/.env.example` to `frontend/.env.local`, change `API_INTERNAL_URL`, and restart Next.js. Backend `.env.example` documents environment variables; export them in your shell or deployment environment (the backend does not automatically load `.env`).

## Development demonstration (optional)

To exercise the preserved synthetic backend, put `NEXT_PUBLIC_ENABLE_SYNTHETIC_DEMO=true` in `frontend/.env.local` and restart Next.js. For production builds, set the variable before `npm run build`. Leave it unset or `false` for the default ready state. This setting is explicitly a development demonstration, not a real-data connection. Changing `OBSERVATION_SOURCE` alone does not enable synthetic images in the frontend.

A real provider is not implemented in this release. See `docs/REAL_DATA_INTEGRATION.md` for the required FITS/WCS, calibration and contract work before activation.

## What is implemented

- `/`: local NASA / Webb photography, oversized Archivo typography, deep-purple art direction, four distinct GSAP scroll sequences, manual story controls for mobile/reduced motion, six detector explanations, and an interactive five-target gallery.
- `/explore`: readable instrument controls, an unpopulated “Observatory ready” workspace, decimal-coordinate validation, target presets, FOV and detector controls, URL restoration and copy-to-share. The eight-frame API workflow remains available in explicit development mode.
- Single-frame, blink, side-by-side and **calculated B − A difference** modes. Pair selectors and adjustable blink interval. Changing modes pauses playback; use **Start blink** to alternate the selected pair.
- Playback at 0.5×, 1×, 2× and 4×; previous/next; scrubber; frame thumbnails. Manual frame selection returns to single-frame mode.
- Zoom from 100% to 800%, pointer/touch drag to pan, synchronized split views, fit/reset, crosshair toggle, image-loading/error/retry states.
- `/about`: methodology, limitations, coordinate provenance, science sources and artwork credits.
- Collapsible mobile panels, keyboard controls, reduced-motion styles, self-hosted fonts, focus indicators, skip link, SEO metadata and favicon.
- An abstract observation provider, working deterministic synthetic provider, disabled IRSA adapter, bounded caches, validated API, and automated tests.

### Keyboard controls

When focus is outside a form, button or link: **Space** plays/pauses; **← / →** selects epochs. With the image viewport focused: **+ / −** zoom, **0** fits, **Shift + arrows** pans when zoomed. All controls remain available as buttons. Playback pauses in hidden tabs. Reduced-motion disables decorative animation and scroll pinning; user-triggered scientific playback remains available.

## Test and build

```bash
cd backend
.venv/bin/python -m pytest -q
cd ../frontend
npm test
npm run typecheck
npm run build
```

Optional browser smoke tests (run in an environment with browser support):

```bash
cd frontend
npx playwright install chromium
npm run test:e2e
# Also check the explicitly enabled synthetic development workflow (POSIX shell):
npm run test:e2e:demo
```

The browser suite launches both servers and checks wide desktop (1920px), desktop (1440px), tablet (768px), and mobile (390px) layouts; navigation; URL restoration; validation; playback; zoom; comparison modes; reduced motion; horizontal overflow; and screenshots. Browser executables are not bundled.

See `docs/REDESIGN_V2.md` for the design system, animation map, changed-file list and preservation audit. See `docs/VALIDATION.md` for **actual checks executed and verification limits**. Browser tests are supplied but were not run in the authoring environment because its preview relay was unavailable.

## Production

```bash
cd frontend
npm ci
npm run build
npm start
```

Run Uvicorn separately on a Python-capable host. Configure `API_INTERNAL_URL` **before building**: the Next.js rewrite target is part of the built routing configuration. Keep the Python API private behind Next.js/reverse-proxy routing when possible. Default CORS permits only `http://localhost:3000`; configure `CORS_ORIGINS` for deployments making direct browser-to-API requests.

This is a two-process application. Static-only hosting and Cloudflare JavaScript Workers alone cannot execute its required NumPy/Pillow FastAPI backend. No production deployment was created. Deploy Next.js and Python together or provide a separately hosted API. There are no stored user records or credentials. Add production request limits/monitoring at the reverse proxy before public traffic; cache sizes are bounded but generating many distinct fields still consumes CPU.

## Structure

```text
skytrace/
  frontend/
    app/                    Landing, explorer and methodology routes
    components/landing/     Choreographed narrative sections
    components/explorer/    Controls, viewer, comparisons and timeline
    components/ui/          Shared navigation and footer
    lib/                    Typed API model, validation, target configuration
    public/                 Credited NASA/Webb imagery and labeled demo frames
    tests/                  Node validation/URL tests
    e2e/                    Playwright interaction and responsive tests
  backend/
    app/models.py           Validated request/response contract
    app/providers.py        Synthetic generator, display mappings, provider interface
    app/main.py             FastAPI endpoints and bounded display caches
    app/presets.json         Coordinate provenance
    tests/                  Numerical, API and validation tests
  docs/                     API, methodology, integration and validation guides
  scripts/                  Combined dev launcher, reproducible assets/presets
```

## Scientific assumptions

Each normalized field has a deterministic local catalogue. FOV changes map angular offsets onto a fixed 384×384 raster, revealing more or less of the same field. Detector selection changes source intensities and illustrative PSF width; it does not model true wavelength-dependent detector calibration. One source moves along a fixed angular path and another varies sinusoidally. The same background grid is used at every epoch.

Noise is independent seeded Gaussian noise with σ = 2.5 arbitrary units. A fixed arcsinh stretch is applied across frames. Difference images are calculated from **unclipped float32 arrays**, then mapped to violet (negative), dark neutral (zero), and amber (positive). Do not use these values for astrophysical inference.

The eight timestamps start on 2025-01-15 and are spaced by 90 days. They are illustrative, **not the mission observing schedule**. Motion is exaggerated. Field coordinates are not propagated to these dates. WISE 0855's epoch is unspecified. Different coordinate centers define independent local catalogues, so overlapping requests do not form one globally consistent sky. See `docs/METHODOLOGY.md`.

## Reproduce local assets

Bundled assets are ready to use. To regenerate them, install the optional build-time dependency `scipy>=1.14` into the backend environment, then run:

```bash
backend/.venv/bin/python scripts/generate_assets.py
python3 scripts/make_presets.py
```

The asset script reproduces the retained v1 procedural nebula and educational frames, not the v2 NASA/Webb photographs. Source URLs and credits for those locally optimized images are in `frontend/public/images/credits.json` and `/about#credits`. The default Explorer checks `/health` and does not request synthetic observations. The development workflow requests images from the running backend. No official NASA logo is used.

## References

- [SPHEREx instrument, Caltech](https://spherex.caltech.edu/page/instrument)
- [SPHEREx Data Explorer overview, NASA/IPAC IRSA](https://irsa.ipac.caltech.edu/onlinehelp/spherex/spherex/overview.html)
- [SPHEREx archive data products, IPAC](https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-products/)
- SIMBAD target references are recorded individually in `backend/app/presets.json` and the About page.

Not affiliated with or endorsed by NASA, JPL, Caltech, or the Space Apps organizers.
