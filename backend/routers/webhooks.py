import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from fastapi.responses import JSONResponse, PlainTextResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from services.messaging_service import (
    get_integration,
    handle_inbound_text,
    send_meta_message,
    verify_meta_signature,
)

logger = logging.getLogger("webhooks")

router = APIRouter(tags=["webhooks"])

_CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Webhook-Secret",
}


# ─── Meta (Messenger + Instagram) ────────────────────────────────────────────
@router.get("/webhooks/meta/{public_id}")
async def meta_verify(
    public_id: str, request: Request, db: AsyncSession = Depends(get_db)
):
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")

    integration = await get_integration(public_id, db)
    if integration is None or integration.platform not in (
        "messenger",
        "instagram",
    ):
        raise HTTPException(status_code=404, detail="Unknown webhook")

    expected = (integration.credentials or {}).get("verify_token")
    if mode == "subscribe" and token and token == expected:
        return PlainTextResponse(challenge or "")
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/webhooks/meta/{public_id}")
async def meta_receive(
    public_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_hub_signature_256: str | None = Header(default=None),
):
    integration = await get_integration(public_id, db)
    if integration is None or integration.platform not in (
        "messenger",
        "instagram",
    ):
        raise HTTPException(status_code=404, detail="Unknown webhook")

    raw = await request.body()
    creds = integration.credentials or {}
    if not verify_meta_signature(
        creds.get("app_secret"), raw, x_hub_signature_256
    ):
        raise HTTPException(status_code=403, detail="Bad signature")

    try:
        payload = await request.json()
    except Exception:  # noqa: BLE001
        return {"status": "ignored"}

    page_token = creds.get("page_access_token", "")
    for entry in payload.get("entry", []):
        events = entry.get("messaging") or entry.get("standby") or []
        for event in events:
            message = event.get("message") or {}
            if message.get("is_echo"):
                continue
            text = message.get("text")
            sender_id = (event.get("sender") or {}).get("id")
            if not text or not sender_id:
                continue
            try:
                reply = await handle_inbound_text(
                    integration, sender_id, text, db
                )
                await send_meta_message(
                    page_token, sender_id, reply, integration.platform
                )
            except Exception:  # noqa: BLE001
                logger.exception("meta inbound handling failed")

    # Meta requires a fast 200 regardless
    return {"status": "ok"}


# ─── Generic webhook ─────────────────────────────────────────────────────────
@router.post("/webhooks/generic/{public_id}")
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

    reply = await handle_inbound_text(integration, sender_id, text, db)
    return {"reply": reply}


# ─── Embeddable web widget ───────────────────────────────────────────────────
@router.options("/webhooks/widget/{public_id}/message")
async def widget_preflight(public_id: str):
    return Response(status_code=204, headers=_CORS)


@router.post("/webhooks/widget/{public_id}/message")
async def widget_message(
    public_id: str, request: Request, db: AsyncSession = Depends(get_db)
):
    integration = await get_integration(public_id, db)
    if integration is None or integration.platform != "widget":
        return JSONResponse(
            {"detail": "Unknown widget"}, status_code=404, headers=_CORS
        )
    try:
        body = await request.json()
    except Exception:  # noqa: BLE001
        return JSONResponse(
            {"detail": "Invalid JSON"}, status_code=400, headers=_CORS
        )

    text = (body.get("message") or "").strip()
    visitor = str(body.get("visitor_id") or "web-visitor")
    if not text:
        return JSONResponse(
            {"detail": "message is required"}, status_code=400, headers=_CORS
        )

    reply = await handle_inbound_text(integration, visitor, text, db)
    return JSONResponse({"reply": reply}, headers=_CORS)


@router.get("/widget/{public_id}.js")
async def widget_script(public_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    integration = await get_integration(public_id, db)
    if integration is None or integration.platform != "widget":
        raise HTTPException(status_code=404, detail="Unknown widget")

    base = str(request.base_url).rstrip("/")
    endpoint = f"{base}/webhooks/widget/{public_id}/message"
    js = _WIDGET_JS.replace("__ENDPOINT__", endpoint)
    return Response(content=js, media_type="application/javascript")


_WIDGET_JS = """(function(){
  var ENDPOINT="__ENDPOINT__";
  var vid=localStorage.getItem("ai_widget_vid");
  if(!vid){vid="v-"+Math.random().toString(36).slice(2);localStorage.setItem("ai_widget_vid",vid);}
  var open=false;
  var btn=document.createElement("div");
  btn.innerHTML="\\uD83D\\uDCAC";
  btn.style.cssText="position:fixed;bottom:20px;right:20px;width:56px;height:56px;border-radius:50%;background:#2f56d6;color:#fff;font-size:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25);z-index:2147483000";
  var panel=document.createElement("div");
  panel.style.cssText="position:fixed;bottom:88px;right:20px;width:340px;max-width:90vw;height:460px;background:#fff;border-radius:14px;box-shadow:0 10px 40px rgba(0,0,0,.25);display:none;flex-direction:column;overflow:hidden;z-index:2147483000;font-family:sans-serif";
  panel.innerHTML='<div style="background:#2f56d6;color:#fff;padding:12px 14px;font-weight:600">Chat with us</div><div id="aiw-log" style="flex:1;overflow-y:auto;padding:12px;background:#f4f6fb;font-size:14px"></div><div style="display:flex;border-top:1px solid #eee"><input id="aiw-in" placeholder="Type a message..." style="flex:1;border:0;padding:12px;outline:none;font-size:14px"/><button id="aiw-send" style="border:0;background:#2f56d6;color:#fff;padding:0 16px;cursor:pointer">Send</button></div>';
  document.body.appendChild(btn);document.body.appendChild(panel);
  btn.onclick=function(){open=!open;panel.style.display=open?"flex":"none";};
  var log=function(){return panel.querySelector("#aiw-log");};
  function add(t,me){var d=document.createElement("div");d.style.cssText="margin:6px 0;padding:8px 10px;border-radius:10px;max-width:80%;"+(me?"background:#2f56d6;color:#fff;margin-left:auto":"background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.1)");d.textContent=t;log().appendChild(d);log().scrollTop=log().scrollHeight;}
  function send(){var i=panel.querySelector("#aiw-in");var v=i.value.trim();if(!v)return;i.value="";add(v,true);
    fetch(ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:v,visitor_id:vid})})
    .then(function(r){return r.json();}).then(function(d){add(d.reply||"...",false);})
    .catch(function(){add("Connection error.",false);});}
  panel.querySelector("#aiw-send").onclick=send;
  panel.querySelector("#aiw-in").addEventListener("keydown",function(e){if(e.key==="Enter")send();});
})();"""
