import json
import logging
from typing import Optional

import httpx

from config import settings

logger = logging.getLogger("make_service")

# A basic blueprint template for a Make.com scenario
# Trigger: Facebook Messenger (Watch Events)
# Action 1: HTTP (Make a request to VA Platform generic webhook)
# Action 2: Facebook Messenger (Send a Message with the reply)
SCENARIO_BLUEPRINT = {
    "name": "VA Platform Integration - {CLIENT_NAME}",
    "flow": [
        {
            "id": 1,
            "module": "facebook-messenger:watchMessages",
            "version": 2,
            "parameters": {},
            "mapper": {},
            "metadata": {
                "designer": {
                    "x": 0,
                    "y": 0
                },
                "parameters": [
                    {
                        "name": "connection",
                        "type": "connection",
                        "label": "Connection",
                        "required": True
                    }
                ]
            }
        },
        {
            "id": 2,
            "module": "http:MakeRequest",
            "version": 4,
            "parameters": {
                "handleErrors": False,
                "useMtls": False
            },
            "mapper": {
                "url": "{WEBHOOK_URL}",
                "method": "post",
                "headers": [],
                "qs": [],
                "bodyType": "raw",
                "parseResponse": True,
                "contentType": "application/json",
                "data": "{\n  \"sender_id\": \"{{1.sender.id}}\",\n  \"message\": \"{{1.message.text}}\"\n}"
            },
            "metadata": {
                "designer": {
                    "x": 300,
                    "y": 0
                },
                "parameters": [
                    {
                        "name": "handleErrors",
                        "type": "boolean",
                        "label": "Evaluate all states as errors (except for 2xx and 3xx)",
                        "required": True
                    },
                    {
                        "name": "useMtls",
                        "type": "boolean",
                        "label": "Use Mutual TLS",
                        "required": True
                    }
                ],
                "expect": [
                    {
                        "name": "url",
                        "type": "url",
                        "label": "URL",
                        "required": True
                    },
                    {
                        "name": "method",
                        "type": "select",
                        "label": "Method",
                        "required": True,
                        "validate": {
                            "enum": [
                                "get",
                                "head",
                                "post",
                                "put",
                                "patch",
                                "delete",
                                "options"
                            ]
                        }
                    },
                    {
                        "name": "headers",
                        "type": "array",
                        "label": "Headers",
                        "spec": [
                            {
                                "name": "name",
                                "type": "text",
                                "label": "Name",
                                "required": True
                            },
                            {
                                "name": "value",
                                "type": "text",
                                "label": "Value",
                                "required": True
                            }
                        ]
                    },
                    {
                        "name": "qs",
                        "type": "array",
                        "label": "Query String",
                        "spec": [
                            {
                                "name": "name",
                                "type": "text",
                                "label": "Name",
                                "required": True
                            },
                            {
                                "name": "value",
                                "type": "text",
                                "label": "Value",
                                "required": True
                            }
                        ]
                    },
                    {
                        "name": "bodyType",
                        "type": "select",
                        "label": "Body type",
                        "validate": {
                            "enum": [
                                "raw",
                                "application/x-www-form-urlencoded",
                                "multipart/form-data"
                            ]
                        }
                    },
                    {
                        "name": "parseResponse",
                        "type": "boolean",
                        "label": "Parse response",
                        "required": True
                    },
                    {
                        "name": "contentType",
                        "type": "select",
                        "label": "Content type",
                        "validate": {
                            "enum": [
                                "text/plain",
                                "text/html",
                                "application/json",
                                "application/xml"
                            ]
                        }
                    },
                    {
                        "name": "data",
                        "type": "text",
                        "label": "Request content"
                    }
                ]
            }
        },
        {
            "id": 3,
            "module": "facebook-messenger:sendMessage",
            "version": 2,
            "parameters": {},
            "mapper": {
                "recipientId": "{{1.sender.id}}",
                "message": "{{2.data.reply}}"
            },
            "metadata": {
                "designer": {
                    "x": 600,
                    "y": 0
                },
                "parameters": [
                    {
                        "name": "connection",
                        "type": "connection",
                        "label": "Connection",
                        "required": True
                    }
                ],
                "expect": [
                    {
                        "name": "recipientId",
                        "type": "text",
                        "label": "Recipient ID",
                        "required": True
                    },
                    {
                        "name": "message",
                        "type": "text",
                        "label": "Message Text",
                        "required": True
                    }
                ]
            }
        }
    ]
}

async def create_client_scenario(public_id: str, client_name: str, platform: str = "messenger") -> Optional[dict]:
    """
    Creates a new scenario in Make.com using the blueprint for the specific client.
    Platform can be 'messenger', 'instagram', or 'whatsapp'.
    """
    if not settings.MAKE_API_TOKEN or not settings.MAKE_TEAM_ID:
        logger.error("Make.com API token or Team ID is missing in settings.")
        return None

    # Construct the webhook URL dynamically based on domain or config
    domain = settings.DOMAIN or "localhost:8000"
    scheme = "https" if "localhost" not in domain else "http"
    webhook_url = f"{scheme}://{domain}/api/webhooks/generic/{public_id}"

    # Determine module names based on platform
    trigger_module = "facebook-messenger:watchMessages"
    action_module = "facebook-messenger:sendMessage"
    
    if platform == "instagram":
        trigger_module = "instagram-business:watchEvents"
        action_module = "instagram-business:sendMessage"
    elif platform == "whatsapp":
        trigger_module = "whatsapp-business-cloud:watchEvents2"
        action_module = "whatsapp-business-cloud:sendMessage"

    # Prepare blueprint JSON
    blueprint_json = json.dumps(SCENARIO_BLUEPRINT)
    blueprint_json = blueprint_json.replace("{CLIENT_NAME}", f"{client_name} ({platform})")
    blueprint_json = blueprint_json.replace("{WEBHOOK_URL}", webhook_url)
    
    blueprint = json.loads(blueprint_json)
    
    # Update modules
    blueprint["flow"][0]["module"] = trigger_module
    blueprint["flow"][2]["module"] = action_module

    # Add missing metadata property at root level of blueprint
    blueprint["metadata"] = {
        "instant": False,
        "scenario": {
            "round": 1,
            "maxErrors": 3,
            "autoCommit": True,
            "autoCommitTriggerLast": True,
            "sequential": False,
            "confidential": False,
            "dataloss": False,
            "dlq": False,
            "freshVariables": False
        },
        "designer": {
            "orphans": []
        },
        "zone": "eu1.make.com"
    }

    # If connection ID is available in env, apply it, else Make.com will prompt user
    if settings.MAKE_CONNECTION_ID:
        # We inject the connection ID into the parameters of modules 1 and 3
        blueprint["flow"][0]["parameters"] = {"connection": int(settings.MAKE_CONNECTION_ID) if settings.MAKE_CONNECTION_ID.isdigit() else settings.MAKE_CONNECTION_ID}
        blueprint["flow"][2]["parameters"] = {"connection": int(settings.MAKE_CONNECTION_ID) if settings.MAKE_CONNECTION_ID.isdigit() else settings.MAKE_CONNECTION_ID}

    payload = {
        "name": f"VA Platform Integration - {client_name} ({platform})",
        "teamId": int(settings.MAKE_TEAM_ID) if settings.MAKE_TEAM_ID.isdigit() else settings.MAKE_TEAM_ID,
        "blueprint": json.dumps(blueprint),
        "scheduling": json.dumps({"type": "immediately"})
    }

    url = "https://eu1.make.com/api/v2/scenarios" # EU1 is the default Make API endpoint, may need adjusting based on zone (us1, eu1, eu2)
    headers = {
        "Authorization": f"Token {settings.MAKE_API_TOKEN}",
        "Content-Type": "application/json"
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            scenario_id = data.get("scenario", {}).get("id")
            team_id = data.get("scenario", {}).get("teamId", settings.MAKE_TEAM_ID)
            
            # Use a more generic URL that redirects to the correct organization edit page
            scenario_url = f"https://eu1.make.com/scenarios/{scenario_id}/edit"
            
            return {
                "scenario_id": scenario_id,
                "url": scenario_url
            }
    except httpx.HTTPStatusError as e:
        logger.error(f"Make API error: {e.response.text}")
        return {"error": f"Make API Error ({e.response.status_code}): {e.response.text}"}
    except Exception as e:
        logger.error(f"Make service error: {e}")
        return {"error": f"Internal Error: {str(e)}"}
