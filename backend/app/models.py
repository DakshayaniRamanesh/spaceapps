from typing import Literal
from pydantic import BaseModel, Field, ConfigDict, model_validator
from datetime import date
from astropy.time import Time

Detector = Literal['D1', 'D2', 'D3', 'D4', 'D5', 'D6']
Source = Literal['synthetic', 'spherex-irsa']

class FieldRequest(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False, frozen=True, strict=True, extra='forbid')
    ra: float = Field(ge=0, lt=360)
    dec: float = Field(ge=-90, le=90)
    fov_arcmin: float = Field(default=12, ge=2, le=60)
    detector: Detector = 'D1'
    min_wavelength_um: float | None = Field(default=None, gt=0)
    max_wavelength_um: float | None = Field(default=None, gt=0)
    limit: int = Field(default=12, ge=2, le=50)
    spread: bool = False
    start_date: str | None = None
    end_date: str | None = None

    @model_validator(mode='after')
    def selection_bounds(self):
        if self.min_wavelength_um is not None and self.max_wavelength_um is not None and self.min_wavelength_um > self.max_wavelength_um:
            raise ValueError('Minimum wavelength must not exceed maximum wavelength')
        for value in (self.start_date, self.end_date):
            if value is not None and (len(value) != 10 or date.fromisoformat(value).isoformat() != value):
                raise ValueError('Dates must be valid ISO dates (YYYY-MM-DD)')
        if self.start_date and self.end_date and self.start_date >= self.end_date:
            raise ValueError('Start date must be before end date')
        return self

    @property
    def start_mjd(self):
        return float(Time(self.start_date).mjd) if self.start_date else None

    @property
    def end_mjd(self):
        return float(Time(self.end_date).mjd)+1 if self.end_date else None


class EpochSelection(BaseModel):
    limit: int = 12
    spread: bool = False
    start_mjd: float | None = None
    end_mjd: float | None = None

class Quality(BaseModel):
    flags: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)
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
    product_id: str | None = None
    provenance_url: str | None = None
    wavelength_um: float | None = None
    wavelength_source: str | None = None

    @model_validator(mode='after')
    def real_provenance(self):
        if self.source == 'spherex-irsa' and not all((self.obs_id, self.collection, self.access_url, self.sha256)):
            # Read compatibility for the original provider's spx records; production
            # irsa manifests still require the complete checksum/provenance contract.
            if not (self.id.startswith('spx.') and self.product_id and self.provenance_url):
                raise ValueError('Real observations require archive provenance')
            note = 'Legacy preview record; original FITS checksum was not supplied.'
            if note not in self.quality.notes:
                self.quality.notes.append(note)
        self.product_id = self.product_id or self.obs_id
        self.provenance_url = self.provenance_url or self.access_url
        self.wavelength_um = self.lambda_um if self.lambda_um is not None else self.wavelength_um
        self.lambda_um = self.wavelength_um
        self.wavelength_source = 'wcs-wave' if self.lambda_um is not None else self.wavelength_source
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
    release: str | None = None
    total_candidates: int | None = None
    epoch_selection: EpochSelection | None = None
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
