"""ARQ worker. Run with:  arq queue_app.WorkerSettings

Processes debounced channel conversations (Messenger / Instagram / widget)
off the request path so the API stays responsive under load.
"""
import logging
import uuid

from arq.connections import RedisSettings
from sqlalchemy import select

from config import settings
from database import AsyncSessionLocal
from models import ChannelIntegration
from services.ai_service import process_pending
from services.messaging_service import send_meta_message

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("worker")


async def process_session_task(ctx, session_id: str, seq: int) -> str:
    """Coalesce + answer a session, then deliver the reply to its channel."""
    redis = ctx["redis"]
    current = await redis.get(f"inbound_seq:{session_id}")
    if current is None or int(current) != int(seq):
        # A newer message arrived after this job was scheduled — let the
        # later job handle the whole batch.
        return "superseded"

    async with AsyncSessionLocal() as db:
        result = await process_pending(uuid.UUID(session_id), db)
        if not result:
            return "noop"

        channel = result["channel"]
        external_id = result["external_user_id"]

        if channel in ("messenger", "instagram") and external_id:
            res = await db.execute(
                select(ChannelIntegration).where(
                    ChannelIntegration.user_id == uuid.UUID(result["user_id"]),
                    ChannelIntegration.platform == channel,
                    ChannelIntegration.is_active.is_(True),
                )
            )
            integration = res.scalar_one_or_none()
            if integration:
                token = (integration.credentials or {}).get("page_access_token", "")
                await send_meta_message(
                    token, external_id, result["reply"], channel
                )
        # widget/web: the front-end polls for the reply — nothing to push.
    return "ok"


async def on_startup(ctx) -> None:
    logger.info("ARQ worker started")


class WorkerSettings:
    functions = [process_session_task]
    redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)
    on_startup = on_startup
    max_jobs = 50
    job_timeout = 120
    keep_result = 60
