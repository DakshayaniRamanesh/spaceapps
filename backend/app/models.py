from typing import Literal
from pydantic import BaseModel, Field, ConfigDict, model_validator

Detector = Literal['D1', 'D2', 'D3', 'D4', 'D5', 'D6']
Source = Literal['synthetic', 'spherex-irsa']

class FieldRequest(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False, frozen=True, strict=True, extra='forbid')
    ra: float = Field(ge=0, lt=360)
    dec: float = Field(ge=-90, le=90)
    fov_arcmin: float = Field(default=12, ge=2, le=60)
    detector: Detector = 'D1'

class Quality(BaseModel):
    registration: str = 'Common synthetic tangent-plane grid'
    noise_sigma: float = 2.5
    masked_fraction: float = 0.0
    calibrated: bool = False
    valid_fraction: float | None = None
    flag_counts: dict[str, int] = Field(default_factory=dict)
    flag_policy: str | None = None
    background_mjy_sr: float | None = None
    center_valid: bool | None = None
    center_region_valid_fraction: float | None = None

class Frame(BaseModel):
    id: str
    timestamp: str
    image_url: str
    detector: Detector
    source: Source = 'synthetic'
    quality: Quality = Field(default_factory=Quality)
    obs_id: str | None = None
    collection: str | None = None
    access_url: str | None = None
    cutout_url: str | None = None
    sha256: str | None = None
    product_version: str | None = None
    downloaded_at: str | None = None
    lambda_um: float | None = None
    bandwidth_um: float | None = None
    wavelength_origin: str | None = None

    @model_validator(mode='after')
    def real_provenance(self):
        if self.source == 'spherex-irsa' and not all((self.obs_id, self.collection, self.access_url, self.sha256)):
            raise ValueError('Real observations require archive provenance')
        return self

class Check(BaseModel):
    name: str
    status: Literal['pass', 'review', 'blocked']
    reason: str
    value: float | None = None

class Pair(BaseModel):
    a: str
    b: str
    comparison_status: Literal['comparable', 'preview', 'blocked']
    difference_allowed: bool = False
    reason: str
    checks: list[Check] = Field(default_factory=list)
    spectral_overlap_fraction: float | None = None
    overlap_fraction: float | None = None

class ObservationSet(BaseModel):
    schema_version: int = 2
    source_type: Source = 'synthetic'
    dataset_id: str
    request: FieldRequest
    coordinate_system: str = 'ICRS field center; illustrative local tangent offsets'
    width: int = 384
    height: int = 384
    intensity_unit: str = 'arbitrary simulation units'
    wavelength_range_um: tuple[float, float]
    wavelength_model: str = 'Illustrative array-dependent response; no per-pixel wavelength calibration'
    frames: list[Frame]
    notice: str = 'Synthetic observations. Motion, variability, dates and noise are illustrative, not measurements of the named target.'
    pairs: list[Pair] = Field(default_factory=list)
    availability: Literal['no_coverage', 'single_epoch', 'preview', 'comparable', 'search_incomplete'] = 'preview'
    search_complete: bool = True
    archive_records: int = 0
    assessed_records: int = 0
    processing_version: str = 'synthetic-v1'
    created_at: str | None = None
    display_stretch: dict[str, float] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)
    grid: dict = Field(default_factory=dict)

class Job(BaseModel):
    job_id: str
    status: Literal['queued', 'running', 'ready', 'failed']
    stage: str
    request: FieldRequest
    dataset_id: str | None = None
    result_url: str | None = None
    error_code: str | None = None
    message: str | None = None
    cache_hit: bool = False
