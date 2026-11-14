import io
import numpy as np
from PIL import Image
from app.science.difference import (
    render_science_frame,
    render_difference_frame,
    compute_difference,
    compute_significance,
    render_significance_frame,
)


def test_difference_arithmetic():
    a = np.ones((50, 50), dtype=np.float32) * 10.0
    b = np.ones((50, 50), dtype=np.float32) * 25.0
    # Add a moving source in b
    b[25, 25] = 100.0

    diff, valid = compute_difference(a, b)
    assert diff.shape == (50, 50)
    assert np.all(valid)
    assert np.isclose(diff[0, 0], 15.0)
    assert np.isclose(diff[25, 25], 90.0)


def test_difference_color_rendering():
    # Test negative (loss), zero, and positive (gain)
    test_arr = np.array([[-100.0, 0.0, 100.0]], dtype=np.float32)
    png_bytes = render_difference_frame(test_arr, is_calibrated=True)
    img = Image.open(io.BytesIO(png_bytes))
    rgb = np.array(img)

    # Pixel 0: negative -> violet tint (Blue > Red)
    assert rgb[0, 0, 2] > rgb[0, 0, 0]

    # Pixel 1: zero -> dark neutral
    assert np.all(rgb[0, 1] == [8, 14, 24])

    # Pixel 2: positive -> amber tint (Red > Blue)
    assert rgb[0, 2, 0] > rgb[0, 2, 2]


def test_science_frame_rendering():
    arr = np.linspace(0, 100, 384 * 384, dtype=np.float32).reshape((384, 384))
    png_bytes = render_science_frame(arr, is_calibrated=True)
    img = Image.open(io.BytesIO(png_bytes))
    assert img.size == (384, 384)
    assert img.format == "PNG"


def test_significance_propagation():
    a = np.ones((10, 10), dtype=np.float32) * 5.0
    b = np.ones((10, 10), dtype=np.float32) * 15.0
    var_a = np.full((10, 10), 4.0, dtype=np.float32)   # sigma_a = 2
    var_b = np.full((10, 10), 12.0, dtype=np.float32)  # sigma_b = sqrt(12)
    # Total variance = 16 -> sigma_D = 4
    # Difference = 10 -> Significance = 10 / 4 = 2.5 sigma

    sig, valid, var_d = compute_significance(a, b, var_a, var_b)
    assert sig.shape == (10, 10)
    assert np.all(valid)
    assert np.allclose(var_d, 16.0)
    assert np.allclose(sig, 2.5)


def test_significance_color_rendering():
    # Negative (-5 sigma), zero, positive (+5 sigma)
    sig_arr = np.array([[-5.0, 0.0, 5.0]], dtype=np.float32)
    png_bytes = render_significance_frame(sig_arr)
    img = Image.open(io.BytesIO(png_bytes))
    rgb = np.array(img)

    # Pixel 0: negative detection (-5 sigma) -> violet tint (Blue > Red)
    assert rgb[0, 0, 2] > rgb[0, 0, 0]

    # Pixel 1: zero -> dark neutral
    assert np.all(rgb[0, 1] == [8, 14, 24])

    # Pixel 2: positive detection (+5 sigma) -> amber tint (Red > Blue)
    assert rgb[0, 2, 0] > rgb[0, 2, 2]
