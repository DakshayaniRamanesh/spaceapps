"""Live public-service smoke check; no fixtures or replacement sources."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'backend'))
from app.catalogues import CatalogueService
from app.models import ObservationSet

path = next((Path(__file__).resolve().parents[1]/'backend/data/featured').glob('*/manifest.json'))
data = ObservationSet.model_validate_json(path.read_text())
service = CatalogueService()
for catalogue in ('gaia', 'wise'):
    try:
        result = service.overlay(data, catalogue, 500)
        print(f'{result.release}: SUCCESS; {len(result.sources)} projected sources; '
              f'{result.preselection_count} preselected; truncated={result.truncated}; '
              f'retrieved={result.retrieved_at}; dataset={data.dataset_id}', flush=True)
    except Exception as exc:
        print(f'{catalogue}: FAILED: {type(exc).__name__}: {exc}', flush=True)
        if exc.__cause__:
            print(f'  Upstream cause: {type(exc.__cause__).__name__}: {exc.__cause__}', flush=True)
