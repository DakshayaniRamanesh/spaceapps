"""Prepare genuine featured fields using exactly the live-request processor.

Run from the repository root: python backend/tools/prepare_featured.py --target r-dra
"""
import argparse
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.irsa import IRSAProcessor, ManifestStore
from app.models import FieldRequest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target', default='r-dra', help='Preset ID or all')
    parser.add_argument('--detector', choices=[f'D{i}' for i in range(1, 7)], default='D3')
    parser.add_argument('--fov', type=float, default=12)
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1]/'data'/'featured')
    args = parser.parse_args()
    presets = json.loads((Path(__file__).resolve().parents[1]/'app'/'presets.json').read_text())
    selected = [p for p in presets if args.target in ('all', p['id'])]
    if not selected:
        parser.error('Unknown target preset')
    if not 2 <= args.fov <= 30:
        parser.error('Real-data FOV must be 2–30 arcminutes')
    # Do not resolve old snapshots from the checked-in seed directory when
    # explicitly rebuilding: use runtime TTLs in the specified output directory.
    store = ManifestStore(args.output, seeds=args.output/'.unused-seeds')
    failures = 0
    for target in selected:
        print(target['name'], flush=True)
        try:
            data = IRSAProcessor(store).process(FieldRequest(ra=target['ra'], dec=target['dec'],
                                                           fov_arcmin=args.fov, detector=args.detector),
                                                lambda stage: print(stage, flush=True))
            print(data.dataset_id, len(data.frames), 'frames;', data.availability, flush=True)
        except Exception as exc:
            failures += 1
            print(f"{target['id']}: {exc}", file=sys.stderr)
    return 1 if failures else 0


if __name__ == '__main__':
    raise SystemExit(main())
