# Deployment

## One-container deployment

`docker compose up --build` starts the public Next.js server on port 3000 and a private FastAPI server on 127.0.0.1:8000 inside the same container. The single Python worker and persistent SQLite/runtime cache use `/data`. A named volume preserves data across container restarts. The image runs as a non-root user.

Set the host/platform `PORT` environment variable if needed; the web server listens on 0.0.0.0 at that port. FastAPI remains private. The production proxy target is built as http://127.0.0.1:8000. Changing a standalone proxy destination requires rebuilding the Next.js image.

Recommended starting resources: 2 GiB RAM and one or two CPU cores. This is a starting allocation, not a measured production capacity guarantee. Run one container/worker per data directory; do not share its SQLite store across distributed replicas. Set platform request timeouts to support short job submissions/polls; long processing happens in the worker.

Runtime jobs may be interrupted by restart; they become failed/retryable. Cached genuine featured observations remain available from the image even when IRSA is unavailable. Set an external HTTPS endpoint using your host's TLS support. An upstream proxy should limit request body sizes and protect the public endpoint according to expected traffic.

## Render blueprint

The repository includes `render.yaml`. In a Render account, choose New Blueprint and connect this repository. Review the service resource/cost options before creating it. The blueprint uses temporary runtime storage; a restart discards custom cache/jobs, while bundled featured data remains intact. Add a persistent disk and change SKYTRACE_DATA_DIR to its mount path if persistence is desired.

No hosting account has been created, no paid resources are assumed, and no public URL is fabricated by this configuration. If a different Docker-capable host is available, deploy the same image there.

## Separate services

Run `uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1` from backend with the Python dependencies installed and writable SKYTRACE_DATA_DIR. Build the frontend with API_INTERNAL_URL set to the backend's reachable internal address. Only use explicitly trusted CORS origins if accessing the API directly from a browser. The normal frontend uses a same-origin proxy.

## Verify the deployed service

1. GET `/health`: real_data_enabled=true and scientific_subtraction_enabled=false.
2. Open `/explore`: the two bundled R Draconis images load without live IRSA.
3. Play/blink, open Comparison evidence, inspect original FITS links and download a manifest.
4. Call the real `/api/difference` pair directly: it must return 422.
5. Try a custom field: observe queued/running followed by prepared data, a truthful bounded/empty result, or a retryable archive failure.
6. Inspect logs and disk use. Verify runtime volume permissions and persistence behavior for the chosen host.
