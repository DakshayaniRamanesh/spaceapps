"""Offline authenticity, array-reproduction and PNG checks for featured snapshots."""
import hashlib
from pathlib import Path
import sys

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.irsa import ManifestStore, SEEDS
from app.science import display_stretch, prepare_fits, real_png, pair_report


def main():
    count = 0
    for path in sorted(SEEDS.glob('irsa-*/manifest.json')):
        store = ManifestStore()
        data = store.load(path.parent.name)
        prepared = []
        for frame in data.frames:
            original = (path.parent/'original'/f'{frame.sha256}.fits').read_bytes()
            assert hashlib.sha256(original).hexdigest() == frame.sha256
            p = prepare_fits(original, data.request)
            assert p.timestamp == frame.timestamp
            assert p.lambda_um == frame.lambda_um
            assert p.quality.model_dump() == frame.quality.model_dump()
            with np.load(store.frame_path(frame.id, 'npz'), allow_pickle=False) as arrays:
                for key, actual in [('intensity', p.intensity), ('variance', p.variance),
                                    ('wavelength', p.wavelength), ('bandwidth', p.bandwidth)]:
                    np.testing.assert_array_equal(actual, arrays[key])
                np.testing.assert_array_equal(arrays['mask'], ~np.isfinite(p.intensity))
            assert real_png(p.intensity, data.display_stretch) == store.frame_path(frame.id).read_bytes()
            prepared.append(p)
            count += 1
            print(frame.obs_id, frame.timestamp, f'{frame.lambda_um:.6f} um', frame.sha256)
        assert display_stretch([p.intensity for p in prepared]) == data.display_stretch
        for i in range(len(prepared)):
            for j in range(i+1, len(prepared)):
                report = pair_report(data.frames[i].id, data.frames[j].id, prepared[i], prepared[j])
                saved = store.pair(data.frames[i].id, data.frames[j].id)
                assert report.model_dump() == saved.model_dump()
    assert count >= 2, 'At least two genuine featured exposures are required'
    print(f'Verified {count} original FITS checksums, timestamps, science arrays, masks, PNGs and pair reports offline.')


if __name__ == '__main__':
    main()
