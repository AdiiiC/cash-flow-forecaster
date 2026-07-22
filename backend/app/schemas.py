"""Typed contracts for every API boundary and internal model I/O.

These schemas are the anti-slop backbone: nothing enters the forecasting
engine or leaves the LLM without passing through a validated shape.
"""
from __future__ import annotations

from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, Field, field_validator


# Currencies the app can label and format. Amounts are always expressed in the
# selected currency (no FX conversion is performed).
SUPPORTED_CURRENCIES = {"USD", "INR"}


class Direction(str, Enum):
    inflow = "inflow"
    outflow = "outflow"


class EntryStatus(str, Enum):
    paid = "paid"
    outstanding = "outstanding"


class Cadence(str, Enum):
    weekly = "weekly"
    biweekly = "biweekly"
    monthly = "monthly"
    quarterly = "quarterly"


class LedgerEntry(BaseModel):
    """A single point-in-time cash event."""

    date: date
    amount: float = Field(..., gt=0, description="Positive magnitude of the transaction.")
    direction: Direction
    category: str = "uncategorized"
    customer_id: str | None = None
    status: EntryStatus = EntryStatus.paid

    @field_validator("category")
    @classmethod
    def _normalize_category(cls, v: str) -> str:
        v = v.strip().lower().replace(" ", "_")
        return v or "uncategorized"


class Ledger(BaseModel):
    opening_balance: float = 0.0
    currency: str = "USD"
    entries: list[LedgerEntry]

    @field_validator("entries")
    @classmethod
    def _non_empty(cls, v: list[LedgerEntry]) -> list[LedgerEntry]:
        if not v:
            raise ValueError("Ledger must contain at least one entry.")
        return v


class HistoryPoint(BaseModel):
    period: date  # week-ending Sunday
    value: float


class ForecastPoint(BaseModel):
    period: date
    p10: float
    p50: float
    p90: float


class BacktestMetrics(BaseModel):
    """Uncertainty-aware scorecard. MASE < 1 beats the seasonal-naive baseline."""

    mase: float
    pinball: float
    coverage_85: float  # empirical share of actuals inside the p7.5..p92.5 band (85% nominal)
    n_origins: int


class SeriesForecast(BaseModel):
    name: str  # net_cash_flow | inflow | outflow | mrr
    label: str
    unit: str = "USD"
    model: str  # selected model id
    candidates: dict[str, float]  # model id -> backtest MASE (transparency)
    metrics: BacktestMetrics
    history: list[HistoryPoint]
    forecast: list[ForecastPoint]


class Narrative(BaseModel):
    text: str
    source: str  # "gemini" | "openai" | "anthropic" | "template"
    model: str | None = None  # concrete model that produced the text, if any
    grounded: bool
    used_values: dict[str, float]


class CategoryFlow(BaseModel):
    """Historical + projected contribution of a single ledger category."""

    category: str
    direction: Direction
    hist_weekly_mean: float  # average weekly signed magnitude over history
    hist_total: float  # total over the full history window
    share: float  # 0..1 share of its direction's gross flow
    projected_total: float  # projected contribution over the forecast horizon
    volatility: float  # std of weekly magnitude (dispersion of the driver)


class Driver(BaseModel):
    """An exact contribution decomposition of net cash flow (no fitted model).

    ``impact`` is signed (inflows positive, outflows negative). ``volatility``
    quantifies how much week-to-week noise this category injects — the honest
    analog of a feature importance, derived directly from the ledger.
    """

    category: str
    direction: Direction
    impact: float  # signed mean weekly contribution to net cash flow
    share_of_net_abs: float  # 0..1 share of total absolute weekly flow
    volatility: float


class IntervalCalibration(BaseModel):
    """How well the P7.5–P92.5 bands actually cover out-of-sample actuals."""

    target: float = 0.85  # nominal coverage of the P7.5..P92.5 interval (85%)
    empirical: float  # measured coverage across series (mean)
    conformal: bool = True  # finite-sample conformal correction applied
    per_series: dict[str, float] = Field(default_factory=dict)


class Alert(BaseModel):
    level: str  # "critical" | "warning" | "info"
    code: str  # machine code, e.g. "runway", "balance_floor", "net_negative"
    message: str
    value: float | None = None
    threshold: float | None = None


class ScenarioInput(BaseModel):
    """Deterministic what-if overlay applied to the point forecast.

    This is NOT re-estimated through the backtest — it is a transparent,
    labeled transformation of the baseline projection so planning is instant.
    """

    label: str = "Scenario"
    # Multiply every forecast inflow by (1 + revenue_growth_pct/100), compounding weekly.
    revenue_growth_pct: float = 0.0
    # Scale all outflows (e.g. cost cut / expansion). 1.0 = unchanged.
    cost_multiplier: float = Field(1.0, gt=0)
    # A single one-off cash event.
    one_off_amount: float = 0.0
    one_off_direction: Direction = Direction.inflow
    one_off_week: int = Field(1, ge=1)

    @field_validator("cost_multiplier")
    @classmethod
    def _reasonable_multiplier(cls, v: float) -> float:
        if v > 10:
            raise ValueError("cost_multiplier must be <= 10.")
        return v


class ScenarioResult(BaseModel):
    label: str
    series: list[SeriesForecast]  # scenario-adjusted forecasts (point + band shifted)
    projected_balance_p50: float
    runway_weeks: float | None
    delta_projected_balance: float  # scenario minus baseline
    delta_net_total: float


class RecurringItemInput(BaseModel):
    """A known, repeating cash event the user schedules (payroll, rent, SaaS)."""

    name: str = Field(..., min_length=1, max_length=120)
    amount: float = Field(..., gt=0)
    direction: Direction
    cadence: Cadence
    anchor_date: date  # the next (or first) occurrence date
    category: str | None = Field(default=None, max_length=60)
    active: bool = True

    @field_validator("name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name must not be blank.")
        return v

    @field_validator("category")
    @classmethod
    def _strip_category(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None


class RecurringItem(RecurringItemInput):
    id: str
    created_at: datetime


class RecurringImpact(BaseModel):
    """Summary of how scheduled items shifted the forecast (UI transparency)."""

    count: int
    inflow_total: float  # total scheduled inflows landing within the horizon
    outflow_total: float  # total scheduled outflows within the horizon
    net_total: float  # inflow_total - outflow_total


class InvoiceKind(str, Enum):
    receivable = "receivable"  # money you're owed (AR) -> expected inflow
    payable = "payable"  # money you owe (AP) -> expected outflow


class InvoiceStatus(str, Enum):
    open = "open"
    paid = "paid"
    void = "void"


class InvoiceInput(BaseModel):
    """A single expected cash event tied to a counterparty and a due date."""

    kind: InvoiceKind
    counterparty: str = Field(..., min_length=1, max_length=120)
    amount: float = Field(..., gt=0)
    issue_date: date
    due_date: date
    category: str | None = Field(default=None, max_length=60)
    status: InvoiceStatus = InvoiceStatus.open

    @field_validator("counterparty")
    @classmethod
    def _strip_counterparty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("counterparty must not be blank.")
        return v

    @field_validator("category")
    @classmethod
    def _strip_inv_category(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None

    @field_validator("due_date")
    @classmethod
    def _due_after_issue(cls, v: date, info) -> date:
        issue = info.data.get("issue_date")
        if issue is not None and v < issue:
            raise ValueError("due_date must be on or after issue_date.")
        return v


class Invoice(InvoiceInput):
    id: str
    created_at: datetime
    overdue: bool = False  # derived: open and past its due date


class InvoiceImpact(BaseModel):
    """Summary of open AR/AP folded into the forecast (UI transparency)."""

    count: int  # open invoices/bills contributing within the horizon
    overdue_count: int  # of those, how many are past due
    expected_inflow: float  # open receivables total within horizon
    expected_outflow: float  # open payables total within horizon
    net_total: float  # expected_inflow - expected_outflow


# ── ExIm — Export/Import foreign-currency invoices ─────────────────────────

# Common currency codes accepted by frankfurter.app / ECB feed.
SUPPORTED_FCY_CODES = {
    "USD", "EUR", "GBP", "JPY", "AED", "SGD", "AUD",
    "CAD", "CHF", "CNY", "HKD", "NZD", "SEK", "NOK",
}


class ExImInvoiceInput(BaseModel):
    """A single cross-border trade receivable or payable."""

    kind: InvoiceKind            # receivable = export inflow; payable = import outflow
    counterparty: str = Field(..., min_length=1, max_length=120)
    fcy_code: str = Field(..., min_length=3, max_length=8)   # foreign currency
    fcy_amount: float = Field(..., gt=0)                      # amount in foreign currency
    base_currency: str = Field("INR", min_length=3, max_length=8)  # your reporting currency
    payment_terms_days: int = Field(..., ge=1, le=3650)
    issue_date: date
    category: str | None = Field(default=None, max_length=60)
    notes: str | None = Field(default=None, max_length=500)

    @field_validator("counterparty")
    @classmethod
    def _strip_cp(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("counterparty must not be blank.")
        return v

    @field_validator("fcy_code", "base_currency")
    @classmethod
    def _upper_code(cls, v: str) -> str:
        return v.strip().upper()


class ExImInvoice(ExImInvoiceInput):
    id: str
    created_at: datetime
    due_date: date              # issue_date + payment_terms_days
    spot_rate: float            # rate on creation day
    predicted_rate_p50: float
    predicted_rate_p10: float
    predicted_rate_p90: float
    base_amount_p50: float      # fcy_amount * predicted_rate_p50
    base_amount_p10: float
    base_amount_p90: float
    rate_model: str
    predicted_at: date
    status: InvoiceStatus
    overdue: bool = False


class ExImImpact(BaseModel):
    """Summary of open ExIm invoices (for dashboard transparency)."""

    count: int
    expected_inflow_p50: float   # export receivables in base currency (p50)
    expected_outflow_p50: float  # import payables in base currency (p50)
    net_p50: float


class Thresholds(BaseModel):
    min_balance: float | None = None  # alert if projected balance dips below this
    min_runway_weeks: float | None = None  # alert if runway shorter than this


class Recommendation(BaseModel):
    """A deterministic, plain-English next step derived from the numbers."""

    kind: str  # "cut" | "afford" | "info"
    message: str
    value: float | None = None  # the underlying figure (monthly), if any


class RunwayInsight(BaseModel):
    """Businessman-facing runway summary: how long, until when, and what to do."""

    runway_weeks: float | None
    runway_months: float | None
    runway_date: date | None  # projected date the cash balance hits zero (p50)
    solvent: bool  # true when cash never goes negative over the horizon
    recommendations: list[Recommendation] = Field(default_factory=list)


class ForecastResponse(BaseModel):
    generated_at: datetime
    as_of: date
    horizon_weeks: int
    currency: str
    opening_balance: float
    runway_weeks: float | None  # weeks until projected cash balance < 0 (p50), null if solvent
    projected_balance_p50: float
    series: list[SeriesForecast]
    narrative: Narrative
    cached: bool = False  # true when the expensive base forecast was served from cache
    categories: list[CategoryFlow] = Field(default_factory=list)
    drivers: list[Driver] = Field(default_factory=list)
    calibration: IntervalCalibration | None = None
    alerts: list[Alert] = Field(default_factory=list)
    scenario: ScenarioResult | None = None
    insight: RunwayInsight | None = None
    recurring: RecurringImpact | None = None  # scheduled items folded into the projection
    receivables: InvoiceImpact | None = None  # open AR/AP folded into the projection


class RunSummary(BaseModel):
    """A lightweight record of a past forecast run (for the history sidebar)."""

    id: str
    created_at: datetime
    source: str  # "demo" | "upload"
    currency: str
    horizon_weeks: int
    opening_balance: float
    projected_balance_p50: float
    runway_weeks: float | None
    label: str


class FxRates(BaseModel):
    base: str = "USD"
    rates: dict[str, float]  # code -> units of code per 1 base
    as_of: date
    fetched_at: datetime | None = None  # UTC timestamp of live fetch


class UserCreate(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Enter a valid email address.")
        return v


class UserLogin(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class UserPublic(BaseModel):
    id: str
    email: str
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class ScenarioCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    scenario: ScenarioInput

    @field_validator("name")
    @classmethod
    def _clean_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Give the scenario a name.")
        return v


class SavedScenario(BaseModel):
    id: str
    name: str
    scenario: ScenarioInput
    created_at: datetime


class SyntheticRequest(BaseModel):
    weeks: int = Field(104, ge=26, le=520)
    seed: int = 42
    starting_mrr: float = Field(80_000.0, gt=0)
    opening_balance: float = Field(250_000.0)
    currency: str = "USD"
    thresholds: Thresholds | None = None
    scenario: ScenarioInput | None = None

    @field_validator("currency")
    @classmethod
    def _supported_currency(cls, v: str) -> str:
        code = v.upper().strip()
        if code not in SUPPORTED_CURRENCIES:
            raise ValueError(
                f"Unsupported currency '{v}'. Supported: {', '.join(sorted(SUPPORTED_CURRENCIES))}."
            )
        return code
