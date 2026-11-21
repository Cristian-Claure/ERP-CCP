from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

Frequency = Literal["daily", "weekly", "monthly"]
ConfidenceLevel = Literal["low", "medium", "high"]


class DemandPoint(BaseModel):
    period: date = Field(description="Start date of the period (day, week or month).")
    quantity: float = Field(ge=0, description="Units sold in the period.")


class ProductSeries(BaseModel):
    product_id: str = Field(min_length=1, max_length=64)
    history: list[DemandPoint] = Field(min_length=1, max_length=1000)

    @field_validator("product_id", mode="before")
    @classmethod
    def _coerce_id(cls, value: object) -> object:
        return str(value) if isinstance(value, int) else value

    @field_validator("history")
    @classmethod
    def _sort_history(cls, history: list[DemandPoint]) -> list[DemandPoint]:
        return sorted(history, key=lambda point: point.period)


class DemandForecastRequest(BaseModel):
    frequency: Frequency = "monthly"
    horizon: int = Field(default=3, ge=1, le=52, description="Number of future periods.")
    window: int = Field(default=3, ge=1, le=24, description="Moving average window.")
    series: list[ProductSeries] = Field(min_length=1, max_length=500)


class ForecastPoint(BaseModel):
    period: date
    quantity: float = Field(ge=0)


class ProductForecast(BaseModel):
    product_id: str
    forecast: list[ForecastPoint]
    confidence: float = Field(ge=0, le=1, description="0..1, higher is more reliable.")
    confidence_level: ConfidenceLevel


class DemandForecastResponse(BaseModel):
    model: str
    generated_at: datetime
    forecasts: list[ProductForecast]
