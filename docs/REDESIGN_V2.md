# SkyTrace — frontend redesign V2

Implemented in the existing project, 10 November 2026. **Visual acceptance remains pending:** the application could not be opened through the unavailable managed preview relay. This report separates implementation from verified behavior.

## Design and reference audit

The original global stylesheet combined landing and instrument styles, used pervasive small technical labels, repeated bordered panels and cyan branding. The existing landing/Explorer components, URL handling, scientific display endpoints and provider boundary were inspected before editing. A SHA-256 baseline was retained. Space Applications was inspected in the browser for scale, imagery, typography and purple geometric accents; its brand and assets were not copied.

The replacement uses full-width NASA / Webb photography, oversized white headings, editorial asymmetry, restrained purple circles and open dark surfaces. The five targets are a featured illustration plus an interactive name list, not repeated cards. Navigation, About and Explorer share the same typography and color system. Source imagery is editorial; no image is represented as a connected SPHEREx observation.

## Central design tokens

Defined in `frontend/app/styles/tokens.css`:

| Token | Value | Purpose |
| --- | --- | --- |
| `--bg` | `#080610` | Main background |
| `--secondary` | `#10091E` | Secondary background |
| `--surface` | `#160C2B` | Elevated surface |
| `--surface-soft` | `#1C1429` | Quiet controls |
| `--brand` | `#4B0AB8` | Primary deep purple |
| `--interactive` | `#6518CE` | Interactive emphasis |
| `--accent` | `#7429DF` | Active accents |
| `--violet` | `#9B72F2` | Soft violet |
| `--text` | `#F7F4FF` | Primary text |
| `--secondary-text` | `#BFB6D0` | Body/support text |
| `--muted` | `#978BAE` | Quiet labels |
| `--border` | `#302541` | Sparse separators |
| `--amber` | `#F5C77D` | Synthetic/warning; positive residual |
| `--green` | `#73C9A5` | Quality indicators |
| `--red` | `#F08089` | Errors |
| `--heading` | Archivo | Bold editorial headings |
| `--body` | DM Sans | Body, labels, buttons, navigation |
| `--mono` | IBM Plex Mono | Scientific values and numeric counters |
| `--display` | `clamp(5.5rem, 10.2vw, 10rem)` | Desktop hero, up to 160px |
| `--section-title` | `clamp(3.8rem, 6.4vw, 6.25rem)` | Major section headings |
| `--body-size` | `1.0625rem` | 17px body |
| `--label-size` | `0.9375rem` | 15px labels |
| `--value-size` | `0.875rem` | 14px values |
| `--page-gutter` | `clamp(24px, 5vw, 96px)` | Responsive horizontal space |
| `--ui-duration` | `180ms` | Functional UI transitions |
| `--ui-ease` | `cubic-bezier(.2,.7,.2,1)` | Shared easing token |

Fonts are self-hosted. Removed the old Inter and Space Grotesk dependencies. Form labels are 15px; panel headings 18–22px; RA/Dec inputs 16px; inspector values 14–16px. Small credits and image overlays remain subordinate. No cyan brand styling or glassmorphism was introduced.

## Four scroll sequences implemented

| Sequence | Implementation | Interaction |
| --- | --- | --- |
| A — Earth to the stars | `Landing.tsx`, `Hero.tsx` | Masked hero entry, independent image scale/parallax, text departure, changing overlay, masked Webb reveal and second headline |
| B — Moving universe | `ScrollStory.tsx` | Sticky starfield, scroll-selected eight educational states, moving marker/path, three text chapters, slight horizontal/scale movement |
| C — Infrared discovery | `Landing.tsx`, `SpectralSection.tsx` | Inset image expands, grayscale treatment crossfades to the source composite, heading moves aside, detector explanation enters; six array controls remain interactive |
| D — Enter the observatory | `Landing.tsx`, `HowItWorks.tsx` | Large photograph scales into an instrument frame, orbital ellipses converge, photo gives way to an unpopulated interface preview, heading and CTA enter |

Native scrolling and CSS sticky provide the pinning; GSAP ScrollTrigger controls progress. MatchMedia scopes desktop choreography to widths of at least 1024px with reduced motion disabled. Contexts and triggers clean up on unmount and breakpoint changes. Timelines follow scroll progress in both directions in code. **Actual browser motion, clipping, readability throughout transitions and performance have not been verified.**

## Explorer presentation and behavior

- Desktop: 280px control area and inspector, growing to 300px on wide screens; a flexible center contains modes, image and filmstrip. Below 1320px the inspector becomes a full-width group; mobile stacks the panels.
- Solid dark controls, purple selected detectors/modes, comfortable labels and sparse separators replace the previous outlined dashboard treatment.
- The viewer uses `object-fit: contain` and shared pan/zoom, preserving image aspect and scientific pixels. Split view remains synchronized. Overlays disclose coordinates, detector, field, timestamp and synthetic provenance.
- Inspector groups observation details, image properties, quality and comparison information. Timestamp text now derives from the selected frame rather than a literal time.
- The filmstrip has 92–108px thumbnails, readable dates, 44px playback controls, purple selection, range scrubber and speed selection. Empty data yields 00/00, disabled controls and no fabricated epochs.
- Short opacity transitions accompany single-frame/mode/metadata changes; blink alternation and numeric B−A calculation are not interpolated. Panel reveals, focus/hover and route entry are short, reduced-motion-aware effects. Native selects retain platform behavior.
- Default state: “OBSERVATORY READY.” and “Connect SPHEREx observations to explore the infrared sky.” A decorative orbital graphic carries no fake measurements. Controls and field sharing remain usable; playback, comparisons and zoom remain disabled.
- `/health` gates observation fetching. A second guard rejects unexpected source output. `NEXT_PUBLIC_ENABLE_SYNTHETIC_DEMO=true` explicitly restores the existing generated development workflow. The default never requests synthetic observations from the existing provider.

## Responsive and accessibility implementation

Desktop keeps the four cinematic sequences. Tablet removes long sticky choreography and adapts the editorial sections. Mobile uses stacked imagery, large target buttons, a full-height navigation menu and collapsible Explorer controls/inspector; it does not merely shrink the desktop grid. At 390px, filmstrip overflow is confined to its horizontal scroller. Responsive rules and an overflow assertion are supplied, but screenshots are pending.

Reduced-motion disables decorative animation and pinning, leaves explanations visible, and offers manual educational epochs and detector buttons. Keyboard access, focus indicators, skip navigation, Escape-to-close menu, URL restoration and scientific playback shortcuts remain available. User-initiated scientific playback stays available in development mode.

## Preserved science and actual verification

All **9 backend source/config/test files** in the pre-redesign hash baseline are byte-for-byte unchanged. Coordinate parsing, presets, detector ranges, backend frame generation, float32 signed B−A calculation, common-grid checks, API routing, frame identities and caches remain intact. No FITS processor was removed or replaced: the existing IRSA adapter was already unimplemented and remains disabled.

| Executed check | Result |
| --- | --- |
| Backend numerical/API suite | 26 passed; two dependency deprecation warnings |
| Frontend coordinate/URL/source-policy suite | 8 passed |
| Strict TypeScript check | Passed |
| Next.js production build | Passed |
| Backend hash comparison | All 9 baseline files unchanged |
| Playwright discovery | 20 cases across four viewport projects; mode-dependent cases are skipped as appropriate |
| Browser interactions/screenshots | Not executed — preview relay unavailable |
| Reference site and local image inspection | Completed; not a substitute for app QA |

Run `npm run test:e2e` for default behavior and `npm run test:e2e:demo` for explicit development functionality on a machine with Chromium. These suites are supplied, not reported as passing. No application screenshots were fabricated.

## Imagery and credits

- Earth horizon: NASA, ISS desktop wallpaper collection. Local optimized WebP 1920×1080.
- Cosmic Cliffs: NASA, ESA, CSA, STScI. Webb NIRCam/MIRI infrared composite. Local optimized WebP 2000×692.
- Credits, official source pages and original URLs are in `frontend/public/images/credits.json` and the About page. CSS crops/dark overlays and a labeled grayscale editorial transition do not claim scientific spectral processing.
- Story and target illustrations use preexisting educational frames. They are explicitly labeled synthetic and do not depict measurements of the named targets.

## Remaining limits

Visual acceptance is pending at 1440, 1920, 768 and 390px: inspect full scroll paths in both directions, breakpoints, target transitions, readability, keyboard/touch behavior, loading and reduced motion. The managed preview returned `preview relay unavailable: No such file or directory`; no substitute server or screenshots were used.

There is still no connected real SPHEREx dataset. The future provider requires FITS/WCS registration, spectral matching, calibration/mask/uncertainty handling, extended response types and source-aware metadata before activation. The source-policy allowlist is a safeguard, not that implementation. No production hosting was created; the existing Next.js + FastAPI application needs Python-capable hosting.

## Modified frontend files

- `frontend/.env.example`
- `frontend/app/about/page.tsx`
- `frontend/app/globals.css`
- `frontend/app/icon.svg`
- `frontend/app/layout.tsx`
- `frontend/components/explorer/Explorer.tsx`
- `frontend/components/explorer/MetadataPanel.tsx`
- `frontend/components/explorer/ObservationControls.tsx`
- `frontend/components/explorer/SkyViewer.tsx`
- `frontend/components/explorer/Timeline.tsx`
- `frontend/components/landing/Hero.tsx`
- `frontend/components/landing/HowItWorks.tsx`
- `frontend/components/landing/Landing.tsx`
- `frontend/components/landing/ScrollStory.tsx`
- `frontend/components/landing/SpectralSection.tsx`
- `frontend/components/landing/TargetsGallery.tsx`
- `frontend/components/ui/Navigation.tsx`
- `frontend/e2e/observatory.spec.ts`
- `frontend/package-lock.json`
- `frontend/package.json`
- `frontend/playwright.config.ts`

## Added frontend files

- `frontend/app/styles/explorer.css`
- `frontend/app/styles/landing.css`
- `frontend/app/styles/tokens.css`
- `frontend/app/template.tsx`
- `frontend/components/explorer/EmptyObservatory.tsx`
- `frontend/e2e/empty-state.spec.ts`
- `frontend/lib/source-policy.ts`
- `frontend/public/images/carina.webp`
- `frontend/public/images/credits.json`
- `frontend/public/images/earth-horizon.webp`
- `frontend/tests/source-policy.test.mjs`

Documentation updated: `README.md`, `docs/VALIDATION.md`, `docs/REAL_DATA_INTEGRATION.md`, and this report. The scientific backend and existing educational asset generator were not edited.
