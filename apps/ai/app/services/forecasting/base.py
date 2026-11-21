from datetime import date, timedelta
from typing import Protocol

from app.schemas.forecast import (
    ConfidenceLevel,
    DemandForecastRequest,
    Frequency,
    ProductForecast,
    ProductSeries,
)


class ForecastModel(Protocol):
    """Contract every forecasting model implements."""

    name: str

    def forecast(self, series: ProductSeries, request: DemandForecastRequest) -> ProductForecast:
        """Return `request.horizon` future points for one product."""
        ...


def next_period(current: date, frequency: Frequency) -> date:
    if frequency == "daily":
        return current + timedelta(days=1)
    if frequency == "weekly":
        return current + timedelta(weeks=1)
    year, month = (
        (current.year + 1, 1) if current.month == 12 else (current.year, current.month + 1)
    )
    return current.replace(year=year, month=month, day=1)


def confidence_level(confidence: float) -> ConfidenceLevel:
    if confidence >= 0.7:
        return "high"
    if confidence >= 0.4:
        return "medium"
    return "low"
