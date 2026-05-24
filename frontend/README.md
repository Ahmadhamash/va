# Masar Frontend

Next.js frontend for the Masar AI customer support platform. Connects to the FastAPI backend for all data and authentication.

## Stack

- Next.js 16 App Router
- TypeScript
- Tailwind CSS
- shadcn-style local UI components
- Framer Motion
- lucide-react icons
- Zustand (client state)

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The frontend expects the backend at `http://localhost:8000`.

## Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Key variable:

```bash
# Local development
NEXT_PUBLIC_API_URL=http://localhost:8000/api

# Production (behind Caddy reverse proxy)
NEXT_PUBLIC_API_URL=/api
```

## Pages

| Page | Description | Backend Endpoints |
|---|---|---|
| Landing | Public marketing page | — |
| Login | Backend auth | `POST /api/auth/login` |
| Register | Create account | `POST /api/auth/register`, `GET /api/business-types` |
| Dashboard | Channels, conversations, handoffs | `GET /api/channels`, `GET /api/chat/sessions`, `GET /api/handoff/` |
| Inbox | Live chat with backend AI | `GET /api/chat/sessions`, `POST /api/chat/send` |
| Knowledge | Catalog & policies | `GET /api/items`, `GET /api/policies` |
| Onboarding | Setup wizard | `POST /api/chat/send` |
| Agent Settings | AI behavior config | Local state (UI-only) |
| Analytics | Performance metrics | Mock data (no backend endpoint yet) |
| Billing | Plan selection | Static display |
| Team | Team management | Local state (UI-only) |
| Settings | Business profile | Local state (UI-only) |

## Production Deployment

In production, this runs as a Docker container behind Caddy:

- Caddy routes `/api/*` → FastAPI backend
- Caddy routes everything else → this frontend on port 3000
- `NEXT_PUBLIC_API_URL=/api` is baked in at build time

```bash
docker compose -f docker-compose.prod.yml build frontend
docker compose -f docker-compose.prod.yml up -d frontend
```

## Design Notes

- Dark premium dashboard by default
- RTL-friendly Arabic interface
- Simple UX for non-technical business owners
- Human handoff visibility
- Demo mode available before production channel connection
