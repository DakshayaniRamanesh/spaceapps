"""Scientifically validated image differencing and display stretching."""
from __future__ import annotations

import io
import numpy as np
from PIL import Image


def png_from_array(rgb: np.ndarray) -> bytes:
    """Encode an RGB uint8 array into PNG bytes."""
    buffer = io.BytesIO()
    Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def render_science_frame(
    arr: np.ndarray,
    mask: np.ndarray | None = None,
    is_calibrated: bool = True,
) -> bytes:
    """
    Render a float32 science array to 24-bit PNG with an astronomical arcsinh stretch.
    
    Preserves floating-point photometric measurements while rendering subtle background
    features and bright point sources without blowing out dynamic range.
    """
    arr = np.nan_to_num(arr, nan=0.0, posinf=0.0, neginf=0.0)

    if not is_calibrated:
        # Synthetic simulation stretch
        v = np.clip(np.arcsinh(np.maximum(arr - 15, 0) / 12) / np.arcsinh(1500 / 12), 0, 1)
    else:
        # SPHEREx calibrated MJy/sr stretch
        # Use robust percentiles from valid positive pixels
        valid = arr[arr > 0]
        if len(valid) > 100:
            p2 = float(np.percentile(valid, 2))
            p99 = float(np.percentile(valid, 99))
            span = max(p99 - p2, 0.5)
            # Soft arcsinh stretch above local baseline
            v = np.clip(np.arcsinh(np.maximum(arr - p2, 0) / (0.05 * span)) / np.arcsinh(span / (0.05 * span)), 0, 1)
        else:
            v = np.clip(np.arcsinh(np.maximum(arr, 0) / 2.0) / np.arcsinh(100.0 / 2.0), 0, 1)

    if mask is not None:
        v = np.where(mask, v, 0.0)

    # SkyTrace blue-tinted cool monochrome palette: [v*0.88, v*0.95, v] * 255
    rgb = np.stack([v * 0.88, v * 0.95, v], axis=-1) * 255
    return png_from_array(rgb)


def compute_difference(
    a: np.ndarray,
    b: np.ndarray,
    valid_a: np.ndarray | None = None,
    valid_b: np.ndarray | None = None,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Compute calibrated difference D = B - A and composite validity mask.
    
    valid = valid_a & valid_b & isfinite(a) & isfinite(b)
    """
    diff = b.astype(np.float32) - a.astype(np.float32)
    diff = np.nan_to_num(diff, nan=0.0, posinf=0.0, neginf=0.0)

    if valid_a is not None and valid_b is not None:
        valid_both = valid_a & valid_b & np.isfinite(a) & np.isfinite(b)
    elif valid_a is not None:
        valid_both = valid_a & np.isfinite(a) & np.isfinite(b)
    elif valid_b is not None:
        valid_both = valid_b & np.isfinite(a) & np.isfinite(b)
    else:
        valid_both = np.isfinite(a) & np.isfinite(b)

    # Invalidate regions outside common footprint
    masked_diff = np.where(valid_both, diff, 0.0)
    return masked_diff, valid_both


def render_difference_frame(
    diff: np.ndarray,
    valid_mask: np.ndarray | None = None,
    is_calibrated: bool = True,
) -> bytes:
    """
    Render signed difference D = B - A to PNG.
    Positive (flux gain in B): Amber [245, 199, 125]
    Negative (flux loss in B): Violet [147, 135, 245]
    Zero / Invalid footprint: Dark neutral [8, 14, 24]
    """
    diff = np.nan_to_num(diff, nan=0.0, posinf=0.0, neginf=0.0)
    scale = 2.0 if is_calibrated else 8.0
    sat = 50.0 if is_calibrated else 1000.0

    strength = np.clip(np.arcsinh(np.abs(diff) / scale) / np.arcsinh(sat / scale), 0, 1)[..., None]
    if valid_mask is not None:
        strength = np.where(valid_mask[..., None], strength, 0.0)

    negative = np.array([147, 135, 245], dtype=np.float32)
    positive = np.array([245, 199, 125], dtype=np.float32)
    zero = np.array([8, 14, 24], dtype=np.float32)

    color = np.where((diff >= 0)[..., None], positive, negative)
    rgb = zero + strength * (color - zero)
    return png_from_array(rgb)


def compute_significance(
    a: np.ndarray,
    b: np.ndarray,
    var_a: np.ndarray,
    var_b: np.ndarray,
    valid_a: np.ndarray | None = None,
    valid_b: np.ndarray | None = None,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Compute propagated variance and statistical significance image:
    
    V_D = V_A + V_B (assuming independent errors)
    S = (B - A) / sqrt(V_D)
    
    Returns:
        (significance_s, valid_mask, propagated_var)
    """
    diff = b.astype(np.float32) - a.astype(np.float32)
    diff = np.nan_to_num(diff, nan=0.0, posinf=0.0, neginf=0.0)

    var_d = var_a.astype(np.float32) + var_b.astype(np.float32)
    var_d = np.nan_to_num(var_d, nan=0.0, posinf=0.0, neginf=0.0)

    if valid_a is not None and valid_b is not None:
        valid_both = valid_a & valid_b & np.isfinite(a) & np.isfinite(b) & (var_d > 1e-9)
    elif valid_a is not None:
        valid_both = valid_a & np.isfinite(a) & np.isfinite(b) & (var_d > 1e-9)
    elif valid_b is not None:
        valid_both = valid_b & np.isfinite(a) & np.isfinite(b) & (var_d > 1e-9)
    else:
        valid_both = np.isfinite(a) & np.isfinite(b) & (var_d > 1e-9)

    sigma_d = np.sqrt(np.maximum(var_d, 1e-9))
    sig = np.where(valid_both, diff / sigma_d, 0.0).astype(np.float32)
    sig = np.nan_to_num(sig, nan=0.0, posinf=0.0, neginf=0.0)

    return sig, valid_both, var_d


def render_significance_frame(
    sig: np.ndarray,
    valid_mask: np.ndarray | None = None,
    sigma_scale: float = 3.0,
    sigma_max: float = 8.0,
) -> bytes:
    """
    Render statistical significance S = (B - A) / sigma to PNG.
    S > 0 (brightening / positive detection): Amber [245, 199, 125]
    S < 0 (fading / negative detection): Violet [147, 135, 245]
    Zero / Invalid footprint: Dark neutral [8, 14, 24]
    """
    sig = np.nan_to_num(sig, nan=0.0, posinf=0.0, neginf=0.0)
    abs_sig = np.abs(sig)

    # Soft arcsinh stretch calibrated to standard normal standard deviations
    strength = np.clip(
        np.arcsinh(abs_sig / sigma_scale) / np.arcsinh(sigma_max / sigma_scale),
        0.0,
        1.0,
    )[..., None]

    if valid_mask is not None:
        strength = np.where(valid_mask[..., None], strength, 0.0)

    negative = np.array([147, 135, 245], dtype=np.float32)
    positive = np.array([245, 199, 125], dtype=np.float32)
    zero = np.array([8, 14, 24], dtype=np.float32)

    color = np.where((sig >= 0)[..., None], positive, negative)
    rgb = zero + strength * (color - zero)
    return png_from_array(rgb)
