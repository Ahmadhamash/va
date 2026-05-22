# 4-Mode Prompt Configuration & AI Voice Replies

## Frontend
- [x] Update `frontend/src/pages/TrainingPage.jsx`
  - Replace `voiceMode` state with `promptMode` (default: 'default').
  - Add states: `voiceReplyEnabled` and `ttsVoice`.
  - Update parsing in `useEffect`.
  - In Mode section, render 4 options.
  - Conditionally render sections.
  - Add a new Settings section below Mode for 'Voice Replies'.
  - Update `handleSaveSettings` to use new state.
- [x] Update `frontend/src/components/ChatMessage.jsx`
  - Add `<audio>` controls correctly for voice replies.
- [x] Update `frontend/src/pages/ChatPage.jsx`
  - Handle the new SSE `audio` event using `parsed.url`.
- [x] Update `frontend/src/locales/ar.json` and `en.json`
  - Add new strings for modes, voice replies, and voices.

## Backend
- [x] Update `backend/services/ai_prompts.py` to extract settings and support 4 prompt modes.
- [x] Add `save_file_bytes` in `backend/services/file_service.py` to persist audio.
- [x] Add `generate_tts` in `backend/services/ai_media.py` utilizing OpenAI.
- [x] Update `backend/services/ai_chat.py` to handle voice reply flags, call TTS, and persist audio URLs.
- [x] Update `backend/routers/chat.py` to stream custom SSE audio events.
