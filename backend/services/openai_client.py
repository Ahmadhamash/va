"""Shared OpenAI client cache.

Keeps API clients bounded and reusable across the AI pipeline so every router,
verifier, humanizer, or local-LLM call does not create a fresh HTTP client.
"""
from __future__ import annotations

from dataclasses import dataclass
from time import monotonic

from openai import AsyncOpenAI


DEFAULT_TIMEOUT_SECONDS = 30.0
MAX_CACHED_CLIENTS = 64


@dataclass
class _ClientEntry:
    client: AsyncOpenAI
    last_used: float


_clients: dict[tuple[str | None, str, float], _ClientEntry] = {}


def get_openai_client(
    api_key: str,
    *,
    base_url: str | None = None,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
) -> AsyncOpenAI:
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")

    key = (base_url, api_key, float(timeout))
    now = monotonic()
    entry = _clients.get(key)
    if entry is not None:
        entry.last_used = now
        return entry.client

    if len(_clients) >= MAX_CACHED_CLIENTS:
        oldest_key = min(_clients, key=lambda item: _clients[item].last_used)
        _clients.pop(oldest_key, None)

    kwargs = {"api_key": api_key, "timeout": timeout}
    if base_url:
        kwargs["base_url"] = base_url
    client = AsyncOpenAI(**kwargs)
    _clients[key] = _ClientEntry(client=client, last_used=now)
    return client


def clear_openai_client_cache() -> None:
    _clients.clear()
