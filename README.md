# AI-Powered Business Assistant Platform

Multi-tenant SaaS. A platform **admin** manages client business owners; each
**client** manages a product/service catalog. An AI assistant answers end-
customer queries **only** from real database data (zero hallucination, enforced
via OpenAI function calling), understands **text, images, and audio**, can be
taught to **talk in the client's own voice** from uploaded chat history, and
replies across **Messenger / Instagram / a generic webhook / an embeddable web
widget**.

## Roles

| Role | Gets it by | Can do |
|------|-----------|--------|
| **admin** | the **first account** registered on a fresh DB, or `scripts.create_admin` | see all clients, set/override each client's AI persona, enable/disable accounts, review any client's catalog & conversations |
| **client** | every later registration | manage catalog, upload conversation history (AI Voice), connect channels, test chat. Persona is set by the admin. |

## Stack

| Layer | Tech |
|-------|------|
| Backend | FastAPI · Python 3.11 · async SQLAlchemy 2 · Alembic |
| Database | PostgreSQL 16 |
| Auth | JWT (python-jose) · bcrypt |
| AI | OpenAI GPT-4o (text + vision) · Whisper · function calling |
| Frontend | React 18 · Vite · Tailwind CSS · React Router |
| Infra | Docker · docker-compose · nginx (frontend) |

## Quick start (Docker — one command)

```bash
cp .env.example .env
# edit .env and set a real OPENAI_API_KEY and a strong SECRET_KEY
docker compose up --build
```

- Frontend: http://localhost:3000
- API + Swagger docs: http://localhost:8000/docs
- Database: localhost:5432

The backend container runs `alembic upgrade head` automatically before serving,
so the schema is created on first boot.

## Local development (without Docker)

**Backend**

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
# Ensure Postgres is running and DATABASE_URL in ../.env points to it
alembic upgrade head
uvicorn main:app --reload --port 8000
```

**Frontend**

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

Set `VITE_API_URL` (defaults to `http://localhost:8000`) if the API is elsewhere.

## Environment variables

See [`.env.example`](.env.example). Key ones:

| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | async Postgres DSN (`postgresql+asyncpg://…`). Auto-pointed at the `db` service under compose. |
| `OPENAI_API_KEY` | required for chat/vision/audio |
| `SECRET_KEY` | JWT signing key (≥ 32 chars) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | token lifetime (default 7 days) |
| `MAX_FILE_SIZE_MB` | upload ceiling (images 20 MB, audio 25 MB enforced in code) |
| `CORS_ORIGINS` | JSON list or comma-separated origins |

## API

### Auth
- `POST /auth/register` → `{ access_token }` (first account = admin)
- `POST /auth/login` → `{ access_token }`
- `GET  /auth/me` (includes `role`)

### Admin (admin-only)
- `GET   /admin/clients` — all clients + item/chat/voice counts
- `GET   /admin/clients/{id}`
- `PUT   /admin/clients/{id}/persona` — set/override AI persona
- `PATCH /admin/clients/{id}/active` — enable/disable account
- `GET   /admin/clients/{id}/items`
- `GET   /admin/clients/{id}/sessions`
- `GET   /admin/clients/{id}/sessions/{sid}/messages`

### Items (client; scoped to the authenticated owner)
- `GET /items` · `POST /items` · `PUT /items/{id}` · `DELETE /items/{id}`
- `PATCH /items/{id}/toggle` · `GET /items/search?q=…`

### Chat (client)
- `POST /chat/send` — multipart: `message`, optional `session_id`,
  optional `file` (image or audio). Creates a session if none is given.
- `GET /chat/sessions` · `GET /chat/sessions/{id}/messages` ·
  `DELETE /chat/sessions/{id}`

### AI Voice / style training (client)
- `POST   /style/upload` — multipart: `file` (.txt/.json/.csv), optional
  `my_name`. Parses your past chats into voice samples.
- `GET    /style/samples` · `DELETE /style/samples/{id}` ·
  `DELETE /style/samples` (clear all)

### Channels (client) + public webhooks
- `POST /channels` (`platform` = messenger|instagram|webhook|widget,
  `credentials`), `GET /channels`, `PATCH /channels/{id}/toggle`,
  `DELETE /channels/{id}` — returns per-channel callback/inbound/widget URLs
- Public, routed by unguessable `public_id`:
  - `GET|POST /webhooks/meta/{public_id}` — Meta verify + Messenger/IG events
  - `POST /webhooks/generic/{public_id}` — `{sender_id, message}` → `{reply}`
  - `POST /webhooks/widget/{public_id}/message` + `GET /widget/{public_id}.js`
    (embeddable chat bubble)

### Bootstrap an admin

The first registered account is the admin automatically. To create/promote one
explicitly (e.g. existing DB):

```bash
# inside the backend container or venv
python -m scripts.create_admin --username admin --email a@x.com --password secret
# docker: docker compose exec backend python -m scripts.create_admin --username admin --email a@x.com --password secret
```

## How hallucination is prevented

1. The model is given **only** four DB-backed tools (`get_all_items`,
   `search_items`, `get_item_details`, `get_categories`) — all strictly scoped
   to the owner's `user_id`.
2. System prompt forbids inventing products/prices and forces a tool call
   before any product answer.
3. `temperature=0.3`, `tool_choice="auto"`, bounded tool-call loop.
4. Empty DB results return `{"result": "no items found"}` so the model can't
   "fill in the blanks".
5. Uploaded voice samples are injected as **style-only** references — the
   prompt explicitly forbids reusing any product/price/fact from them.

## Project layout

```
backend/   FastAPI app, models, routers, services, Alembic migrations
frontend/  Vite + React 18 + Tailwind SPA
uploads/   user media (mounted into the backend container, served read-only)
docker-compose.yml
.env.example
```

## Notes / production hardening

- Uploads validated by **MIME type + extension**, size-capped, stored under
  `uploads/{user_id}/…` and served read-only from `/uploads`.
- Async SQLAlchemy with `pool_size=20, max_overflow=40`.
- Chat history capped at the last 20 turns per session to bound token usage.
- Internal errors are logged and never leaked to clients.
- To swap local storage for S3, replace `services/file_service.py`
  (`save_upload` / `resolve_path` / `encode_image_base64`).
```
