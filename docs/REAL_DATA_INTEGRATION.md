# Real-data integration status

The IRSA placeholder has been replaced by the shared processor in `backend/app/irsa.py`, bounded archive client in `archive.py`, science preparation in `science.py`, and persistent job manager in `jobs.py`. The default source is real IRSA. The provider adapter serves prepared data; uncached requests use the job API.

Implemented: real product discovery/download, provenance, FITS decoding, named flag masks, variance handling, one ZODI subtraction, celestial reprojection, per-pixel wavelength previews, metadata and numeric downloads, immutable featured data, bounded custom jobs, failure/empty/incomplete handling, and source-aware frontend labels.

Five bundled snapshots contain 22 real field exposures, including the default two-frame R Draconis view. Its exact FITS bytes and SHA-256 hashes are checked in. The offline verifier rebuilds science arrays and PNGs from those originals and recomputes pair assessments. Unit tests also use explicitly artificial fixtures to exercise failures without depending on IRSA uptime.

Remaining science work before real subtraction: analysis-grade spectral calibration/response equivalence, suitable PSF matching, residual-background checks, registration acceptance supported by source uncertainties, and correlated-noise validation. The API and UI deliberately block real differences until these are established. No runtime flag bypasses that decision.

The current deployment is one Python-capable host with one worker and SQLite/disk cache. `Dockerfile`, `compose.yaml` and `render.yaml` are supplied. A hosting account/service must be provisioned to obtain a permanent public URL; the repository does not imply an existing production deployment.

Potential later work: target coordinate propagation from trusted catalogs, deep collections, mosaics, full spectral exploration, photometry with pixel solid angles and correlated errors, Gaia/WISE support, and candidate ranking. These are not represented as completed features.
