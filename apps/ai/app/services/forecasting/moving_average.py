from statistics import fmean, pstdev

from app.schemas.forecast import (
    DemandForecastRequest,
    ForecastPoint,
    ProductForecast,
    ProductSeries,
)
from app.services.forecasting.base import confidence_level, next_period


class MovingAverageModel:
    """Baseline: flat forecast equal to the mean of the last `window` periods.

    Confidence combines stability (1 - coefficient of variation over the window)
    and data sufficiency (history length relative to 2x the window).
    """

    name = "moving_average"

    def forecast(self, series: ProductSeries, request: DemandForecastRequest) -> ProductForecast:
        quantities = [point.quantity for point in series.history]
        recent = quantities[-request.window :]
        level = fmean(recent)

        points: list[ForecastPoint] = []
        period = series.history[-1].period
        for _ in range(request.horizon):
            period = next_period(period, request.frequency)
            points.append(ForecastPoint(period=period, quantity=round(level, 4)))

        confidence = self._confidence(recent, len(quantities), request.window)

        return ProductForecast(
            product_id=series.product_id,
            forecast=points,
            confidence=confidence,
            confidence_level=confidence_level(confidence),
        )

    @staticmethod
    def _confidence(recent: list[float], history_length: int, window: int) -> float:
        mean = fmean(recent)
        if mean == 0:
            stability = 1.0 if all(q == 0 for q in recent) else 0.0
        else:
            stability = max(0.0, 1.0 - pstdev(recent) / mean)
        sufficiency = min(1.0, history_length / (2 * window))
        return round(stability * sufficiency, 4)
