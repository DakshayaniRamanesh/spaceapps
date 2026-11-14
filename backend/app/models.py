from typing import Literal
from pydantic import BaseModel, Field, ConfigDict

Detector = Literal['D1', 'D2', 'D3', 'D4', 'D5', 'D6']

class FieldRequest(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False, frozen=True)
    ra: float = Field(ge=0, lt=360)
    dec: float = Field(ge=-90, le=90)
    fov_arcmin: float = Field(default=12, ge=2, le=60)
    detector: Detector = 'D1'

class Quality(BaseModel):
    registration: str = 'Common synthetic tangent-plane grid'
    noise_sigma: float = 2.5
    masked_fraction: float = 0.0
    calibrated: bool = False
    flags: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)

class Frame(BaseModel):
    id: str
    timestamp: str
    image_url: str
    detector: Detector
    source: Literal['synthetic', 'spherex-irsa'] = 'synthetic'
    product_id: str | None = None
    provenance_url: str | None = None
    wavelength_um: float | None = None
    quality: Quality = Field(default_factory=Quality)

class ObservationSet(BaseModel):
    source_type: Literal['synthetic', 'spherex-irsa'] = 'synthetic'
    dataset_id: str
    request: FieldRequest
    coordinate_system: str = 'ICRS'
    width: int = 384
    height: int = 384
    intensity_unit: str = 'arbitrary simulation units'
    wavelength_range_um: tuple[float, float]
    wavelength_model: str = 'Illustrative array-dependent response; no per-pixel wavelength calibration'
    release: str | None = None
    frames: list[Frame]
    notice: str = 'Synthetic observations. Motion, variability, dates and noise are illustrative, not measurements of the named target.'
