from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.schemas.forecast import DemandForecastRequest, ProductSeries
from app.services.forecasting import MovingAverageModel
from app.services.forecasting.base import next_period


def _payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "frequency": "monthly",
        "horizon": 2,
        "window": 3,
        "series": [
            {
                "product_id": 101,
                "history": [
                    {"period": "2026-08-01", "quantity": 10},
                    {"period": "2026-06-01", "quantity": 10},
                    {"period": "2026-07-01", "quantity": 10},
                    {"period": "2026-09-01", "quantity": 13},
                    {"period": "2026-10-01", "quantity": 7},
                ],
            }
        ],
    }
    payload.update(overrides)
    return payload


def test_forecast_requires_token(client: TestClient) -> None:
    assert client.post("/v1/forecast/demand", json=_payload()).status_code == 401


def test_forecast_returns_moving_average(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.post("/v1/forecast/demand", json=_payload(), headers=auth_headers)

    assert response.status_code == 200
    body = response.json()
    assert body["model"] == "moving_average"

    forecast = body["forecasts"][0]
    assert forecast["product_id"] == "101"
    # History is sorted; last 3 periods: Aug=10, Sep=13, Oct=7 -> mean 10.
    assert forecast["forecast"] == [
        {"period": "2026-11-01", "quantity": 10.0},
        {"period": "2026-12-01", "quantity": 10.0},
    ]
    assert 0 <= forecast["confidence"] <= 1
    assert forecast["confidence_level"] in {"low", "medium", "high"}


def test_forecast_validates_payload(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.post(
        "/v1/forecast/demand",
        json=_payload(horizon=0, series=[]),
        headers=auth_headers,
    )

    assert response.status_code == 422


def test_stable_series_has_high_confidence() -> None:
    request = DemandForecastRequest(
        horizon=1,
        window=3,
        series=[
            ProductSeries(
                product_id="A",
                history=[{"period": date(2026, m, 1), "quantity": 20} for m in range(1, 7)],
            )
        ],
    )

    result = MovingAverageModel().forecast(request.series[0], request)

    assert result.confidence == 1.0
    assert result.confidence_level == "high"


def test_short_volatile_series_has_low_confidence() -> None:
    request = DemandForecastRequest(
        horizon=1,
        window=3,
        series=[
            ProductSeries(
                product_id="B",
                history=[
                    {"period": date(2026, 1, 1), "quantity": 1},
                    {"period": date(2026, 2, 1), "quantity": 30},
                ],
            )
        ],
    )

    result = MovingAverageModel().forecast(request.series[0], request)

    assert result.confidence_level == "low"


@pytest.mark.parametrize(
    ("current", "frequency", "expected"),
    [
        (date(2026, 1, 31), "daily", date(2026, 2, 1)),
        (date(2026, 1, 1), "weekly", date(2026, 1, 8)),
        (date(2026, 12, 1), "monthly", date(2027, 1, 1)),
        (date(2026, 1, 31), "monthly", date(2026, 2, 1)),
    ],
)
def test_next_period(current: date, frequency: str, expected: date) -> None:
    assert next_period(current, frequency) == expected  # type: ignore[arg-type]
