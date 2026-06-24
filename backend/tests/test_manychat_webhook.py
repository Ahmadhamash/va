from starlette.requests import Request

from routers.webhooks import (
    _manychat_channel,
    _manychat_external_response,
    _manychat_public_media_url,
    _manychat_response,
    _manychat_sender_id,
    _manychat_text,
)


def test_manychat_external_request_response_is_flat():
    assert _manychat_external_response("hello") == {
        "ai_reply": "hello",
        "reply": "hello",
        "audio_url": "",
        "has_audio": False,
    }


def test_manychat_dynamic_response_supports_text_and_audio():
    response = _manychat_response(
        "hello",
        "messenger",
        audio_url="https://assistant.example.com/audio.mp3",
        delivery="text_and_voice",
    )
    assert response["content"]["messages"] == [
        {"type": "text", "text": "hello"},
        {"type": "audio", "url": "https://assistant.example.com/audio.mp3"},
    ]


def test_manychat_voice_only_falls_back_to_text_without_audio():
    response = _manychat_response("hello", "messenger", delivery="voice")
    assert response["content"]["messages"] == [{"type": "text", "text": "hello"}]


def test_manychat_voice_only_returns_audio_when_audio_url_present():
    response = _manychat_response(
        "hello",
        "messenger",
        audio_url="https://assistant.example.com/audio.mp3",
        delivery="voice",
    )
    assert response["content"]["messages"] == [
        {"type": "audio", "url": "https://assistant.example.com/audio.mp3"},
    ]


def test_manychat_dynamic_block_response_shape():
    response = _manychat_response(
        "hello",
        "messenger",
        audio_url="https://assistant.example.com/audio.mp3",
        delivery="text_and_voice",
    )
    assert response["version"] == "v2"
    assert "content" in response
    assert "messages" in response["content"]
    assert response["content"]["messages"] == [
        {"type": "text", "text": "hello"},
        {"type": "audio", "url": "https://assistant.example.com/audio.mp3"},
    ]


def test_manychat_public_media_url_is_https_and_signed(monkeypatch):
    monkeypatch.setattr("routers.webhooks.settings.DOMAIN", "assistant.example.com")
    url = _manychat_public_media_url("customer/audio.mp3")
    assert url.startswith("https://assistant.example.com/api/uploads/customer/audio.mp3?")
    assert "media_token=" in url


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
