"""NASA/IPAC IRSA SPHEREx DR1+QR3 client for observation discovery and cutout retrieval."""
from __future__ import annotations

import hashlib
import logging
import math
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
    except Exception as exc:
        raise ValueError(f"Invalid observation MJD: {mjd}") from exc


class IrsaSpherexClient:
    """Query IRSA for SPHEREx DR1 + QR3 spectral images and download calibrated cutouts."""

    def __init__(self, cache_dir: Path | None = None, max_retries: int = 3, timeout: float = 60.0):
        self.cache_dir = cache_dir or CACHE_DIR
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.max_retries = max_retries
        self.timeout = timeout
        self._sia_cache: dict[tuple[float, float, float], Any] = {}
        from astroquery.ipac.irsa.core import IrsaClass

        self._irsa = IrsaClass()
        session = self._irsa._session
        original_request = session.request

        def request_with_timeout(method: str, url: str, **kwargs):
            kwargs.setdefault("timeout", self.timeout)
            return original_request(method, url, **kwargs)

        # PyVO's SIA calls use requests without a timeout by default. Keep
        # archive discovery bounded just like FITS cutout downloads.
        session.request = request_with_timeout

    def query_sia_table(self, ra: float, dec: float, fov_arcmin: float):
        """Query and cache the raw SIA table for a spatial position across all collections."""
        from astropy.io.votable import parse_single_table

        cache_key = (round(ra, 4), round(dec, 4), round(fov_arcmin, 2))
        if cache_key in self._sia_cache:
            return self._sia_cache[cache_key]

        coord_cache = self.cache_dir / f"sia_{cache_key[0]:.4f}_{cache_key[1]:.4f}_{cache_key[2]:.2f}.xml"
        fallback_caches = sorted(self.cache_dir.glob(f"sia_{cache_key[0]:.4f}_{cache_key[1]:.4f}_*.xml"))
        for disk_cache in [coord_cache, *fallback_caches]:
            if disk_cache.exists() and disk_cache.stat().st_size > 1000:
                try:
                    table = parse_single_table(disk_cache).to_table(use_names_over_ids=True)
                    self._sia_cache[cache_key] = table
                    return table
                except Exception as exc:
                    logger.warning("Failed reading cached SIA VOTable %s: %s", disk_cache, exc)

        coord = SkyCoord(ra=ra, dec=dec, unit="deg", frame="icrs")
        search_radius = (fov_arcmin / 2.0) * u.arcmin

        last_error: Exception | None = None
        for attempt in range(self.max_retries):
            try:
                logger.info("Querying IRSA SIA for (%s, %s) radius=%s (attempt %s)", ra, dec, search_radius, attempt + 1)
                table = self._irsa.query_sia(
                    pos=(coord, search_radius),
                    collection=["spherex_dr1", "spherex_qr3"],
                )
                if hasattr(table, "to_table"):
                    table = table.to_table()
                self._sia_cache[cache_key] = table
                return table
            except Exception as exc:
                last_error = exc
                logger.warning("IRSA SIA query attempt %s failed: %s", attempt + 1, exc)
                if attempt + 1 < self.max_retries:
                    time.sleep(min(1.0 * (attempt + 1), self.timeout))

        # Direct SIA v2 HTTP fallback if PyVO's /SIA/capabilities handshake gets a 502 from IRSA load balancer
        radius_deg = max(round(fov_arcmin / 120.0, 5), 0.001)
        sia_url = (
            f"https://irsa.ipac.caltech.edu/SIA?POS=CIRCLE+{ra}+{dec}+{radius_deg}"
            f"&COLLECTION=spherex_dr1&COLLECTION=spherex_qr3"
        )
        validate_trusted_url(sia_url)
        for attempt in range(self.max_retries):
            try:
                with httpx.Client(timeout=self.timeout, follow_redirects=True) as client:
                    resp = client.get(sia_url)
                    if resp.status_code == 200 and b"<VOTABLE" in resp.content[:1024]:
                        coord_cache.write_bytes(resp.content)
                        table = parse_single_table(coord_cache).to_table(use_names_over_ids=True)
                        self._sia_cache[cache_key] = table
                        return table
            except Exception as exc:
                last_error = exc
            if attempt + 1 < self.max_retries:
                time.sleep(min(1.0 * (attempt + 1), self.timeout))

        raise RuntimeError("IRSA SIA observation discovery failed") from last_error

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

        size_deg = round((fov_arcmin / 60.0) * 1.15, 4)
        records: list[dict] = []
        seen_bins: set[int] = set()
        dated_rows: list[tuple[float, Any]] = []

        for row in filtered:
            try:
                t_min = float(row["t_min"])
            except (TypeError, ValueError, OverflowError):
                continue
            if not math.isfinite(t_min) or t_min <= 0:
                continue
            if start_mjd is not None and t_min < start_mjd:
                continue
            # end_mjd is the inclusive end-of-day boundary from the API.
            if end_mjd is not None and t_min > end_mjd:
                continue
            dated_rows.append((t_min, row))

        dated_rows.sort(key=lambda item: item[0])
        total_candidates = len(dated_rows)
        if total_candidates == 0:
            return [], 0

        last_spread_mjd: float | None = None

        for t_min, row in dated_rows:
            access_url = str(row["access_url"]).strip()
            if not access_url:
                continue

            obs_id = str(row["obs_id"]).strip() if "obs_id" in row.colnames else "unknown"

            # ~30-day sampling when spread; otherwise ~30 s product dedup.
            if spread:
                bin_id = int(t_min // 30)
                if bin_id in seen_bins or (
                    last_spread_mjd is not None and t_min - last_spread_mjd < 29
                ):
                    continue
                seen_bins.add(bin_id)
                last_spread_mjd = t_min
            else:
                bin_id = round(t_min * 2880)
                if bin_id in seen_bins:
                    continue
                seen_bins.add(bin_id)

            try:
                timestamp = mjd_to_utc_iso(t_min)
            except ValueError:
                continue

            records.append({
                "id": f"spx.{detector}.{obs_id}.{int(t_min * 1000)}",  # STABLE — do not change
                "obs_id": obs_id,
                "timestamp": timestamp,
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
