"""NASA/IPAC IRSA SPHEREx DR1+QR3 client for observation discovery and cutout retrieval."""
from __future__ import annotations

import hashlib
import logging
import os
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx
from astropy.coordinates import SkyCoord
from astropy.time import Time
import astropy.units as u

logger = logging.getLogger(__name__)

ALLOWED_HOSTS = {"irsa.ipac.caltech.edu"}
CACHE_DIR = Path(os.getenv("SPHEREX_CACHE_DIR", Path(__file__).resolve().parents[2] / ".cache" / "spherex"))


def validate_trusted_url(url: str) -> None:
    """Ensure remote URL belongs to the allowlisted IRSA host with HTTPS."""
    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise ValueError(f"Insecure protocol: {parsed.scheme}. Only HTTPS allowed.")
    if parsed.netloc not in ALLOWED_HOSTS:
        raise ValueError(f"Untrusted host: {parsed.netloc}. Only {ALLOWED_HOSTS} allowed.")


def mjd_to_utc_iso(mjd: float) -> str:
    """Convert Modified Julian Day float to ISO-8601 UTC string."""
    try:
        t = Time(mjd, format="mjd", scale="utc")
        return t.isot + "Z"
    except Exception:
        return "1970-01-01T00:00:00Z"


class IrsaSpherexClient:
    """Query IRSA for SPHEREx DR1 + QR3 spectral images and download calibrated cutouts."""

    def __init__(self, cache_dir: Path | None = None, max_retries: int = 3, timeout: float = 60.0):
        self.cache_dir = cache_dir or CACHE_DIR
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.max_retries = max_retries
        self.timeout = timeout
        self._sia_cache: dict[tuple[float, float, float], Any] = {}

    def query_sia_table(self, ra: float, dec: float, fov_arcmin: float):
        """Query and cache the raw SIA table for a spatial position across all collections."""
        from astroquery.ipac.irsa import Irsa

        cache_key = (round(ra, 4), round(dec, 4), round(fov_arcmin, 2))
        if cache_key in self._sia_cache:
            return self._sia_cache[cache_key]

        coord = SkyCoord(ra=ra, dec=dec, unit="deg", frame="icrs")
        search_radius = (fov_arcmin / 2.0) * u.arcmin

        try:
            logger.info("Querying IRSA SIA for (%s, %s) radius=%s", ra, dec, search_radius)
            table = Irsa.query_sia(
                pos=(coord, search_radius),
                collection=["spherex_dr1", "spherex_qr3"],
            )
            self._sia_cache[cache_key] = table
            return table
        except Exception as exc:
            logger.warning("IRSA SIA query failed: %s", exc)
            return None

    def search_observations(
        self,
        ra: float,
        dec: float,
        fov_arcmin: float,
        detector: str,
        max_epochs: int = 12,
        start_mjd: float | None = None,
        end_mjd: float | None = None,
        spread: bool = False,
    ) -> tuple[list[dict], int]:
        """Search SPHEREx DR1+QR3 for spectral images covering the field.

        Returns (shortlisted records, total matching exposures before shortlisting).

        Selection:
        - start_mjd/end_mjd: inclusive observation-time window (MJD, UTC).
        - spread=False: chronological order, ~30 s dedup of repeated products.
        - spread=True: one exposure per ~30-day bin (team heuristic) so the
          time-lapse spans the survey instead of clustering in a single visit.

        Rows without a valid observation time (t_min <= 0) are dropped:
        fabricating timestamps is forbidden (temporal-truth rule).
        """
        table = self.query_sia_table(ra, dec, fov_arcmin)  # cached per position
        if table is None or len(table) == 0:
            return [], 0

        bandpass = f"SPHEREx-{detector.upper()}"
        mask = [str(bp).strip() == bandpass for bp in table["energy_bandpassname"]]
        filtered = table[mask]

        if "t_min" not in filtered.colnames:
            logger.warning("SIA table lacks t_min; cannot establish observation epochs.")
            return [], 0

        if start_mjd is not None:
            filtered = filtered[filtered["t_min"] >= start_mjd]
        if end_mjd is not None:
            filtered = filtered[filtered["t_min"] <= end_mjd]
        filtered.sort("t_min")

        total_candidates = len(filtered)
        if total_candidates == 0:
            return [], 0

        size_deg = round((fov_arcmin / 60.0) * 1.15, 4)
        records: list[dict] = []
        seen_bins: set[int] = set()

        for row in filtered:
            access_url = str(row["access_url"]).strip()
            if not access_url:
                continue
            t_min = float(row["t_min"])
            if t_min <= 0:
                continue  # never invent an observation date

            obs_id = str(row["obs_id"]).strip() if "obs_id" in row.colnames else "unknown"

            # ~30-day sampling when spread; otherwise ~30 s product dedup.
            bin_id = int(t_min // 30) if spread else round(t_min * 2880)
            if bin_id in seen_bins:
                continue
            seen_bins.add(bin_id)

            records.append({
                "id": f"spx.{detector}.{obs_id}.{int(t_min * 1000)}",  # STABLE — do not change
                "obs_id": obs_id,
                "timestamp": mjd_to_utc_iso(t_min),
                "mjd": t_min,
                "access_url": access_url,
                "cutout_url": f"{access_url}?center={ra:.6f},{dec:.6f}d&size={size_deg}",
                "detector": detector,
                "collection": str(row["obs_collection"]) if "obs_collection" in row.colnames else "spherex_dr1",
                "center_ra": ra,
                "center_dec": dec,
                "fov_arcmin": fov_arcmin,
            })
            if len(records) >= max_epochs:
                break

        return records, total_candidates

    def fetch_cutout_bytes(self, cutout_url: str) -> bytes:
        """Download or read cached cutout FITS file."""
        validate_trusted_url(cutout_url)
        url_hash = hashlib.sha256(cutout_url.encode("utf-8")).hexdigest()[:24]
        cache_path = self.cache_dir / f"cutout_{url_hash}.fits"

        if cache_path.exists() and cache_path.stat().st_size > 2880:
            return cache_path.read_bytes()

        last_error: Exception | None = None
        for attempt in range(self.max_retries):
            try:
                with httpx.Client(timeout=self.timeout, follow_redirects=True) as client:
                    resp = client.get(cutout_url)
                    if resp.status_code == 200:
                        content = resp.content
                        if content.startswith(b"SIMPLE  ="):
                            # Valid FITS content
                            cache_path.write_bytes(content)
                            return content
                        raise ValueError(f"Downloaded content from {cutout_url} is not a valid FITS file: {content[:100]!r}")
                    elif resp.status_code in (502, 503, 504, 429):
                        # Transient server error, wait and retry
                        time.sleep(1.5 * (attempt + 1))
                        continue
                    else:
                        resp.raise_for_status()
            except Exception as exc:
                last_error = exc
                time.sleep(1.0 * (attempt + 1))

        raise RuntimeError(f"Failed to download SPHEREx cutout from {cutout_url} after {self.max_retries} attempts: {last_error}")
