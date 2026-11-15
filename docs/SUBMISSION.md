# SkyTrace submission material

## Project description

SkyTrace helps people inspect the changing infrared sky through real SPHEREx exposures. A shared Python processor powers a fast featured-field demonstration and user-entered celestial coordinates. The web interface offers dated frames, playback, blinking, side-by-side views, archive provenance and a comparison-evidence panel.

SPHEREx wavelengths vary across each detector. Images of the same sky can differ because of wavelength, masks, background or image blur rather than astrophysical change. SkyTrace exposes those limitations and blocks unvalidated subtraction. Its central feature is an explanation of what the available evidence does and does not support.

The submission contains genuine previews for all five challenge fields (22 exposures), with R Draconis selected initially, with immutable original NASA FITS cutouts and a reproducible offline verifier. It does not claim a new object, measured proper motion, or scientifically calibrated variability detection.

## Two-minute demonstration script

- 0:00–0:20: Explain the challenge: make real SPHEREx images easy to inspect over time. Open the Explorer, not only the decorative landing page.
- 0:20–0:45: Show the two R Draconis field exposures dated May 2025 and May 2026. Explain its masked center, then choose another cached field. Play or blink and switch to side-by-side. No target variability is claimed from appearance alone.
- 0:45–1:15: Open Comparison evidence. Show center wavelengths, per-pixel spectral screening, sky overlap and measured registration. Explain why Difference is disabled; a usable preview is not automatically a valid scientific subtraction.
- 1:15–1:35: Open original NASA FITS links, cutout SHA-256 and downloadable provenance/science arrays. Mention the offline reproducibility check.
- 1:35–1:55: Enter another RA/Dec and show the bounded archive-job workflow. If IRSA is slow or unavailable, show the real status and explain the cached featured demonstration. Do not stage a fabricated successful result.
- 1:55–2:00: State the next science milestone: response-calibrated, PSF/background-validated subtraction.

## Features to claim

Real SPHEREx image retrieval; shared featured/custom processing; temporal inspection; source-aware metadata; per-pixel wavelength screening; quality masks; provenance; reproducible genuine FITS snapshot; bounded processing and transparent failure states.

## Features not to claim

Validated real difference imaging, a Planet X detection, automated discovery, measured proper motion, complete 102-band exploration, validated light curves, full-sky completeness or five proven target time-lapses. Synthetic B − A is a separately labeled development demonstration.

## Before submitting on the team page

Record the actual public deployment URL, repository commit and video link. Confirm the registered local event's deadline and submit before it; do not assume 48 working hours remain. Verify the public link in a signed-out browser. Complete participant/team details and required attribution. Code and these materials do not themselves submit the project to NASA.

Repository: https://github.com/sujeevanferos/spaceapps

Data acknowledgement: This publication makes use of data products from the Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer (SPHEREx), which is a joint project of the Jet Propulsion Laboratory and the California Institute of Technology, and is funded by the National Aeronautics and Space Administration.
