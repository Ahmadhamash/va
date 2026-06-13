from starlette.requests import Request

from routers.webhooks import (
    _manychat_channel,
    _manychat_response,
    _manychat_sender_id,
    _manychat_text,
)


def _request(query_string: str = "") -> Request:
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/api/webhooks/manychat/test",
            "query_string": query_string.encode(),
            "headers": [],
        }
    )


def test_manychat_channel_defaults_to_facebook_messenger():
    channel = _manychat_channel(_request(), {"platform": "facebook"})
    response = _manychat_response("hello", channel)

    assert channel == "messenger"
    assert response["version"] == "v2"
    assert "type" not in response["content"]
    assert response["content"]["messages"] == [{"type": "text", "text": "hello"}]


def test_manychat_instagram_response_sets_content_type():
    channel = _manychat_channel(_request("platform=instagram"), {})
    response = _manychat_response("hello", channel)

    assert channel == "instagram"
    assert response["content"]["type"] == "instagram"
    assert response["content"]["messages"] == [{"type": "text", "text": "hello"}]


def test_manychat_reads_nested_contact_payload():
    body = {
        "contact": {
            "id": "subscriber-123",
            "last_input_text": "I need a price",
        }
    }

    assert _manychat_sender_id(body) == "subscriber-123"
    assert _manychat_text(body) == "I need a price"
