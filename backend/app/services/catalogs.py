"""Catalog overlay services for Gaia DR3 reference stars and astrometry."""
from __future__ import annotations

import logging
from typing import Any
from astropy.coordinates import SkyCoord
import astropy.units as u
import numpy as np

logger = logging.getLogger(__name__)

GAIA_CACHE: dict[tuple[float, float, float], dict[str, Any]] = {}


def query_gaia_dr3(
    ra: float,
    dec: float,
    fov_arcmin: float,
    limit: int = 100,
) -> dict[str, Any]:
    """
    Query Gaia DR3 stellar reference catalog around (ra, dec) within fov_arcmin.
    
    Returns structured sources with ICRS coordinates, proper motions, parallax,
    and G-band magnitude. Reference epoch is J2016.0.
    """
    cache_key = (round(ra, 4), round(dec, 4), round(fov_arcmin, 2))
    if cache_key in GAIA_CACHE:
        return GAIA_CACHE[cache_key]

    coord = SkyCoord(ra=ra, dec=dec, unit="deg", frame="icrs")
    radius = (fov_arcmin / 2.0) * u.arcmin

    try:
        from astroquery.gaia import Gaia

        # Suppress verbose async prints
        Gaia.ROW_LIMIT = limit
        job = Gaia.cone_search_async(coord, radius=radius)
        results = job.get_results()
    except Exception as exc:
        logger.warning("Gaia DR3 query failed: %s", exc)
        return {
            "catalog": "Gaia DR3",
            "epoch": "J2016.0",
            "center": {"ra": ra, "dec": dec, "fov_arcmin": fov_arcmin},
            "sources": [],
            "error": str(exc),
        }

    sources: list[dict[str, Any]] = []
    if results is not None and len(results) > 0:
        # Sort by G-band brightness (brightest first) if available
        if "phot_g_mean_mag" in results.colnames:
            results.sort("phot_g_mean_mag")

        for row in results[:limit]:
            def clean_val(val: Any) -> float | None:
                if val is None or np.ma.is_masked(val):
                    return None
                try:
                    f = float(val)
                    if np.isnan(f) or np.isinf(f):
                        return None
                    return f
                except (ValueError, TypeError):
                    return None

            g_mag = clean_val(row["phot_g_mean_mag"]) if "phot_g_mean_mag" in row.colnames else None
            pmra = clean_val(row["pmra"]) if "pmra" in row.colnames else None
            pmdec = clean_val(row["pmdec"]) if "pmdec" in row.colnames else None
            plx = clean_val(row["parallax"]) if "parallax" in row.colnames else None

            sources.append({
                "source_id": str(row["source_id"]),
                "ra": round(float(row["ra"]), 7),
                "dec": round(float(row["dec"]), 7),
                "phot_g_mean_mag": round(g_mag, 2) if g_mag is not None else None,
                "pmra_mas_yr": round(pmra, 2) if pmra is not None else None,
                "pmdec_mas_yr": round(pmdec, 2) if pmdec is not None else None,
                "parallax_mas": round(plx, 2) if plx is not None else None,
            })

    output = {
        "catalog": "Gaia DR3",
        "epoch": "J2016.0",
        "center": {"ra": ra, "dec": dec, "fov_arcmin": fov_arcmin},
        "count": len(sources),
        "sources": sources,
    }
    GAIA_CACHE[cache_key] = output
    return output
