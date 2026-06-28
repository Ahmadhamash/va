"""ARQ worker. Run with:  arq queue_app.WorkerSettings

Processes debounced channel conversations (Messenger / Instagram / WhatsApp /
widget) off the request path so the API stays responsive under load.

Now uses the ChannelAdapter pattern for sending replies and logs every
delivery attempt to the MessageDeliveryLog table.
"""
import logging
import uuid
import asyncio

from arq.connections import RedisSettings
from arq import Retry
from sqlalchemy import select
from pythonjsonlogger import jsonlogger

from config import settings
from database import AsyncSessionLocal
from models import ChannelIntegration, MessageDeliveryLog
from services.ai_chat import process_pending
from services.channels import get_adapter, DeliveryResult
import sentry_sdk

if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.APP_ENV,
    )

logHandler = logging.StreamHandler()
formatter = jsonlogger.JsonFormatter('%(asctime)s %(levelname)s %(name)s %(message)s')
logHandler.setFormatter(formatter)
logging.basicConfig(level=logging.INFO, handlers=[logHandler])
logger = logging.getLogger("worker")


async def _send_text_bubbles(
    *,
    adapter,
    external_id: str,
    text_reply: str,
    credentials: dict,
    db,
    channel: str,
    session_id: str,
    is_fallback: bool = False,
) -> DeliveryResult:
    # Multi-Bubble Messaging Strategy
    # Replace literal '\n' that LLMs sometimes generate, then split by newlines.
    clean_reply = (text_reply or "").replace("\\n", "\n")
    bubbles = [b.strip() for b in clean_reply.split("\n") if b.strip()]
    if not bubbles:
        bubbles = [clean_reply]

    final_delivery = None
    for bubble in bubbles:
        await adapter.send_typing_indicator(external_id, credentials)
        # Keep typing presence brief so worker slots are not held for seconds
        # per bubble under load.
        typing_delay = min(0.8, max(0.15, len(bubble) / 180.0))
        await asyncio.sleep(typing_delay)

        delivery = await adapter.send_text_message(
            external_id, bubble, credentials
        )
        final_delivery = delivery

        await _log_delivery(
            db,
            channel=channel,
            delivery_type="text",
            result=delivery,
            session_id=session_id,
            is_fallback=is_fallback,
        )

        if not delivery.success:
            break

    return final_delivery or DeliveryResult(
        success=False,
        error_message="Empty message",
    )


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

        if channel in ("messenger", "instagram", "whatsapp") and external_id:
            res = await db.execute(
                select(ChannelIntegration).where(
                    ChannelIntegration.user_id == uuid.UUID(result["user_id"]),
                    ChannelIntegration.platform == channel,
                    ChannelIntegration.is_active.is_(True),
                )
            )
            integration = res.scalar_one_or_none()
            if integration:
                credentials = integration.credentials or {}
                adapter = get_adapter(channel)
                audio_url = result.get("audio_url")
                image_url = result.get("image_url")
                text_reply = result["reply"]

                try:
                    # Try audio first if available
                    if audio_url:
                        delivery = await adapter.send_audio_message(
                            external_id, audio_url, credentials
                        )
                        await _log_delivery(
                            db,
                            channel=channel,
                            delivery_type="audio",
                            result=delivery,
                            session_id=session_id,
                        )

                        # If audio fails → fallback to text
                        if not delivery.success:
                            logger.warning(
                                "Audio delivery failed for %s, falling back to text: %s",
                                channel,
                                delivery.error_message,
                            )
                            delivery = await _send_text_bubbles(
                                adapter=adapter,
                                external_id=external_id,
                                text_reply=text_reply,
                                credentials=credentials,
                                db=db,
                                session_id=session_id,
                                channel=channel,
                                is_fallback=True,
                            )
                    else:
                        delivery = await _send_text_bubbles(
                            adapter=adapter,
                            external_id=external_id,
                            text_reply=text_reply,
                            credentials=credentials,
                            db=db,
                            session_id=session_id,
                            channel=channel,
                        )

                    if image_url and delivery.success:
                        image_delivery = await adapter.send_image_message(
                            external_id, image_url, credentials
                        )
                        await _log_delivery(
                            db,
                            channel=channel,
                            delivery_type="image",
                            result=image_delivery,
                            session_id=session_id,
                        )
                        if not image_delivery.success:
                            delivery = image_delivery

                    if not delivery.success:
                        job_try = ctx.get("job_try", 1)
                        if job_try <= 3 and delivery.retryable:
                            logger.warning(
                                "Delivery failed (retryable), attempt %d/3: %s",
                                job_try,
                                delivery.error_message,
                            )
                            raise Retry(defer=2 ** job_try)
                        else:
                            logger.error(
                                "DEAD LETTER: Permanent failure delivering to %s for session %s. Error: %s",
                                channel,
                                session_id,
                                delivery.error_message,
                            )

                except Retry:
                    raise  # Re-raise Retry so ARQ handles it
                except Exception as e:
                    job_try = ctx.get("job_try", 1)
                    if job_try <= 3:
                        logger.warning(
                            "Delivery failed, retrying (attempt %s/3): %s",
                            job_try,
                            e,
                        )
                        raise Retry(defer=2 ** job_try) from e
                    else:
                        logger.error(
                            "DEAD LETTER: Permanent failure delivering to %s for session %s. Error: %s",
                            channel,
                            session_id,
                            e,
                        )

        # widget/web: the front-end polls for the reply — nothing to push.
    return "ok"


async def _log_delivery(
    db,
    *,
    channel: str,
    delivery_type: str,
    result: DeliveryResult,
    session_id: str,
    is_fallback: bool = False,
) -> None:
    """Log a delivery attempt to the database."""
    try:
        status = "sent" if result.success else "failed"
        if is_fallback and result.success:
            status = "fallback_text_sent"

        log = MessageDeliveryLog(
            session_id=uuid.UUID(session_id),
            channel=channel,
            delivery_type=delivery_type,
            status=status,
            meta_message_id=result.channel_message_id,
            meta_response=result.raw_response,
            error_payload={"code": result.error_code, "message": result.error_message}
            if not result.success
            else None,
            error_reason=result.error_message if not result.success else None,
            attempt_count=1,
        )
        db.add(log)
        await db.commit()
    except Exception:
        logger.exception("Failed to log delivery attempt")


async def on_startup(ctx) -> None:
    logger.info("ARQ worker started (with channel adapters)")


class WorkerSettings:
    functions = [process_session_task]
    redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)
    on_startup = on_startup
    max_jobs = 50
    job_timeout = 120
    keep_result = 60
