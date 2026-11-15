FROM node:24-bookworm-slim AS web
WORKDIR /build/frontend
COPY . /build/
ENV NEXT_TELEMETRY_DISABLED=1 API_INTERNAL_URL=http://127.0.0.1:8000
RUN --mount=type=secret,id=build_ca \
    if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; \
    npm ci --cache /tmp/npm-cache --no-audit --no-fund \
    && npm run build \
    && mkdir -p /runtime/frontend/.next /runtime/backend /runtime/bin /runtime/lib \
    && cp -a .next/standalone/. /runtime/ \
    && cp -a public /runtime/frontend/public \
    && cp -a .next/static /runtime/frontend/.next/static \
    && cp -a /build/backend/app /runtime/backend/app \
    && cp -a /build/backend/data /runtime/backend/data \
    && cp /build/scripts/serve.py /runtime/serve.py \
    && cp /build/backend/requirements-tested.txt /runtime/requirements.txt \
    && cp /usr/local/bin/node /runtime/bin/node \
    && for library in $(ldd /usr/local/bin/node | awk '/libstdc\+\+|libgcc_s/ { print $3 }'); do cp "$library" /runtime/lib/; done \
    && rm -rf /build /root/.npm /tmp/npm-cache

FROM python:3.12-slim-bookworm AS runtime
WORKDIR /app
# This dependency also keeps the two memory/disk-heavy build stages sequential.
COPY --from=web --chown=10001:10001 /runtime/ /app/
RUN --mount=type=secret,id=build_ca \
    if [ -f /run/secrets/build_ca ]; then export PIP_CERT=/run/secrets/build_ca; fi; \
    pip install --no-cache-dir -r /app/requirements.txt \
    && useradd --create-home --uid 10001 skytrace \
    && mkdir /data && chown skytrace:skytrace /data
ENV PORT=3000 SKYTRACE_DATA_DIR=/data OBSERVATION_SOURCE=irsa \
    PYTHONUNBUFFERED=1 NEXT_TELEMETRY_DISABLED=1 PATH=/app/bin:$PATH LD_LIBRARY_PATH=/app/lib
USER skytrace
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
    CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:'+os.getenv('PORT','3000')+'/health',timeout=3)"
CMD ["python", "/app/serve.py"]
