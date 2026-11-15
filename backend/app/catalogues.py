"""Bounded catalogue retrieval, normalization and projection onto real PNG grids."""
from collections import OrderedDict
from datetime import datetime, timezone
import csv
import hashlib
import io
import json
import math
import threading
import time
import warnings
from typing import Literal

import httpx
import numpy as np
from astropy import units as u
from astropy.coordinates import SkyCoord
from astropy.time import Time
from astropy.wcs import WCS
from pydantic import BaseModel

Catalogue = Literal['gaia', 'wise']
VERSION = 'catalogues-v1'
SERVICES = {
    'gaia': ('Gaia DR3', 'https://gea.esac.esa.int/tap-server/tap/sync',
             'gaiadr3.gaia_source', 'source_id,ra,dec,ref_epoch,pmra,pmdec,phot_g_mean_mag,ruwe',
             'phot_g_mean_mag', 'source_id', 'https://www.cosmos.esa.int/web/gaia/dr3'),
    'wise': ('WISE / AllWISE Source Catalog', 'https://irsa.ipac.caltech.edu/TAP/sync',
             'allwise_p3as_psd', 'designation,ra,dec,w1mpro,w2mpro,ph_qual,cc_flags',
             'w1mpro', 'designation', 'https://wise2.ipac.caltech.edu/docs/release/allwise/'),
}


class CatalogueUnavailable(RuntimeError):
    pass


class OverlayUnavailable(ValueError):
    pass


class Position(BaseModel):
    x: float  # zero-origin PNG pixel center; CSS uses (x + .5) / width
    y: float
    ra: float
    dec: float
    treatment: Literal['catalogue_position', 'propagated_position', 'propagation_unavailable']


class CatalogueSource(BaseModel):
    source_id: str
    ra: float
    dec: float
    reference_epoch: float | None
    pmra: float | None
    pmdec: float | None
    proper_motion_unit: str = 'mas/yr; pmra includes cos(dec)'
    magnitudes: dict[str, float | None]
    quality: dict[str, str | float | None]
    warnings: list[str]
    positions: dict[str, Position]


class Overlay(BaseModel):
    dataset_id: str
    catalogue: Catalogue
    release: str
    sources: list[CatalogueSource]
    frames: dict[str, str]
    width: int
    height: int
    retrieved_at: str
    provenance_url: str
    service_url: str
    result_limit: int
    preselection_count: int
    truncated: bool
    completeness: str
    query_radius_deg: float
    motion_margin_arcsec: float
    warnings: list[str]


def number(value):
    try:
        v = float(value)
        return v if math.isfinite(v) else None
    except (ValueError, TypeError):
        return None


def normalize(row, catalogue):
    ra, dec = number(row.get('ra')), number(row.get('dec'))
    identifier = row.get('source_id' if catalogue == 'gaia' else 'designation', '').strip()
    if not identifier or ra is None or dec is None or not 0 <= ra < 360 or not -90 <= dec <= 90:
        raise CatalogueUnavailable('Catalogue returned invalid source coordinates or identifiers; retry later.')
    gaia = catalogue == 'gaia'
    pmra, pmdec = (number(row.get(k)) if gaia else None for k in ('pmra', 'pmdec'))
    epoch = number(row.get('ref_epoch')) if gaia else None
    notes = []
    if gaia and (pmra is None or pmdec is None or epoch is None):
        notes.append('Missing astrometry: catalogue position retained; no measured zero motion assumed.')
    if not gaia:
        notes.append('AllWISE catalogue position; no epoch propagation. J2000 is a coordinate convention, not an observation date.')
        notes.append('AllWISE J2000 / 2MASS reference-frame coordinates are treated as ICRS for this preview; frame systematics are not corrected.')
        notes.append('W1/W2 profile-fit magnitudes may be upper limits; consult ph_qual and the official catalogue documentation.')
    return CatalogueSource(source_id=identifier, ra=ra, dec=dec, reference_epoch=epoch,
                           pmra=pmra, pmdec=pmdec,
                           magnitudes=({'Gaia G': number(row.get('phot_g_mean_mag'))} if gaia else
                                       {'WISE W1 (3.4 μm)': number(row.get('w1mpro')), 'WISE W2 (4.6 μm)': number(row.get('w2mpro'))}),
                           quality=({'RUWE': number(row.get('ruwe'))} if gaia else
                                    {'ph_qual': row.get('ph_qual') or None, 'cc_flags': row.get('cc_flags') or None}),
                           warnings=notes, positions={})


def displayed_position(source, timestamp, catalogue):
    if catalogue == 'gaia' and all(v is not None for v in (source.pmra, source.pmdec, source.reference_epoch)):
        try:
            coord = SkyCoord(ra=source.ra*u.deg, dec=source.dec*u.deg,
                             pm_ra_cosdec=source.pmra*u.mas/u.yr, pm_dec=source.pmdec*u.mas/u.yr,
                             obstime=Time(source.reference_epoch, format='jyear', scale='tcb'))
            # Without distance/RV Astropy uses angular motion only; no parallax or perspective claim.
            with warnings.catch_warnings():
                warnings.simplefilter('ignore', category=Warning)
                adjusted = coord.apply_space_motion(new_obstime=Time(timestamp))
            if np.isfinite([adjusted.ra.deg, adjusted.dec.deg]).all():
                return adjusted.icrs, 'propagated_position'
        except (ValueError, TypeError):
            pass
    return SkyCoord(source.ra*u.deg, source.dec*u.deg), ('propagation_unavailable' if catalogue == 'gaia' else 'catalogue_position')


def project_sources(rows, data, w, catalogue):
    """Vectorize astrometry/WCS by frame, avoiding N-source Astropy constructions per tick."""
    if not rows:
        return []
    sources = [s.model_copy(deep=True) for s in rows]
    original_ra = np.array([s.ra for s in sources])
    original_dec = np.array([s.dec for s in sources])
    moving = np.array([i for i, s in enumerate(sources) if catalogue == 'gaia' and
                       all(v is not None for v in (s.pmra, s.pmdec, s.reference_epoch))], dtype=int)
    motion = None
    if len(moving):
        try:
            motion = SkyCoord(ra=original_ra[moving]*u.deg, dec=original_dec[moving]*u.deg,
                              pm_ra_cosdec=[sources[i].pmra for i in moving]*u.mas/u.yr,
                              pm_dec=[sources[i].pmdec for i in moving]*u.mas/u.yr,
                              obstime=Time([sources[i].reference_epoch for i in moving], format='jyear', scale='tcb'))
        except (ValueError, TypeError):
            pass
    for frame in data.frames:
        ra, dec = original_ra.copy(), original_dec.copy()
        propagated = set()
        if motion is not None:
            try:
                with warnings.catch_warnings():
                    warnings.simplefilter('ignore', category=Warning)
                    adjusted = motion.apply_space_motion(new_obstime=Time(frame.timestamp))
                good = np.isfinite(adjusted.ra.deg) & np.isfinite(adjusted.dec.deg)
                ra[moving[good]], dec[moving[good]] = adjusted.ra.deg[good], adjusted.dec.deg[good]
                propagated = set(moving[good])
            except (ValueError, TypeError):
                pass
        xx, yy = w.world_to_pixel(SkyCoord(ra*u.deg, dec*u.deg))
        keep = np.flatnonzero(np.isfinite(xx) & np.isfinite(yy) & (xx >= -.5) &
                             (xx < data.width-.5) & (yy >= -.5) & (yy < data.height-.5))
        for i in keep:
            treatment = ('propagated_position' if i in propagated else
                         'propagation_unavailable' if catalogue == 'gaia' else 'catalogue_position')
            sources[i].positions[frame.id] = Position(x=float(xx[i]), y=float(data.height-1-yy[i]),
                                                      ra=float(ra[i]), dec=float(dec[i]), treatment=treatment)
    return [s for s in sources if s.positions]


def footprint(data):
    """Only accept explicit common ICRS TAN grids; never infer an old grid."""
    if data.source_type != 'spherex-irsa':
        raise OverlayUnavailable('Real catalogue overlays are disabled for synthetic fields.')
    if not data.frames:
        raise OverlayUnavailable('No observation frames are available.')
    g = data.grid
    required = {'CTYPE1', 'CTYPE2', 'CRVAL1', 'CRVAL2', 'CRPIX1', 'CRPIX2'}
    if not required <= g.keys() or [g.get('CTYPE1'), g.get('CTYPE2')] != ['RA---TAN', 'DEC--TAN'] or g.get('RADESYS') != 'ICRS':
        raise OverlayUnavailable('This manifest has no supported common celestial WCS grid.')
    if not (('CDELT1' in g and 'CDELT2' in g) or all(k in g for k in ('CD1_1', 'CD1_2', 'CD2_1', 'CD2_2'))):
        raise OverlayUnavailable('The common WCS grid is incomplete.')
    if not 1 <= data.width <= 2048 or not 1 <= data.height <= 2048 or len(data.frames) > 24:
        raise OverlayUnavailable('Unsupported image dimensions or frame count.')
    try:
        for f in data.frames:
            Time(f.timestamp)
        w = WCS(g).celestial
        center = w.pixel_to_world((data.width-1)/2, (data.height-1)/2)
        corners = w.pixel_to_world(np.array([-.5, data.width-.5, data.width-.5, -.5]),
                                   np.array([-.5, -.5, data.height-.5, data.height-.5]))
        radius = float(center.separation(corners).deg.max())
        if not math.isfinite(radius) or not 0 < radius <= 1:
            raise ValueError('Invalid footprint')
    except Exception as exc:
        raise OverlayUnavailable('The manifest WCS or observation dates are unavailable.') from exc
    return w, center, radius


def query_text(catalogue, center, radius, limit):
    _, _, table, columns, brightness, identifier, _ = SERVICES[catalogue]
    # All geometry and limits are generated from validated server-owned manifests.
    point = "POINT('ICRS',ra,dec)" if catalogue == 'gaia' else 'POINT(ra,dec)'
    prefix = "'ICRS'," if catalogue == 'gaia' else ''
    return (f'SELECT TOP {limit+1} {columns} FROM {table} WHERE '
            f'CONTAINS({point},CIRCLE({prefix}{center.ra.deg:.10f},{center.dec.deg:.10f},{radius:.10f}))=1 '
            f'ORDER BY {brightness} ASC, {identifier} ASC')


def retrieve(catalogue, query, limit, client=None):
    """No redirect, automatic retry, arbitrary URL, credentials, or unbounded body."""
    try:
        with (client or httpx.Client(timeout=httpx.Timeout(25, connect=8), follow_redirects=False)) as c:
            started = time.monotonic()
            with c.stream('GET', SERVICES[catalogue][1], params={
                    'REQUEST': 'doQuery', 'LANG': 'ADQL', 'FORMAT': 'csv',
                    'MAXREC': limit+1, 'QUERY': query}) as response:
                response.raise_for_status()
                blocks, size = [], 0
                for block in response.iter_bytes():
                    size += len(block)
                    if size > 2*1024*1024 or time.monotonic()-started > 30:
                        raise CatalogueUnavailable('Catalogue response exceeded its resource budget; retry later.')
                    blocks.append(block)
        reader = csv.DictReader(io.StringIO(b''.join(blocks).decode('utf-8-sig')))
        expected = set(SERVICES[catalogue][3].split(','))
        if not expected <= set(reader.fieldnames or []):
            raise CatalogueUnavailable('Catalogue returned an unexpected format; retry later.')
        rows = []
        for row in reader:
            rows.append(normalize(row, catalogue))
            if len(rows) > limit:
                break
        return rows[:limit], len(rows) > limit, datetime.now(timezone.utc).isoformat()
    except (httpx.HTTPError, httpx.StreamError, UnicodeError, csv.Error) as exc:
        raise CatalogueUnavailable('Catalogue service failed, was rate limited, or timed out. Please retry later.') from exc


class CatalogueService:
    """Bounded LRU/TTL caches, separate raw queries and frame projection batches."""
    def __init__(self, fetch=retrieve, clock=time.monotonic):
        self.fetch, self.clock = fetch, clock
        self.raw, self.projected = OrderedDict(), OrderedDict()
        self.locks = {key: threading.Lock() for key in SERVICES}

    def cached(self, cache, key):
        if key in cache:
            expires, value = cache[key]
            if expires > self.clock():
                cache.move_to_end(key)
                return value
            del cache[key]
        return None

    def save(self, cache, key, value, empty=False):
        cache[key] = (self.clock()+(60 if empty else 900), value)
        while len(cache) > 32:
            cache.popitem(last=False)

    def overlay(self, data, catalogue, limit=500):
        if catalogue not in SERVICES or type(limit) is not int or not 1 <= limit <= 1000:
            raise ValueError('Invalid catalogue or result limit')
        w, center, radius = footprint(data)
        margin = 120 if catalogue == 'gaia' else 0
        radius += margin/3600
        query = query_text(catalogue, center, radius, limit)
        raw_key = (VERSION, catalogue, SERVICES[catalogue][0], query)
        grid_key = hashlib.sha256(json.dumps([data.grid, data.width, data.height,
                                  [(f.id, f.timestamp) for f in data.frames]], sort_keys=True).encode()).hexdigest()
        key = (raw_key, data.dataset_id, grid_key)
        # One in-flight request per service. Busy responses do not block image viewing.
        if not self.locks[catalogue].acquire(timeout=.1):
            raise CatalogueUnavailable('Catalogue service is busy. Please retry later.')
        try:
            result = self.cached(self.projected, key)
            if result is not None:
                return result
            raw = self.cached(self.raw, raw_key)
            if raw is None:
                raw = self.fetch(catalogue, query, limit)
                self.save(self.raw, raw_key, raw, empty=not raw[0])
            rows, truncated, retrieved = raw
            projected = project_sources(rows, data, w, catalogue)
            result = Overlay(dataset_id=data.dataset_id, catalogue=catalogue, release=SERVICES[catalogue][0],
                             sources=projected, frames={f.id: f.timestamp for f in data.frames},
                             width=data.width, height=data.height, retrieved_at=retrieved,
                             provenance_url=SERVICES[catalogue][6], service_url=SERVICES[catalogue][1],
                             result_limit=limit, preselection_count=len(rows), truncated=truncated,
                             completeness='Limited reference subset; never a complete source inventory.',
                             query_radius_deg=radius, motion_margin_arcsec=margin,
                             warnings=['Markers do not confirm SPHEREx detections or physical identity.',
                                       'Band magnitudes and image intensities are not interchangeable.'] +
                                      (['Angular proper motion only: no parallax, radial velocity, perspective acceleration or uncertainty propagation. '
                                        '120 arcsec query margin cannot ensure coverage for all moving sources.'] if catalogue == 'gaia' else
                                       ['AllWISE positions are not propagated to the observation date.']))
            self.save(self.projected, key, result, empty=not rows)
            return result
        finally:
            self.locks[catalogue].release()
