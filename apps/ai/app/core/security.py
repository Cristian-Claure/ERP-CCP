import secrets

from fastapi import status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import Settings

SERVICE_TOKEN_HEADER = "X-Service-Token"  # noqa: S105 - header name, not a secret
PUBLIC_PATHS = frozenset({"/health"})
DOCS_PATHS = frozenset({"/docs", "/docs/oauth2-redirect", "/openapi.json", "/redoc"})


class ServiceTokenMiddleware(BaseHTTPMiddleware):
    """Rejects every request without a valid X-Service-Token (except public paths).

    An empty configured token denies everything: the service fails closed.
    """

    def __init__(self, app, settings: Settings) -> None:
        super().__init__(app)
        self._settings = settings

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if self._is_public(request.url.path):
            return await call_next(request)

        expected = self._settings.service_token.get_secret_value()
        provided = request.headers.get(SERVICE_TOKEN_HEADER, "")

        if not expected or not secrets.compare_digest(provided.encode(), expected.encode()):
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Invalid or missing service token."},
            )

        return await call_next(request)

    def _is_public(self, path: str) -> bool:
        if path in PUBLIC_PATHS:
            return True
        return self._settings.docs_enabled and path in DOCS_PATHS
