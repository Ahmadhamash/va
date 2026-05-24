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
| Queue | Redis + ARQ worker (debounced async processing) |
| Auth | JWT (python-jose) · bcrypt |
| AI | OpenAI GPT-4o (text + vision) · Whisper · function calling |
| Frontend | Next.js App Router · React 18 · TypeScript · Tailwind CSS |
| Infra | Docker · docker-compose · nginx · Caddy (auto-HTTPS, prod) |

## Scale & reliability

- **Message debouncing**: a customer who splits one question across several
  messages ("كم" / "سعر" / "السماعة") is answered once. Inbound channel
  messages are buffered; an 8-second (configurable) Redis-coalesced ARQ job
  answers the whole batch — only the last message's job does the work.
- **Async worker**: Messenger/Instagram/widget replies are produced off the
  request path by the `worker` service, so the API stays responsive with many
  concurrent stores. Horizontally scalable (run more `worker`/`backend`).
- **Generic webhook** stays synchronous request/response (it's an API).
- **Runtime config**: the admin rotates the OpenAI key / model / debounce from
  the dashboard (DB-backed, overrides `.env`, no redeploy).
- **Hardening**: Redis-backed rate limiting (tighter on auth), security
  headers, body-size guard, non-root containers, multi-worker uvicorn.

## Quick start (Docker — one command)

```bash
cp .env.example .env
# edit .env and set a real OPENAI_API_KEY and a strong SECRET_KEY
docker compose up --build
```

- Frontend: http://localhost:3000
- API + Swagger docs: http://localhost:8000/api/docs
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
cd whatsapp-agent-saas
npm install
npm run dev          # http://localhost:3000
```

Set `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000/api` locally and `/api` in production) if the API is elsewhere.

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
- `POST /api/auth/register` → `{ access_token }` (first account = admin)
- `POST /api/auth/login` → `{ access_token }`
- `GET  /api/auth/me` (includes `role`)

### Admin (admin-only)
- `GET   /api/admin/clients` — all clients + item/chat/voice counts
- `GET   /api/admin/clients/{id}`
- `PUT   /api/admin/clients/{id}/persona` — set/override AI persona
- `PATCH /api/admin/clients/{id}/active` — enable/disable account
- `GET   /api/admin/clients/{id}/items`
- `GET   /api/admin/clients/{id}/sessions`
- `GET   /api/admin/clients/{id}/sessions/{sid}/messages`

### Items (client; scoped to the authenticated owner)
- `GET /api/items` · `POST /api/items` · `PUT /api/items/{id}` · `DELETE /api/items/{id}`
- `PATCH /api/items/{id}/toggle` · `GET /api/items/search?q=…`

### Chat (client)
- `POST /api/chat/send` — multipart: `message`, optional `session_id`,
  optional `file` (image or audio). Creates a session if none is given.
- `GET /api/chat/sessions` · `GET /api/chat/sessions/{id}/messages` ·
  `DELETE /api/chat/sessions/{id}`

### AI Voice / style training (client)
- `POST   /api/style/upload` — multipart: `file` (.txt/.json/.csv), optional
  `my_name`. Parses your past chats into voice samples.
- `GET    /api/style/samples` · `DELETE /api/style/samples/{id}` ·
  `DELETE /api/style/samples` (clear all)

### Channels (client) + public webhooks
- `POST /api/channels` (`platform` = messenger|instagram|webhook|widget,
  `credentials`), `GET /api/channels`, `PATCH /api/channels/{id}/toggle`,
  `DELETE /api/channels/{id}` — returns per-channel callback/inbound/widget URLs
- Public, routed by unguessable `public_id`:
  - `GET|POST /api/webhooks/meta/{public_id}` — Meta verify + Messenger/IG events
  - `POST /api/webhooks/generic/{public_id}` — `{sender_id, message}` → `{reply}`
  - `POST /api/webhooks/widget/{public_id}/message` + `GET /api/widget/{public_id}.js`
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
backend/              FastAPI app, models, routers, services, Alembic migrations
whatsapp-agent-saas/  Next.js SaaS frontend connected to the backend API
uploads/              user media (mounted into the backend container, served read-only)
docker-compose.yml
.env.example
```

## Production deployment (Docker + Caddy, auto-HTTPS)

On any VPS with Docker + a domain whose DNS A record points at the server:

```bash
git clone <repo> && cd <repo>
cp .env.prod.example .env
#   set DOMAIN, ACME_EMAIL, OPENAI_API_KEY, and strong
#   SECRET_KEY (openssl rand -hex 32) + DB password
docker compose -f docker-compose.prod.yml up -d --build

# create the platform admin
docker compose -f docker-compose.prod.yml exec backend \
  python -m scripts.create_admin --username admin --email you@x.com --password '••••'
```

- Caddy obtains/renews Let's Encrypt certs automatically and routes
  `https://DOMAIN` → SPA, API/webhook/upload paths → backend.
- Only ports 80/443 are public; db/redis/backend/worker are internal.
- Scale out: `docker compose -f docker-compose.prod.yml up -d --scale worker=3
  --scale backend=2` (rate limits & debounce are Redis-shared, so this is safe).
- Meta webhooks now have a real HTTPS URL — no ngrok needed in prod.

## Notes / hardening

- Uploads validated by **MIME type + extension**, size-capped, stored under
  `uploads/{user_id}/…`; product images via `POST /api/items/{id}/image`.
- Async SQLAlchemy `pool_size=20, max_overflow=40`; 4 uvicorn workers.
- Chat history capped at the last 20 turns per session.
- Redis-backed rate limiting, security-headers + body-size middleware,
  non-root containers, internal errors never leaked.
- Arabic/Latin mixing fixed end-to-end (prompt rule + `dir="auto"` /
  `unicode-bidi:plaintext` in the UI and widget).
- To swap local storage for S3, replace `services/file_service.py`.
```
