from app.services.forecasting.base import ForecastModel
from app.services.forecasting.moving_average import MovingAverageModel


def get_forecast_model() -> ForecastModel:
    """Dependency provider: swap here for a real model (Prophet, LightGBM, ...)."""
    return MovingAverageModel()


__all__ = ["ForecastModel", "MovingAverageModel", "get_forecast_model"]
