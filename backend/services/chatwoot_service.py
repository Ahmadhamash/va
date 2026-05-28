import logging
import httpx
from config import settings

logger = logging.getLogger("chatwoot_service")

def is_chatwoot_enabled() -> bool:
    return bool(settings.CHATWOOT_BASE_URL and settings.CHATWOOT_API_ACCESS_TOKEN)

async def provision_chatwoot_account(business_name: str, client_email: str) -> str | None:
    """Create a new Chatwoot Account and register the webhook for it."""
    if not is_chatwoot_enabled():
        logger.info("Chatwoot is not configured; skipping account provisioning")
        return None
        
    base = settings.CHATWOOT_BASE_URL.rstrip("/")
    headers = {
        "api_access_token": settings.CHATWOOT_API_ACCESS_TOKEN,
        "Content-Type": "application/json",
    }
    
    # 1. Create Account
    account_url = f"{base}/api/v1/accounts"
    account_payload = {
        "name": business_name or f"Client Account {client_email}"
    }
    
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.post(account_url, headers=headers, json=account_payload)
            if not res.is_success:
                logger.error("Failed to create Chatwoot account: %s %s", res.status_code, res.text)
                return None
            account_data = res.json()
            account_id = str(account_data.get("id"))
            logger.info("Successfully created Chatwoot account ID: %s", account_id)
            
            # 1.5. Add the Client as an Administrator Agent in Chatwoot
            agent_url = f"{base}/api/v1/accounts/{account_id}/agents"
            agent_payload = {
                "name": business_name or "Client Admin",
                "email": client_email,
                "role": "administrator"
            }
            try:
                agent_res = await client.post(agent_url, headers=headers, json=agent_payload)
                if agent_res.is_success:
                    logger.info("Successfully added client agent %s to Chatwoot account: %s", client_email, account_id)
                else:
                    logger.warning("Could not add client agent to Chatwoot: %s %s", agent_res.status_code, agent_res.text)
            except Exception:
                logger.exception("Error adding agent to Chatwoot account")
            
            # 2. Register Webhook for this account
            # Webhook URL pointing to our backend API /api/webhooks/chatwoot
            webhook_url = f"{base}/api/v1/accounts/{account_id}/webhooks"
            
            # Find CORS base URL for callback endpoint
            public_domain = settings.CORS_ORIGINS[0] if settings.CORS_ORIGINS else "http://localhost:8000"
            callback_url = f"{public_domain.rstrip('/')}/api/webhooks/chatwoot"
            
            webhook_payload = {
                "url": callback_url,
                "subscriptions": ["message_created"]
            }
            
            w_res = await client.post(webhook_url, headers=headers, json=webhook_payload)
            if w_res.is_success:
                logger.info("Successfully registered Chatwoot webhook for account: %s", account_id)
            else:
                logger.error("Failed to register webhook in Chatwoot: %s %s", w_res.status_code, w_res.text)
                
            return account_id
    except Exception:
        logger.exception("Unexpected error during Chatwoot account provisioning")
        return None
