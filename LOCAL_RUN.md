# MediStream Local Run Guide

## 1. Prerequisites

- Docker Desktop installed and running
- Node.js 20+ and npm installed

## 2. Open Project

```bash
cd /Users/anjanan/Documents/personal-projects/medi-stream
```

## 3. Create Environment File

```bash
cp .env.example .env
```

Edit `.env` and set your LLM key:

- If `LLM_PROVIDER=openai`, set `OPENAI_API_KEY`
- If `LLM_PROVIDER=anthropic`, set `ANTHROPIC_API_KEY`

## 4. Start Full Stack

```bash
docker compose up --build
```

## 5. Verify Services Are Healthy

Open a new terminal and run:

```bash
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:3004/health
curl http://localhost:3005/health
```

Expected: each service returns JSON with `status` and dependency details.

## 6. Seed Sample Data

```bash
node scripts/seed.js
```

Optional custom count:

```bash
SEED_EVENT_COUNT=50 node scripts/seed.js
```

## 7. Test Endpoints

Use `scripts/test-queries.http` (VS Code REST Client), or run example curls:

```bash
curl "http://localhost:3004/search?page=1&limit=20"
```

```bash
curl -X POST http://localhost:3005/ai-search \
  -H "Content-Type: application/json" \
  -d '{"query":"show me critical patients from cardiology this week"}'
```

## 8. Stop the Stack

```bash
docker compose down
```

## Troubleshooting

View logs for all services:

```bash
docker compose logs -f
```

View logs for one service:

```bash
docker compose logs -f patient-api
```

If ports are already in use, update port variables in `.env` and restart.
