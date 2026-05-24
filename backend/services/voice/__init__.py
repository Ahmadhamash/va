"""Voice pipeline abstraction for STT/TTS providers.

Supports:
- ElevenLabs (primary for Arabic)
- OpenAI (fallback)
- Provider auto-selection based on environment variables
"""
from services.voice.stt import STTProvider, OpenAISTT
from services.voice.tts import TTSProvider, ElevenLabsTTS, OpenAITTS
from services.voice.voice_service import VoiceService

__all__ = [
    "STTProvider",
    "OpenAISTT",
    "TTSProvider",
    "ElevenLabsTTS",
    "OpenAITTS",
    "VoiceService",
]
