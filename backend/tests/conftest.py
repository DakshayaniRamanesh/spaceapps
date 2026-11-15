"""Legacy numerical/API tests explicitly exercise the opt-in simulator."""
import os
from pathlib import Path

os.environ['OBSERVATION_SOURCE'] = 'synthetic'
# Importing the app must never recover/mark jobs in a developer's running API.
os.environ['SKYTRACE_DATA_DIR'] = str(Path(__file__).resolve().parents[2]/'.cache'/'pytest-runtime')
