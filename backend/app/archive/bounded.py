"""Bounded, public IRSA access. Client-supplied URLs are never accepted."""
import csv
import io
import time
from urllib.parse import urlsplit, urlencode

import httpx
import numpy as np

from ..models import FieldRequest

COLLECTIONS = ('spherex_dr1', 'spherex_qr3')


class ArchiveUnavailable(RuntimeError):
    pass


class BudgetExceeded(RuntimeError):
    pass


def validate_archive_url(url: str) -> str:
    p = urlsplit(url)
    if (p.scheme != 'https' or p.hostname != 'irsa.ipac.caltech.edu' or
            p.port not in (None, 443) or p.username or p.password or p.fragment or p.query or
            not p.path.startswith(('/ibe/data/spherex/dr1/level2/', '/ibe/data/spherex/qr3/level2/')) or
            not p.path.endswith('.fits') or '..' in p.path or '%' in p.path or '\\' in p.path):
        raise ValueError('Unapproved archive URL')
    return url


class ArchiveClient:
    def __init__(self, seconds=240, max_bytes=120*1024*1024, client=None):
        self.deadline = time.monotonic()+seconds
        self.remaining_bytes = max_bytes
        self.client = client or httpx.Client(timeout=httpx.Timeout(45, connect=10), follow_redirects=False,
                                             headers={'User-Agent': 'SkyTrace/2.1 (NASA Space Apps; bounded public-data client)'})

    def close(self):
        self.client.close()

    def read(self, url, params=None, limit=20*1024*1024):
        for attempt in range(2):
            if time.monotonic() >= self.deadline or self.remaining_bytes <= 0:
                raise BudgetExceeded('Processing time or download-byte budget reached')
            try:
                with self.client.stream('GET', url, params=params,
                                        timeout=min(45, max(1, self.deadline-time.monotonic()))) as response:
                    response.raise_for_status()  # Redirects are rejected, not followed.
                    chunks, size = [], 0
                    for block in response.iter_bytes():
                        size += len(block)
                        self.remaining_bytes -= len(block)
                        if size > limit or self.remaining_bytes < 0 or time.monotonic() >= self.deadline:
                            raise BudgetExceeded('Archive response exceeded resource limits')
                        chunks.append(block)
                    return b''.join(chunks)
            except (httpx.HTTPError, httpx.StreamError) as exc:
                if attempt:
                    raise ArchiveUnavailable('IRSA request failed or timed out; retry later') from exc
                time.sleep(min(.5, max(0, self.deadline-time.monotonic())))
        raise ArchiveUnavailable('IRSA unavailable')

    def discover(self, req: FieldRequest):
        found, complete, failures = {}, True, []
        for collection in COLLECTIONS:
            try:
                content = self.read('https://irsa.ipac.caltech.edu/SIA', params={
                    'COLLECTION': collection,
                    # Find exposures containing the center, then measure actual
                    # requested-field coverage from their WCS and masks.
                    'POS': f'CIRCLE {req.ra} {req.dec} 0.0002777777777777778',
                    'RESPONSEFORMAT': 'CSV',
                }, limit=5*1024*1024)
                reader = csv.DictReader(io.StringIO(content.decode('utf-8-sig')))
                if not {'obs_id', 'access_url', 't_min', 'energy_bandpassname'} <= set(reader.fieldnames or []):
                    raise ArchiveUnavailable('IRSA returned an unexpected metadata format')
                count = 0
                for row in reader:
                    count += 1
                    if count >= 2000:
                        complete = False
                        break
                    if row['energy_bandpassname'] != f'SPHEREx-{req.detector}':
                        continue
                    try:
                        url = validate_archive_url(row['access_url'])
                        epoch = float(row['t_min'])
                        if not (50000 < epoch < 100000):
                            continue
                        if req.start_mjd is not None and epoch < req.start_mjd:
                            continue
                        if req.end_mjd is not None and epoch >= req.end_mjd:
                            continue
                    except (ValueError, TypeError):
                        continue
                    key = (row['obs_id'], req.detector)
                    # The newest processing date is preferred for duplicate products.
                    if key not in found or url > found[key]['access_url']:
                        found[key] = {'obs_id': row['obs_id'], 'access_url': url,
                                      'collection': collection, 'mjd': epoch, 'footprint': row.get('s_region', '')}
            except (ArchiveUnavailable, BudgetExceeded) as exc:
                complete = False
                failures.append(str(exc))
        if not found and failures:
            raise ArchiveUnavailable('; '.join(failures))
        return sorted(found.values(), key=lambda r: r['mjd']), complete, failures

    def cutout(self, row, req):
        url = validate_archive_url(row['access_url'])
        # Archive cutouts follow detector axes. Pad by sqrt(2) plus interpolation
        # margin so rotation does not crop the requested north-up output square.
        size = np.ceil((req.fov_arcmin/60*2**.5 + 4*6.15/3600)*100)/100
        params = {'center': f'{req.ra},{req.dec}', 'size': f'{size:.2f}'}
        return self.read(url, params=params), url+'?'+urlencode(params)


def footprint_position(row, req):
    """Approximate detector position/orientation for ranking only, never science.

    The SPHEREx footprint order follows detector corners (0,0), (1,0),
    (1,1), (0,1). A local tangent fit estimates target position. Exact spectral
    screening always happens after the FITS download.
    """
    try:
        values = row['footprint'].split()
        if values[:2] != ['POLYGON', 'ICRS']:
            return None
        corners = np.asarray([float(v) for v in values[2:10]]).reshape(4, 2)
        ra, dec = np.deg2rad(corners.T)
        a0, d0 = np.deg2rad([req.ra, req.dec])
        denominator = np.sin(d0)*np.sin(dec)+np.cos(d0)*np.cos(dec)*np.cos(ra-a0)
        x = np.cos(dec)*np.sin(ra-a0)/denominator
        y = (np.cos(d0)*np.sin(dec)-np.sin(d0)*np.cos(dec)*np.cos(ra-a0))/denominator
        matrix = np.column_stack((x, y, np.ones(4)))
        nx = np.linalg.lstsq(matrix, [0, 1, 1, 0], rcond=None)[0][2]
        ny = np.linalg.lstsq(matrix, [0, 0, 1, 1], rcond=None)[0][2]
        angle = np.arctan2(y[1]-y[0], x[1]-x[0])
        return float(nx), float(ny), float(angle)
    except (ValueError, KeyError, np.linalg.LinAlgError):
        return None


def shortlist(rows, req=None, limit=12):
    """Rank similar detector positions/orientations, then spread across epochs."""
    if req is not None:
        limit = req.limit
        if req.spread:
            spread, bins, last = [], set(), None
            for row in rows:
                bucket = int(row['mjd']//30)
                if bucket not in bins and (last is None or row['mjd']-last >= 29):
                    spread.append(row)
                    bins.add(bucket)
                    last = row['mjd']
            return spread[:limit]
    all_rows = rows
    ranked = []
    if req is not None:
        positioned = [(r, footprint_position(r, req)) for r in rows]
        positioned = [(r, p) for r, p in positioned if p and .06 < p[0] < .94 and .06 < p[1] < .94]
        groups = []
        for row, position in positioned:
            group = [r for r, p in positioned if abs(p[1]-position[1]) <= .012 and
                     abs(np.arctan2(np.sin(p[2]-position[2]), np.cos(p[2]-position[2]))) < np.deg2rad(15)]
            if len(group) > 1 and group[-1]['mjd']-group[0]['mjd'] >= 1:
                groups.append(group)
        if groups:
            ranked = max(groups, key=lambda g: (len(g), g[-1]['mjd']-g[0]['mjd']))
    if len(ranked) > limit:
        ranked = [ranked[round(i*(len(ranked)-1)/(limit-1))] for i in range(limit)]
    # Keep fallback candidates within the same total download budget, so an
    # unavailable preferred product cannot make the whole field unusable.
    spread = (all_rows if len(all_rows) <= limit else
              [all_rows[round(i*(len(all_rows)-1)/(limit-1))] for i in range(limit)])
    selected = list(ranked)
    for row in spread:
        if row not in selected and len(selected) < limit:
            selected.append(row)
    return selected
