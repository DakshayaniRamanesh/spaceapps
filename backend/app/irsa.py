"""Persistent manifests and the shared featured/custom IRSA processor."""
from datetime import datetime, timezone
import hashlib
import itertools
import json
import csv
import logging
import os
from pathlib import Path
import re
import shutil
import tempfile
import time

import numpy as np

from .archive import ArchiveClient, ArchiveUnavailable, BudgetExceeded, COLLECTIONS, shortlist
from .models import FieldRequest, Frame, ObservationSet
from .providers import RANGES, canonical
from .science import VERSION, display_stretch, pair_report, prepare_fits, real_png, target_grid

LOG = logging.getLogger(__name__)
SEEDS = Path(__file__).resolve().parents[1] / 'data' / 'featured'


def utcnow():
    return datetime.now(timezone.utc).isoformat()


def request_key(req):
    value = {'request': canonical(req).model_dump(), 'processing': VERSION,
             'collections': COLLECTIONS, 'selection': 'footprint-ranked12-spectral-group6'}
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()[:24]


class ManifestStore:
    def __init__(self, root=None, seeds=None):
        self.root = Path(root or os.getenv('SKYTRACE_DATA_DIR', Path(__file__).resolve().parents[1] / 'var'))
        self.seeds = Path(seeds) if seeds is not None else SEEDS
        self.root.mkdir(parents=True, exist_ok=True)

    def _directory(self, dataset_id):
        if not re.fullmatch(r'irsa-[a-f0-9]{24}', dataset_id):
            raise ValueError('Unknown observation set')
        for base in (self.seeds, self.root):
            path = base / dataset_id
            if (path / 'manifest.json').is_file():
                return path
        raise ValueError('Observation set not found or expired')

    def load(self, dataset_id):
        return ObservationSet.model_validate_json((self._directory(dataset_id) / 'manifest.json').read_text())

    def cached(self, req):
        key = request_key(req)
        # Featured snapshots are immutable, versioned real-data demonstrations.
        for base in (self.seeds, self.root):
            index = base / f'{key}.json'
            if not index.is_file():
                continue
            try:
                entry = json.loads(index.read_text())
                data = self.load(entry['dataset_id'])
                ttl = 3600 if not data.frames else 86400
                if base == self.seeds or time.time()-entry['cached_at'] < ttl:
                    return data
            except (ValueError, KeyError, OSError):
                continue
        return None

    def frame_path(self, frame_id, suffix='png'):
        match = re.fullmatch(r'(irsa-[a-f0-9]{24})-([0-9]{2})', frame_id)
        if not match:
            raise ValueError('Unknown frame identifier')
        data = self.load(match[1])
        if frame_id not in {f.id for f in data.frames}:
            raise ValueError('Unknown frame identifier')
        return self._directory(match[1]) / f'{frame_id}.{suffix}'

    def array(self, frame_id):
        with np.load(self.frame_path(frame_id, 'npz'), allow_pickle=False) as data:
            return data['intensity'].copy()

    def original_path(self, frame_id):
        self.frame_path(frame_id)
        data = self.load(frame_id.rsplit('-', 1)[0])
        frame = next(f for f in data.frames if f.id == frame_id)
        if not frame.sha256 or not re.fullmatch(r'[a-f0-9]{64}', frame.sha256):
            raise ValueError('Original cutout checksum unavailable')
        path = self._directory(data.dataset_id) / 'original' / f'{frame.sha256}.fits'
        if not path.is_file():
            raise ValueError('Original cutout unavailable or expired')
        return path

    def pair(self, frame_a, frame_b):
        self.frame_path(frame_a)
        self.frame_path(frame_b)
        dataset = self.load(frame_a.rsplit('-', 1)[0])
        for p in dataset.pairs:
            if {p.a, p.b} == {frame_a, frame_b}:
                return p
        raise ValueError('No assessed comparison exists for this pair')

    def trim(self, max_bytes=1024*1024*1024):
        # Called only by the single worker, never while publishing an active dataset.
        directories = sorted((p for p in self.root.glob('irsa-*') if p.is_dir()), key=lambda p: p.stat().st_mtime)
        sizes = [(p, sum(f.stat().st_size for f in p.rglob('*') if f.is_file())) for p in directories]
        total = sum(s for _, s in sizes)
        for path, size in sizes:
            if total <= max_bytes:
                break
            shutil.rmtree(path)
            total -= size


class IRSAProcessor:
    def __init__(self, store, archive_factory=ArchiveClient):
        self.store, self.archive_factory = store, archive_factory

    def process(self, request, progress=lambda stage: None):
        req = canonical(request)
        if req.fov_arcmin > 30:
            raise ValueError('Real-data requests are limited to 2–30 arcminutes')
        cached = self.store.cached(req)
        if cached:
            return cached
        self.store.trim()
        client = self.archive_factory()
        staging = Path(tempfile.mkdtemp(prefix='.processing-', dir=self.store.root))
        try:
            progress('Searching NASA IRSA')
            rows, metadata_complete, warnings = client.discover(req)
            with (staging / 'inventory.csv').open('w', newline='') as stream:
                writer = csv.DictWriter(stream, fieldnames=['obs_id', 'access_url', 'collection', 'mjd', 'footprint'])
                writer.writeheader()
                writer.writerows(rows)
            prepared, originals = [], []
            for row in shortlist(rows, req):
                progress(f'Preparing exposure {len(prepared)+1} (bounded sample of {len(rows)} records)')
                try:
                    content, cutout_url = client.cutout(row, req)
                    frame = prepare_fits(content, req)
                    prepared.append((row, frame, cutout_url))
                    original = staging / f'{frame.sha256}.fits'
                    original.write_bytes(content)
                    originals.append(original)
                except BudgetExceeded as exc:
                    warnings.append(str(exc))
                    break
                except (ArchiveUnavailable, ValueError, OSError) as exc:
                    warnings.append(f"{row['obs_id']}: {exc}")
                    LOG.warning('Exposure rejected: %s (%s)', row['obs_id'], exc)
            if rows and not prepared:
                raise ArchiveUnavailable('Archive records exist, but none of the bounded cutouts could be prepared. Retry or choose another field.')
            progress('Assessing spectral overlap and registration')
            prepared.sort(key=lambda p: p[1].timestamp)
            # Prefer a coherent spectral preview group. Membership must pass against
            # every existing member; adjacency alone is not transitive compatibility.
            reports = {}
            for i, j in itertools.combinations(range(len(prepared)), 2):
                reports[i, j] = pair_report(str(i), str(j), prepared[i][1], prepared[j][1])
            groups = []
            for i in range(len(prepared)):
                group = [i]
                for j in range(len(prepared)):
                    if j == i:
                        continue
                    if all(reports[min(k, j), max(k, j)].spectral_overlap_fraction >= .9 and
                           reports[min(k, j), max(k, j)].overlap_fraction >= .8 for k in group):
                        group.append(j)
                groups.append(sorted(group))
            group = max(groups, key=lambda g: (len(g), prepared[g[-1]][0]['mjd']-prepared[g[0]][0]['mjd'])) if groups else []
            if len(group) < 2:
                group = list(range(min(6, len(prepared))))
                if len(group) > 1:
                    warnings.append('No coherent spectral group found in the assessed sample. Wavelength changes can mimic variability.')
            selected = [prepared[i] for i in group[:6]]
            complete = metadata_complete and len(prepared) == len(rows)
            if not complete:
                warnings.append(f'Assessed {len(prepared)} of {len(rows)} archive records. This bounded search cannot rule out other compatible epochs.')
            identity = {'request': req.model_dump(), 'version': VERSION,
                        'products': [p[1].sha256 for p in selected]}
            dataset_id = 'irsa-'+hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()[:24]
            grid, size = target_grid(req)
            stretch = display_stretch([p[1].intensity for p in selected]) if selected else {}
            frames = []
            for i, (row, p, cutout_url) in enumerate(selected):
                frame_id = f'{dataset_id}-{i:02d}'
                frames.append(Frame(id=frame_id, timestamp=p.timestamp, image_url=f'/api/frames/{frame_id}.png',
                                    detector=req.detector, source='spherex-irsa', quality=p.quality,
                                    obs_id=row['obs_id'], collection=row['collection'], access_url=row['access_url'],
                                    cutout_url=cutout_url, sha256=p.sha256, product_version=p.version,
                                    downloaded_at=utcnow(), lambda_um=p.lambda_um, bandwidth_um=p.bandwidth_um,
                                    wavelength_origin='WCS-WAVE (visualization-grade)'))
                np.savez_compressed(staging / f'{frame_id}.npz', intensity=p.intensity, variance=p.variance,
                                    wavelength=p.wavelength, bandwidth=p.bandwidth,
                                    mask=~np.isfinite(p.intensity))
                (staging / f'{frame_id}.png').write_bytes(real_png(p.intensity, stretch))
            pairs = [pair_report(frames[i].id, frames[j].id, selected[i][1], selected[j][1])
                     for i, j in itertools.combinations(range(len(frames)), 2)]
            availability = ('no_coverage' if not rows else 'single_epoch' if len(frames) == 1 else 'preview')
            if not complete:
                availability = 'search_incomplete'
            notice = ('Real SPHEREx spectral images from NASA/IPAC IRSA. Celestial WCS alignment and a shared display stretch; '
                      'zodiacal model subtracted once. Wavelengths may differ. Preview comparisons do not establish variability or motion. '
                      'Scientific subtraction is unavailable until spectral-response, PSF and background validation is complete.')
            if not rows:
                notice = 'No archive exposures cover the requested field center for the selected detector in the searched DR1/QR3 wide-survey collections.'
            data = ObservationSet(source_type='spherex-irsa', dataset_id=dataset_id, request=req,
                                  frames=frames, pairs=pairs, width=size, height=size,
                                  coordinate_system='ICRS; north up, east left; common TAN grid',
                                  intensity_unit='MJy/sr', wavelength_range_um=RANGES[int(req.detector[1])-1],
                                  wavelength_model='Per-pixel LVF WCS-WAVE lookup; not a single broadband detector image',
                                  notice=notice, availability=availability, search_complete=complete,
                                  archive_records=len(rows), assessed_records=len(prepared), processing_version=VERSION,
                                  created_at=utcnow(), display_stretch=stretch, warnings=warnings,
                                  grid=dict(grid.to_header()))
            (staging / 'manifest.json').write_text(data.model_dump_json(indent=2))
            # Retain original cutouts in runtime storage for reproducibility. Featured
            # source snapshots can be regenerated from exact cutout URLs and hashes.
            original_dir = staging / 'original'
            original_dir.mkdir()
            selected_hashes = {p[1].sha256 for p in selected}
            for path in originals:
                if path.stem in selected_hashes:
                    path.rename(original_dir / path.name)
                    (original_dir / path.name).chmod(0o444)
                else:
                    path.unlink()
            destination = self.store.root / dataset_id
            if destination.exists():
                shutil.rmtree(staging)
            else:
                staging.rename(destination)
            index = self.store.root / f'{request_key(req)}.json'
            temporary = index.with_suffix('.tmp')
            temporary.write_text(json.dumps({'dataset_id': dataset_id, 'cached_at': time.time()}))
            temporary.replace(index)
            return data
        finally:
            client.close()
            if staging.exists():
                shutil.rmtree(staging)
