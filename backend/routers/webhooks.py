import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import JSONResponse, PlainTextResponse, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import ChatSession, Message, User
from services.messaging_service import (
    enqueue_inbound,
    get_integration,
    sync_reply,
    verify_meta_signature,
)
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
    if mode == "subscribe" and token and token == expected:
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
    if secret and x_webhook_secret != secret:
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
    from config import settings
    visitor_id = str(uuid.uuid4())
    token = jwt.encode({"vid": visitor_id}, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
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

    token = request.query_params.get("token")
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
  var token=localStorage.getItem("ai_widget_token");
  
  function initToken(cb){
    if(token) return cb();
    fetch(INIT,{method:"POST"}).then(function(r){return r.json();}).then(function(d){
      token=d.token; localStorage.setItem("ai_widget_token", token); cb();
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
  function poll(){if(!token)return;fetch(POLL+"?token="+encodeURIComponent(token)).then(function(r){return r.json();}).then(function(d){(d.messages||[]).forEach(function(m){add(m.content,m.role==="user",m.id);});}).catch(function(){});}
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
