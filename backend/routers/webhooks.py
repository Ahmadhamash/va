import hashlib
import hmac
import json
import logging
import time

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import JSONResponse, PlainTextResponse, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models import ChatSession, Message, User, VoiceSettings
from services.messaging_service import (
    enqueue_inbound,
    get_integration,
    sync_reply,
    sync_reply_result,
    verify_meta_signature,
)
from services.file_service import signed_upload_url
from services.ratelimit import limiter

logger = logging.getLogger("webhooks")

router = APIRouter(tags=["webhooks"])

_CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Webhook-Secret",
}


# ─── Meta (Messenger + Instagram) ────────────────────────────────────────────
@router.get("/webhooks/meta/{public_id}")
@limiter.limit("60/minute")
async def meta_verify(
    public_id: str, request: Request, db: AsyncSession = Depends(get_db)
):
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")

    integration = await get_integration(public_id, db)
    if integration is None or integration.platform not in ("messenger", "instagram"):
        raise HTTPException(status_code=404, detail="Unknown webhook")

    expected = (integration.credentials or {}).get("verify_token")
    if mode == "subscribe" and token and expected:
        import hmac
        if hmac.compare_digest(token.encode(), expected.encode()):
            return PlainTextResponse(challenge or "")
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/webhooks/meta/{public_id}")
@limiter.limit("60/minute")
async def meta_receive(
    public_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_hub_signature_256: str | None = Header(default=None),
):
    integration = await get_integration(public_id, db)
    if integration is None or integration.platform not in ("messenger", "instagram"):
        raise HTTPException(status_code=404, detail="Unknown webhook")

    raw = await request.body()
    creds = integration.credentials or {}
    if not verify_meta_signature(creds.get("app_secret"), raw, x_hub_signature_256):
        raise HTTPException(status_code=403, detail="Bad signature")

    try:
        payload = await request.json()
    except Exception:  # noqa: BLE001
        return {"status": "ignored"}

    for entry in payload.get("entry", []):
        for event in entry.get("messaging") or entry.get("standby") or []:
            message = event.get("message") or {}
            if message.get("is_echo"):
                continue
            sender_id = (event.get("sender") or {}).get("id")
            if not sender_id:
                continue

            text = message.get("text")
            media_type = "text"
            media_url = None

            # Check for attachments (images, audio/voice notes)
            for att in message.get("attachments") or []:
                att_type = att.get("type", "")
                att_url = (att.get("payload") or {}).get("url")
                if att_type == "image" and att_url:
                    media_type = "image"
                    media_url = att_url
                    break
                if att_type == "audio" and att_url:
                    media_type = "audio"
                    media_url = att_url
                    break

            # Skip if no text AND no media attachment
            if not text and not media_url:
                continue

            try:
                # Buffer + debounce; the worker answers and sends the reply.
                await enqueue_inbound(
                    integration, sender_id, text, db,
                    media_type=media_type, media_url=media_url,
                )
            except Exception:  # noqa: BLE001
                logger.exception("meta inbound enqueue failed")

    return {"status": "ok"}


# ─── WhatsApp Cloud API ──────────────────────────────────────────────────
@router.get("/webhooks/whatsapp/{public_id}")
@limiter.limit("60/minute")
async def whatsapp_verify(
    public_id: str, request: Request, db: AsyncSession = Depends(get_db)
):
    """Verify WhatsApp webhook subscription (hub challenge)."""
    from services.channels import get_adapter

    integration = await get_integration(public_id, db)
    if integration is None or integration.platform != "whatsapp":
        raise HTTPException(status_code=404, detail="Unknown webhook")

    adapter = get_adapter("whatsapp")
    challenge = await adapter.verify_webhook(
        dict(request.query_params), integration.credentials or {}
    )
    if challenge is not None:
        return PlainTextResponse(challenge)
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/webhooks/whatsapp/{public_id}")
@limiter.limit("60/minute")
async def whatsapp_receive(
    public_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_hub_signature_256: str | None = Header(default=None),
):
    """Receive WhatsApp Cloud API webhook events."""
    from services.channels import get_adapter

    integration = await get_integration(public_id, db)
    if integration is None or integration.platform != "whatsapp":
        raise HTTPException(status_code=404, detail="Unknown webhook")

    raw = await request.body()
    creds = integration.credentials or {}

    # Verify signature
    if not verify_meta_signature(creds.get("app_secret"), raw, x_hub_signature_256):
        raise HTTPException(status_code=403, detail="Bad signature")

    try:
        payload = await request.json()
    except Exception:  # noqa: BLE001
        return {"status": "ignored"}

    adapter = get_adapter("whatsapp")

    # Handle message status updates
    statuses = adapter.handle_message_status(payload)
    for status in statuses:
        logger.info(
            "WhatsApp status update: msg_id=%s status=%s",
            status.channel_message_id,
            status.status,
        )

    # Parse incoming messages
    messages = adapter.parse_incoming_webhook(payload, creds)
    for msg in messages:
        try:
            await enqueue_inbound(
                integration,
                msg.external_user_id,
                msg.text,
                db,
                media_type=msg.message_type,
                media_url=msg.media_url or msg.media_id,
            )
        except Exception:  # noqa: BLE001
            logger.exception("WhatsApp inbound enqueue failed")

    return {"status": "ok"}


# ─── Generic webhook (synchronous) ───────────────────────────────────────────
@router.post("/webhooks/generic/{public_id}")
@limiter.limit("30/minute")
async def generic_inbound(
    public_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_webhook_secret: str | None = Header(default=None),
):
    integration = await get_integration(public_id, db)
    if integration is None or integration.platform != "webhook":
        raise HTTPException(status_code=404, detail="Unknown webhook")

    secret = (integration.credentials or {}).get("webhook_secret")
    if secret:
        import hmac
        if not x_webhook_secret or not hmac.compare_digest(x_webhook_secret.encode(), secret.encode()):
            raise HTTPException(status_code=403, detail="Invalid secret")

    try:
        body = await request.json()
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    text = (body.get("message") or body.get("text") or "").strip()
    sender_id = str(body.get("sender_id") or body.get("from") or "anonymous")
    if not text:
        raise HTTPException(status_code=400, detail="message is required")

    reply = await sync_reply(integration, sender_id, text, db)
    return {"reply": reply}


# ─── Manychat Dynamic Block (synchronous) ────────────────────────────────────
def _manychat_nested(body: dict, key: str) -> object | None:
    for container_key in ("contact", "user", "subscriber", "full_contact_data"):
        nested = body.get(container_key)
        if isinstance(nested, dict) and nested.get(key) is not None:
            return nested.get(key)
    return None


def _manychat_channel(request: Request, body: dict) -> str:
    raw = (
        request.query_params.get("platform")
        or request.query_params.get("channel")
        or body.get("platform")
        or body.get("channel")
        or _manychat_nested(body, "platform")
        or _manychat_nested(body, "channel")
        or "facebook"
    )
    value = str(raw).strip().lower()
    if value in {"instagram", "ig"}:
        return "instagram"
    return "messenger"


def _manychat_sender_id(body: dict) -> str:
    for key in ("subscriber_id", "user_id", "sender_id", "from", "id", "key"):
        value = body.get(key)
        if value is None:
            value = _manychat_nested(body, key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return "anonymous"


def _manychat_text(body: dict) -> str:
    for key in ("text", "message", "last_input_text", "input"):
        value = body.get(key)
        if value is None:
            value = _manychat_nested(body, key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def _manychat_text_messages(reply: str) -> list[dict]:
    remaining = reply.strip()
    messages: list[dict] = []
    limit = 1800
    max_messages = 10

    while remaining and len(messages) < max_messages:
        if len(remaining) <= limit:
            chunk = remaining
            remaining = ""
        else:
            newline_at = remaining.rfind("\n", 0, limit)
            space_at = remaining.rfind(" ", 0, limit)
            cut_at = max(newline_at, space_at)
            if cut_at < int(limit * 0.5):
                cut_at = limit
            chunk = remaining[:cut_at].strip()
            remaining = remaining[cut_at:].strip()
        if chunk:
            messages.append({"type": "text", "text": chunk})

    if remaining and messages:
        suffix = "\n..."
        text = messages[-1]["text"].rstrip()
        if len(text) + len(suffix) > limit:
            text = text[: limit - len(suffix)].rstrip()
        messages[-1]["text"] = text + suffix
    return messages


def _manychat_public_media_url(url_or_path: str | None) -> str | None:
    if not url_or_path:
        return None
    raw = url_or_path.strip()
    if raw.startswith("https://"):
        return raw
    if raw.startswith("http://"):
        return raw.replace("http://", "https://", 1)

    domain = settings.DOMAIN.strip().rstrip("/")
    if not domain:
        logger.error("DOMAIN is not configured; cannot expose ManyChat audio URL")
        return None
    if not domain.startswith(("http://", "https://")):
        domain = f"https://{domain}"
    clean = signed_upload_url(raw.lstrip("/"), expires_minutes=120)
    return f"{domain}/{clean}"


def _manychat_response(
    reply: str | None,
    channel: str,
    *,
    audio_url: str | None = None,
    delivery: str = "text",
) -> dict:
    messages: list[dict] = []
    if delivery != "voice" or not audio_url:
        messages.extend(_manychat_text_messages(reply or ""))
    if audio_url:
        messages.append({"type": "audio", "url": audio_url})
    content = {"messages": messages}
    if channel == "instagram":
        content["type"] = "instagram"
    return {"version": "v2", "content": content}


def _manychat_external_response(
    reply: str | None,
    *,
    audio_url: str | None = None,
) -> dict:
    """Flat payload for ManyChat's External Request response mapping."""
    value = reply or ""
    return {
        "ai_reply": value,
        "reply": value,
        "audio_url": audio_url or "",
        "has_audio": bool(audio_url),
    }


async def _manychat_resolve_delivery(
    requested_delivery: str,
    user_id,
    db: AsyncSession,
) -> str:
    if requested_delivery != "auto":
        return requested_delivery

    result = await db.execute(
        select(VoiceSettings.voice_mode).where(VoiceSettings.user_id == user_id)
    )
    voice_mode = result.scalar_one_or_none() or "off"
    if voice_mode == "always_voice":
        return "voice"
    if voice_mode == "text_and_voice":
        return "text_and_voice"
    # ManyChat sends text to this webhook, so voice_when_voice behaves as text
    # unless the flow is later extended to forward the original audio metadata.
    return "text"


@router.post("/webhooks/manychat/{public_id}")
@limiter.limit("60/minute")
async def manychat_inbound(
    public_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_webhook_secret: str | None = Header(default=None),
):
    integration = await get_integration(public_id, db)
    if integration is None or integration.platform != "webhook":
        raise HTTPException(status_code=404, detail="Unknown webhook")

    try:
        body = await request.json()
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    secret = (integration.credentials or {}).get("webhook_secret")
    if secret:
        import hmac

        supplied_secret = x_webhook_secret or str(body.get("webhook_secret") or "")
        if not supplied_secret or not hmac.compare_digest(
            supplied_secret.encode(), secret.encode()
        ):
            raise HTTPException(status_code=403, detail="Invalid secret")

    channel = _manychat_channel(request, body)
    text = _manychat_text(body)
    sender_id = _manychat_sender_id(body)
    response_mode = request.query_params.get("response", "dynamic").strip().lower()
    requested_delivery = request.query_params.get("delivery", "text").strip().lower()
    if requested_delivery not in {"auto", "text", "voice", "text_and_voice"}:
        raise HTTPException(status_code=400, detail="Invalid delivery mode")
    delivery = await _manychat_resolve_delivery(
        requested_delivery,
        integration.user_id,
        db,
    )
    
    if not text:
        if response_mode == "external":
            return _manychat_external_response(None)
        return _manychat_response(None, channel, delivery=delivery)

    started_at = time.perf_counter()
    wants_voice = delivery in {"voice", "text_and_voice"}
    force_voice = requested_delivery != "auto" and wants_voice
    result = await sync_reply_result(
        integration,
        sender_id,
        text,
        db,
        channel=channel,
        generate_voice=wants_voice,
        force_voice=force_voice,
        voice_output_format="mp3" if wants_voice else None,
    )
    reply = result.get("reply") or ""
    audio_url = _manychat_public_media_url(result.get("audio_url"))
    logger.info(
        "ManyChat reply ready: channel=%s requested_delivery=%s delivery=%s has_audio=%s sender_suffix=%s elapsed_ms=%d reply_len=%d",
        channel,
        requested_delivery,
        delivery,
        bool(audio_url),
        sender_id[-6:],
        round((time.perf_counter() - started_at) * 1000),
        len(reply or ""),
    )
    
    if response_mode == "external":
        return _manychat_external_response(reply, audio_url=audio_url)
    return _manychat_response(
        reply,
        channel,
        audio_url=audio_url,
        delivery=delivery,
    )


# ─── OpenWA / WhatsApp Web bridge ────────────────────────────────────────────
def _verify_openwa_signature(secret: str | None, raw_body: bytes, signature: str | None) -> bool:
    if not secret:
        return True
    if not signature or not signature.startswith("sha256="):
        return False
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature.split("=", 1)[1])


def _openwa_message(payload: dict) -> dict:
    data = payload.get("data")
    return data if isinstance(data, dict) else {}


def _openwa_text_chunks(text: str) -> list[str]:
    remaining = text.strip()
    chunks: list[str] = []
    limit = 3900
    max_chunks = 4

    while remaining and len(chunks) < max_chunks:
        if len(remaining) <= limit:
            chunks.append(remaining)
            remaining = ""
            break
        newline_at = remaining.rfind("\n", 0, limit)
        space_at = remaining.rfind(" ", 0, limit)
        split_at = max(newline_at, space_at)
        if split_at < int(limit * 0.5):
            split_at = limit
        chunks.append(remaining[:split_at].strip())
        remaining = remaining[split_at:].strip()

    if remaining and chunks:
        suffix = "\n..."
        chunks[-1] = chunks[-1][: limit - len(suffix)].rstrip() + suffix
    return [chunk for chunk in chunks if chunk]


async def _send_openwa_reply(
    credentials: dict,
    session_id: str,
    chat_id: str,
    reply: str,
) -> None:
    api_url = (
        credentials.get("openwa_api_url")
        or settings.OPENWA_API_URL
        or "http://openwa:2785"
    ).rstrip("/")
    api_key = credentials.get("openwa_api_key") or settings.OPENWA_API_KEY
    if not api_key:
        raise RuntimeError("OpenWA API key is not configured")

    headers = {"X-API-Key": api_key}
    chunks = _openwa_text_chunks(reply)
    if not chunks:
        return

    async with httpx.AsyncClient(timeout=30) as client:
        for chunk in chunks:
            response = await client.post(
                f"{api_url}/api/sessions/{session_id}/messages/send-text",
                headers=headers,
                json={"chatId": chat_id, "text": chunk},
            )
            response.raise_for_status()


@router.post("/webhooks/openwa/{public_id}")
@limiter.limit("60/minute")
async def openwa_inbound(
    public_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_openwa_signature: str | None = Header(default=None),
):
    integration = await get_integration(public_id, db)
    if integration is None or integration.platform != "webhook":
        raise HTTPException(status_code=404, detail="Unknown webhook")

    raw = await request.body()
    credentials = integration.credentials or {}
    secret = credentials.get("openwa_webhook_secret") or settings.OPENWA_WEBHOOK_SECRET
    if not _verify_openwa_signature(secret, raw, x_openwa_signature):
        raise HTTPException(status_code=403, detail="Bad signature")

    try:
        payload = json.loads(raw.decode("utf-8") or "{}")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    event = str(payload.get("event") or "")
    if event != "message.received":
        return {"status": "ignored", "reason": "unsupported_event"}

    message = _openwa_message(payload)
    if message.get("fromMe"):
        return {"status": "ignored", "reason": "from_me"}

    allow_groups = bool(credentials.get("openwa_allow_groups", settings.OPENWA_ALLOW_GROUPS))
    if message.get("isGroup") and not allow_groups:
        return {"status": "ignored", "reason": "group_message"}

    text = str(message.get("body") or "").strip()
    chat_id = str(message.get("chatId") or message.get("from") or "").strip()
    session_id = str(payload.get("sessionId") or credentials.get("openwa_session_id") or "").strip()

    if not text:
        return {"status": "ignored", "reason": "empty_message"}
    if not chat_id or not session_id:
        logger.warning("OpenWA webhook missing chat_id/session_id: %s", payload)
        return {"status": "ignored", "reason": "missing_identity"}

    reply = await sync_reply(integration, chat_id, text, db, channel="whatsapp")
    try:
        await _send_openwa_reply(credentials, session_id, chat_id, reply)
    except Exception:  # noqa: BLE001
        logger.exception("OpenWA reply send failed")
        raise HTTPException(status_code=502, detail="OpenWA reply send failed")

    return {"status": "ok"}


# ─── Embeddable web widget (debounced + polling) ─────────────────────────────
def _verify_widget_token(token: str) -> str | None:
    import jwt
    from config import settings
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload.get("vid")
    except jwt.PyJWTError:
        return None

@router.options("/webhooks/widget/{public_id}/init")
async def widget_init_preflight(public_id: str):
    return Response(status_code=204, headers=_CORS)

@router.post("/webhooks/widget/{public_id}/init")
@limiter.limit("10/minute")
async def widget_init(public_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    integration = await get_integration(public_id, db)
    if integration is None or integration.platform != "widget":
        return JSONResponse({"detail": "Unknown widget"}, status_code=404, headers=_CORS)
    import uuid
    import jwt
    from datetime import datetime, timedelta, timezone
    from config import settings
    visitor_id = str(uuid.uuid4())
    payload = {
        "vid": visitor_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=30)
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return JSONResponse({"token": token}, headers=_CORS)


@router.options("/webhooks/widget/{public_id}/message")
async def widget_preflight(public_id: str):
    return Response(status_code=204, headers=_CORS)


@router.post("/webhooks/widget/{public_id}/message")
@limiter.limit("30/minute")
async def widget_message(
    public_id: str, request: Request, db: AsyncSession = Depends(get_db)
):
    integration = await get_integration(public_id, db)
    if integration is None or integration.platform != "widget":
        return JSONResponse({"detail": "Unknown widget"}, status_code=404, headers=_CORS)
    try:
        body = await request.json()
    except Exception:  # noqa: BLE001
        return JSONResponse({"detail": "Invalid JSON"}, status_code=400, headers=_CORS)

    text = (body.get("message") or "").strip()
    token = body.get("token")
    visitor = _verify_widget_token(token)
    
    if not visitor:
        return JSONResponse({"detail": "Invalid or missing token"}, status_code=403, headers=_CORS)

    if not text:
        return JSONResponse(
            {"detail": "message is required"}, status_code=400, headers=_CORS
        )

    await enqueue_inbound(integration, visitor, text, db)
    return JSONResponse({"status": "queued"}, headers=_CORS)


@router.options("/webhooks/widget/{public_id}/poll")
async def widget_poll_preflight(public_id: str):
    return Response(status_code=204, headers=_CORS)


@router.get("/webhooks/widget/{public_id}/poll")
@limiter.limit("60/minute")
async def widget_poll(
    public_id: str, request: Request, db: AsyncSession = Depends(get_db)
):
    integration = await get_integration(public_id, db)
    if integration is None or integration.platform != "widget":
        return JSONResponse({"detail": "Unknown widget"}, status_code=404, headers=_CORS)

    auth_header = request.headers.get("authorization", "")
    token = request.query_params.get("token")
    if auth_header.lower().startswith("bearer "):
        token = auth_header.split(" ", 1)[1].strip()
    visitor = _verify_widget_token(token)
    
    if not visitor:
        return JSONResponse({"detail": "Invalid token"}, status_code=403, headers=_CORS)
    client = await db.get(User, integration.user_id)
    if client is None:
        return JSONResponse({"messages": []}, headers=_CORS)

    res = await db.execute(
        select(ChatSession).where(
            ChatSession.user_id == client.id,
            ChatSession.channel == "widget",
            ChatSession.external_user_id == visitor,
        )
    )
    session = res.scalar_one_or_none()
    if session is None:
        return JSONResponse({"messages": []}, headers=_CORS)

    rows = await db.execute(
        select(Message)
        .where(Message.session_id == session.id, Message.content.isnot(None))
        .order_by(Message.created_at.asc())
        .limit(100)
    )
    msgs = [
        {
            "id": str(m.id),
            "role": m.role,
            "content": m.content,
            "created_at": m.created_at.isoformat(),
        }
        for m in rows.scalars().all()
    ]
    return JSONResponse({"messages": msgs}, headers=_CORS)


@router.get("/widget/{public_id}.js")
async def widget_script(
    public_id: str, request: Request, db: AsyncSession = Depends(get_db)
):
    integration = await get_integration(public_id, db)
    if integration is None or integration.platform != "widget":
        raise HTTPException(status_code=404, detail="Unknown widget")

    base = str(request.base_url).rstrip("/") + "/api"
    js = (
        _WIDGET_JS.replace("__BASE__", base).replace("__PID__", public_id)
    )
    return Response(content=js, media_type="application/javascript")


_WIDGET_JS = """(function(){
  var BASE="__BASE__",PID="__PID__";
  var MSG=BASE+"/webhooks/widget/"+PID+"/message";
  var POLL=BASE+"/webhooks/widget/"+PID+"/poll";
  var INIT=BASE+"/webhooks/widget/"+PID+"/init";
  var token=null;
  
  function initToken(cb){
    if(token) return cb();
    fetch(INIT,{method:"POST"}).then(function(r){return r.json();}).then(function(d){
      token=d.token; cb();
    }).catch(function(){});
  }

  var open=false,seen={},poller=null;
  var btn=document.createElement("div");
  btn.innerHTML="\\uD83D\\uDCAC";
  btn.style.cssText="position:fixed;bottom:20px;right:20px;width:56px;height:56px;border-radius:50%;background:#2f56d6;color:#fff;font-size:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.25);z-index:2147483000";
  var panel=document.createElement("div");
  panel.style.cssText="position:fixed;bottom:88px;right:20px;width:350px;max-width:92vw;height:480px;background:#fff;border-radius:16px;box-shadow:0 12px 48px rgba(0,0,0,.25);display:none;flex-direction:column;overflow:hidden;z-index:2147483000;font-family:system-ui,sans-serif";
  panel.innerHTML='<div style="background:#2f56d6;color:#fff;padding:14px 16px;font-weight:600">Chat with us</div><div id="aiw-log" style="flex:1;overflow-y:auto;padding:14px;background:#f4f6fb;font-size:14px"></div><div style="display:flex;border-top:1px solid #eee"><input id="aiw-in" placeholder="Type a message..." style="flex:1;border:0;padding:14px;outline:none;font-size:14px"/><button id="aiw-send" style="border:0;background:#2f56d6;color:#fff;padding:0 18px;cursor:pointer;font-weight:600">Send</button></div>';
  document.body.appendChild(btn);document.body.appendChild(panel);
  
  btn.onclick=function(){open=!open;panel.style.display=open?"flex":"none";if(open){initToken(poll);}};
  function log(){return panel.querySelector("#aiw-log");}
  function add(t,me,id){if(id){if(seen[id])return;seen[id]=1;}var d=document.createElement("div");d.dir="auto";d.style.cssText="margin:6px 0;padding:9px 12px;border-radius:12px;max-width:82%;white-space:pre-wrap;word-break:break-word;"+(me?"background:#2f56d6;color:#fff;margin-left:auto":"background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.1)");d.textContent=t;log().appendChild(d);log().scrollTop=log().scrollHeight;}
  function poll(){if(!token)return;fetch(POLL,{headers:{"Authorization":"Bearer "+token}}).then(function(r){return r.json();}).then(function(d){(d.messages||[]).forEach(function(m){add(m.content,m.role==="user",m.id);});}).catch(function(){});}
  function send(){
    var i=panel.querySelector("#aiw-in");var v=i.value.trim();if(!v)return;
    initToken(function(){
      i.value="";add(v,true);
      fetch(MSG,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:v,token:token})})
      .then(function(){var n=0;clearInterval(poller);poller=setInterval(function(){n++;poll();if(n>30)clearInterval(poller);},2000);})
      .catch(function(){add("Connection error.",false);});
    });
  }
  panel.querySelector("#aiw-send").onclick=send;
  panel.querySelector("#aiw-in").addEventListener("keydown",function(e){if(e.key==="Enter")send();});
})();"""
