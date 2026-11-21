import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.core.config import Settings
from app.main import create_app

TOKEN = "test-token"


@pytest.fixture
def client() -> TestClient:
    app = create_app(Settings(service_token=SecretStr(TOKEN), docs_enabled=False))
    return TestClient(app)


@pytest.fixture
def auth_headers() -> dict[str, str]:
    return {"X-Service-Token": TOKEN}
