"""Bounded in-memory content cache for manifests and scientific arrays."""
from __future__ import annotations

import collections
import threading
from typing import Any

import numpy as np


class BoundedArrayCache:
    """Thread-safe LRU cache for float32 scientific images and byte buffers."""

    def __init__(self, max_items: int = 256):
        self.max_items = max_items
        self._data: collections.OrderedDict[str, Any] = collections.OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: str) -> Any | None:
        with self._lock:
            if key in self._data:
                self._data.move_to_end(key)
                return self._data[key]
            return None

    def set(self, key: str, value: Any) -> None:
        with self._lock:
            if key in self._data:
                self._data.move_to_end(key)
            self._data[key] = value
            while len(self._data) > self.max_items:
                self._data.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._data.clear()


ARRAY_CACHE = BoundedArrayCache(max_items=128)
SCIENCE_CACHE = BoundedArrayCache(max_items=128)
RENDER_CACHE = BoundedArrayCache(max_items=256)
MANIFEST_CACHE = BoundedArrayCache(max_items=64)
FRAME_METADATA_STORE: dict[str, dict] = {}
STORE_LOCK = threading.Lock()


def register_frame_record(frame_id: str, record: dict) -> None:
    with STORE_LOCK:
        FRAME_METADATA_STORE[frame_id] = record


def get_frame_record(frame_id: str) -> dict | None:
    with STORE_LOCK:
        return FRAME_METADATA_STORE.get(frame_id)
