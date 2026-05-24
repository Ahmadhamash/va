# AgentFlow - AI WhatsApp Customer Support SaaS

Premium Next.js SaaS demo for an AI customer support agent built around the official WhatsApp Business Platform / Cloud API approach.

This product is designed for customer-initiated support conversations and business replies. It does not include bulk messaging, scraping, or ban-evasion features.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn-style local UI components
- Framer Motion
- lucide-react icons
- Prisma ORM
- PostgreSQL
- Zustand
- WebSocket-ready live update abstraction

## Run locally

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

For the UI demo, the app runs with mock data and does not require a database connection.

For Prisma:

```bash
npx prisma generate
npx prisma db push
npm run prisma:seed
```

## Product Flow

Pages included:

- Landing / Login-style entry page
- Onboarding wizard
- Dashboard
- Inbox
- Agent Settings
- Knowledge Base
- Analytics
- Team
- Billing
- Settings

## WhatsApp Architecture

The connection layer is adapter-based:

```text
src/lib/whatsapp/types.ts
src/lib/whatsapp/WhatsAppProvider.ts
src/lib/whatsapp/WhatsAppCloudApiAdapter.ts
src/lib/whatsapp/MockWhatsAppAdapter.ts
src/lib/whatsapp/WhatsAppService.ts
```

Adapters expose:

- `connect(businessId)`
- `getStatus(businessId)`
- `sendMessage(conversationId, message)`
- `disconnect(businessId)`
- `onMessage(callback)`
- `onStatusChange(callback)`

Current providers:

- `WhatsAppCloudApiAdapter`: placeholder for official WhatsApp Business Cloud API production setup.
- `MockWhatsAppAdapter`: demo/testing provider for onboarding and inbox previews.

## API Placeholders

Implemented routes:

- `POST /api/onboarding/business`
- `POST /api/whatsapp/connect`
- `GET /api/whatsapp/status`
- `POST /api/whatsapp/demo-mode`
- `POST /api/agent/test`
- `GET /api/conversations`
- `GET /api/conversations/:id`
- `POST /api/conversations/:id/message`
- `POST /api/conversations/:id/takeover`
- `POST /api/conversations/:id/return-to-ai`
- `GET /api/knowledge`
- `POST /api/knowledge`
- `GET /api/products`
- `POST /api/products`

## AI Agent

The demo agent lives in:

```text
src/lib/agent/AgentService.ts
```

It currently uses deterministic mock logic:

- Loads mock business knowledge.
- Detects handoff keywords.
- Marks refund, cancellation, complaints, and angry messages as human handoff.
- Generates simple customer-friendly replies.

OpenAI or another model provider can be added behind this service later.

## Data Models

Prisma models include:

- User
- Business
- WhatsAppConnection
- Agent
- KnowledgeItem
- Product
- Conversation
- Message
- HandoffRule
- TeamMember
- Subscription

## Design Notes

The interface is intentionally simple for non-technical business owners:

- One clear next action per screen.
- Demo Mode available before production connection.
- Official WhatsApp Business API setup path.
- Human handoff is visible and safe.
- Dark premium dashboard by default.
- No clutter, no developer jargon in core UX.
