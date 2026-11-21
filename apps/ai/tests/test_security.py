from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.core.config import Settings
from app.main import create_app


def test_health_is_public_and_minimal(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_protected_route_requires_token(client: TestClient) -> None:
    assert client.get("/v1/ping").status_code == 401


def test_protected_route_rejects_wrong_token(client: TestClient) -> None:
    response = client.get("/v1/ping", headers={"X-Service-Token": "nope"})

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid or missing service token."}


def test_protected_route_accepts_valid_token(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    response = client.get("/v1/ping", headers=auth_headers)

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_empty_configured_token_fails_closed() -> None:
    client = TestClient(create_app(Settings(service_token=SecretStr(""))))

    assert client.get("/v1/ping", headers={"X-Service-Token": ""}).status_code == 401


def test_docs_are_disabled_by_default(client: TestClient) -> None:
    assert client.get("/openapi.json").status_code == 401


def test_docs_can_be_enabled_for_development() -> None:
    client = TestClient(create_app(Settings(service_token=SecretStr("x"), docs_enabled=True)))

    assert client.get("/openapi.json").status_code == 200
