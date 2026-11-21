from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends

from app.schemas.forecast import DemandForecastRequest, DemandForecastResponse
from app.services.forecasting import ForecastModel, get_forecast_model

router = APIRouter(prefix="/forecast", tags=["forecast"])


@router.post("/demand", response_model=DemandForecastResponse)
async def forecast_demand(
    payload: DemandForecastRequest,
    model: Annotated[ForecastModel, Depends(get_forecast_model)],
) -> DemandForecastResponse:
    return DemandForecastResponse(
        model=model.name,
        generated_at=datetime.now(UTC),
        forecasts=[model.forecast(series, payload) for series in payload.series],
    )
