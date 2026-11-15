"""Archive outages must stay distinct from a successful empty search."""
import httpx
import pytest

from app.archive.bounded import ArchiveClient, ArchiveUnavailable
from app.models import FieldRequest

REQ = FieldRequest(ra=248.167611, dec=66.754978, detector='D3')
HEADER = 'obs_id,access_url,t_min,energy_bandpassname\n'
ROW = ('example,https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/level2/example.fits,'
       '61000,SPHEREx-D3\n')


@pytest.fixture(autouse=True)
def no_retry_delay(monkeypatch):
    monkeypatch.setattr('app.archive.bounded.time.sleep', lambda _: None)


@pytest.mark.parametrize('failure, message', [
    (502, 'IRSA returned HTTP 502. Please retry later.'),
    (httpx.ReadTimeout, 'IRSA did not respond before the request timed out. Please retry later.'),
    (httpx.ConnectError, 'The observation service could not connect to IRSA. Please retry later.'),
])
def test_both_collection_failures_report_one_specific_error(failure, message, caplog):
    requests = []

    def respond(request):
        requests.append(request)
        if isinstance(failure, int):
            return httpx.Response(failure)
        raise failure('upstream unavailable', request=request)

    client = ArchiveClient(client=httpx.Client(transport=httpx.MockTransport(respond)))
    try:
        with pytest.raises(ArchiveUnavailable) as error:
            client.discover(REQ)
        assert str(error.value) == message
        assert len(requests) == 4  # One bounded retry for each collection.
        assert {r.url.params['COLLECTION'] for r in requests} == {'spherex_dr1', 'spherex_qr3'}
        assert all(r.url.params['POS'] == 'CIRCLE 248.167611 66.754978 0.0002777777777777778'
                   for r in requests)
        assert 'IRSA request failed' in caplog.text
    finally:
        client.close()


def test_transient_failure_retries_successfully():
    calls = 0

    def respond(request):
        nonlocal calls
        calls += 1
        return httpx.Response(502) if calls == 1 else httpx.Response(200, text=HEADER)

    client = ArchiveClient(client=httpx.Client(transport=httpx.MockTransport(respond)))
    try:
        assert client.discover(REQ) == ([], True, [])
        assert calls == 3
    finally:
        client.close()


def test_partial_results_keep_collection_failure_visible():
    def respond(request):
        if request.url.params['COLLECTION'] == 'spherex_qr3':
            return httpx.Response(502)
        return httpx.Response(200, text=HEADER + ROW)

    client = ArchiveClient(client=httpx.Client(transport=httpx.MockTransport(respond)))
    try:
        rows, complete, warnings = client.discover(REQ)
        assert len(rows) == 1 and rows[0]['obs_id'] == 'example'
        assert complete is False
        assert warnings == ['spherex_qr3: IRSA returned HTTP 502. Please retry later.']
    finally:
        client.close()
