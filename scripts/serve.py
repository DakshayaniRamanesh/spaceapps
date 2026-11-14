"""Run the web server and single-host archive worker in one container."""
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

root = Path(__file__).resolve().parents[1] if Path(__file__).parent.name == 'scripts' else Path(__file__).parent
children = []


def stop(signum=None, frame=None):
    for child in children:
        if child.poll() is None:
            child.terminate()
    deadline = time.monotonic()+10
    for child in children:
        try:
            child.wait(timeout=max(0.1, deadline-time.monotonic()))
        except subprocess.TimeoutExpired:
            child.kill()


signal.signal(signal.SIGTERM, stop)
signal.signal(signal.SIGINT, stop)
try:
    children.append(subprocess.Popen([sys.executable, '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1',
                                      '--port', '8000', '--workers', '1', '--no-proxy-headers'], cwd=root/'backend'))
    env = {**os.environ, 'HOSTNAME': '0.0.0.0', 'PORT': os.getenv('PORT', '3000')}
    children.append(subprocess.Popen(['node', 'server.js'], cwd=root/'frontend', env=env))
    while all(child.poll() is None for child in children):
        time.sleep(.2)
    code = next((child.returncode for child in children if child.returncode is not None), 1)
finally:
    stop()
raise SystemExit(code)
