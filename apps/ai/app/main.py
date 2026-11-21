from fastapi import FastAPI

from app.api.routes import forecast, health, system
from app.core.config import Settings, get_settings
from app.core.security import ServiceTokenMiddleware


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    app = FastAPI(
        title="CCP AI Service",
        version="0.1.0",
        docs_url="/docs" if settings.docs_enabled else None,
        redoc_url=None,
        openapi_url="/openapi.json" if settings.docs_enabled else None,
    )
    app.add_middleware(ServiceTokenMiddleware, settings=settings)

    app.include_router(health.router)
    app.include_router(system.router, prefix="/v1")
    app.include_router(forecast.router, prefix="/v1")

    return app


app = create_app()
