from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["system"])


class PingResponse(BaseModel):
    status: Literal["ok"]


@router.get("/ping", response_model=PingResponse)
async def ping() -> PingResponse:
    """Authenticated probe used by Laravel's /api/v1/health to validate the shared token."""
    return PingResponse(status="ok")
