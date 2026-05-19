"""Parse an uploaded conversation export into short style examples.

The goal is to capture *how the client talks* (tone, phrasing, emoji) — never
facts. Samples are later injected into the system prompt as voice references;
the strict DB-only / function-calling guarantee is untouched.

Supported uploads: .txt (WhatsApp-style export), .json (Messenger/IG/WhatsApp
JSON or a list of {sender,text}), .csv (sender/text columns).
"""
import csv
import io
import json
import re

MAX_SAMPLES = 40
MAX_SAMPLE_LEN = 320

_SPEAKER_KEYS = ("sender", "from", "name", "author", "role", "sender_name", "user")
_TEXT_KEYS = ("text", "message", "content", "body", "msg")

# WhatsApp txt:  "12/05/2026, 21:47 - Ahmad: hello"  or  "[12/05/26, 9:47:01 PM] Ahmad: hi"
_WA_LINE = re.compile(
    r"^\s*\[?\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}[,]?\s*[\d:apmAPM\s]*\]?\s*[-–]?\s*"
    r"(?P<name>[^:]{1,60}?):\s*(?P<msg>.+)$"
)
# Generic "Name: message"
_SIMPLE_LINE = re.compile(r"^\s*(?P<name>[^:]{1,40}?):\s*(?P<msg>.+)$")

_SKIP = {
    "<media omitted>",
    "<media غير مضمنة>",
    "this message was deleted",
    "تم حذف هذه الرسالة",
    "image omitted",
    "video omitted",
}


def _clean(text: str) -> str:
    text = re.sub(r"\s+", " ", (text or "").strip())
    return text[:MAX_SAMPLE_LEN]


def _is_noise(text: str) -> bool:
    low = text.strip().lower()
    return not low or low in _SKIP or low.startswith("http") and " " not in low


def _parse_txt(raw: str) -> list[tuple[str, str]]:
    turns: list[tuple[str, str]] = []
    for line in raw.splitlines():
        m = _WA_LINE.match(line) or _SIMPLE_LINE.match(line)
        if m:
            turns.append((m.group("name").strip(), m.group("msg").strip()))
        elif turns and line.strip():
            # continuation of the previous multi-line message
            spk, prev = turns[-1]
            turns[-1] = (spk, f"{prev} {line.strip()}")
    return turns


def _parse_json(raw: str) -> list[tuple[str, str]]:
    data = json.loads(raw)
    if isinstance(data, dict):
        for key in ("messages", "conversation", "chats", "data"):
            if isinstance(data.get(key), list):
                data = data[key]
                break
        else:
            data = [data]
    turns: list[tuple[str, str]] = []
    if isinstance(data, list):
        for entry in data:
            if not isinstance(entry, dict):
                continue
            speaker = next(
                (str(entry[k]) for k in _SPEAKER_KEYS if entry.get(k)), "unknown"
            )
            text = next(
                (str(entry[k]) for k in _TEXT_KEYS if entry.get(k)), ""
            )
            if text:
                turns.append((speaker.strip(), text.strip()))
    return turns


def _parse_csv(raw: str) -> list[tuple[str, str]]:
    turns: list[tuple[str, str]] = []
    reader = csv.DictReader(io.StringIO(raw))
    if not reader.fieldnames:
        return turns
    cols = {c.lower().strip(): c for c in reader.fieldnames}
    spk_col = next((cols[k] for k in _SPEAKER_KEYS if k in cols), None)
    txt_col = next((cols[k] for k in _TEXT_KEYS if k in cols), None)
    for row in reader:
        speaker = (row.get(spk_col) if spk_col else "unknown") or "unknown"
        text = (row.get(txt_col) if txt_col else "") or ""
        if text.strip():
            turns.append((speaker.strip(), text.strip()))
    return turns


def parse_conversation(filename: str, raw_bytes: bytes) -> list[tuple[str, str]]:
    raw = raw_bytes.decode("utf-8", errors="ignore")
    ext = (filename.rsplit(".", 1)[-1] if "." in filename else "").lower()
    if ext == "json":
        return _parse_json(raw)
    if ext == "csv":
        return _parse_csv(raw)
    return _parse_txt(raw)


def build_samples(
    turns: list[tuple[str, str]], my_name: str | None
) -> list[str]:
    """Turn ordered (speaker, text) turns into short style examples.

    If `my_name` is given, build "Customer → You" pairs showing how the client
    replies. Otherwise keep representative single lines as tone references.
    """
    samples: list[str] = []
    seen: set[str] = set()
    my = (my_name or "").strip().lower()

    def add(s: str) -> None:
        s = _clean(s)
        key = s.lower()
        if s and key not in seen and not _is_noise(s):
            seen.add(key)
            samples.append(s)

    if my:
        for i, (speaker, text) in enumerate(turns):
            if speaker.lower() != my or _is_noise(text):
                continue
            prev = next(
                (
                    t
                    for s, t in reversed(turns[:i])
                    if s.lower() != my and not _is_noise(t)
                ),
                None,
            )
            if prev:
                add(f"Customer: {prev}\nYou: {text}")
            else:
                add(f"You: {text}")
            if len(samples) >= MAX_SAMPLES:
                break
    else:
        for speaker, text in turns:
            if not _is_noise(text):
                add(f"{speaker}: {text}")
            if len(samples) >= MAX_SAMPLES:
                break

    return samples
