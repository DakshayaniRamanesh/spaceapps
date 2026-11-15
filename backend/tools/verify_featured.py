"""Offline authenticity, array-reproduction and PNG checks for featured snapshots."""
import hashlib
from pathlib import Path
import sys
import io
from PIL import Image

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.irsa import ManifestStore, SEEDS
from app.science.preview import display_stretch, prepare_fits, real_png, pair_report


def assert_metadata(actual, expected):
    """Compare derived floating metadata across supported BLAS/WCS platforms."""
    if isinstance(actual, dict):
        assert actual.keys() == expected.keys()
        for key in actual:
            assert_metadata(actual[key], expected[key])
    elif isinstance(actual, list):
        assert len(actual) == len(expected)
        for a, b in zip(actual, expected):
            assert_metadata(a, b)
    elif isinstance(actual, float):
        np.testing.assert_allclose(actual, expected, rtol=8*np.finfo(np.float32).eps, atol=1e-12)
    else:
        assert actual == expected


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
            np.testing.assert_allclose(p.lambda_um, frame.lambda_um, rtol=1e-12, atol=1e-12)
            assert_metadata(p.quality.model_dump(), frame.quality.model_dump())
            with np.load(store.frame_path(frame.id, 'npz'), allow_pickle=False) as arrays:
                for key, actual in [('intensity', p.intensity), ('variance', p.variance),
                                    ('wavelength', p.wavelength), ('bandwidth', p.bandwidth)]:
                    np.testing.assert_allclose(actual, arrays[key], rtol=8*np.finfo(np.float32).eps, atol=0, equal_nan=True)
                np.testing.assert_array_equal(arrays['mask'], ~np.isfinite(p.intensity))
            # PNG compression can differ across Pillow/zlib builds; decoded pixels
            # (including alpha/missing-data orientation) must remain exactly equal.
            decoded = np.array(Image.open(io.BytesIO(real_png(p.intensity, data.display_stretch))))
            saved_png = np.array(Image.open(store.frame_path(frame.id)))
            np.testing.assert_array_equal(decoded, saved_png)
            prepared.append(p)
            count += 1
            print(frame.obs_id, frame.timestamp, f'{frame.lambda_um:.6f} um', frame.sha256)
        assert_metadata(display_stretch([p.intensity for p in prepared]), data.display_stretch)
        for i in range(len(prepared)):
            for j in range(i+1, len(prepared)):
                report = pair_report(data.frames[i].id, data.frames[j].id, prepared[i], prepared[j])
                saved = store.pair(data.frames[i].id, data.frames[j].id)
                assert_metadata(report.model_dump(), saved.model_dump())
    assert count >= 2, 'At least two genuine featured exposures are required'
    print(f'Verified {count} original FITS checksums, timestamps, science arrays, masks, PNGs and pair reports offline.')


if __name__ == '__main__':
    main()
