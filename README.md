# MediStream

MediStream is a microservices-based backend MVP for real-time healthcare event processing. It demonstrates a portfolio-ready architecture for Node.js backend roles in healthcare domains.

## Architecture Overview

MediStream ingests patient events, transports them through Kafka, stores raw records in MongoDB, indexes searchable records in Elasticsearch, and supports AI-assisted search query generation.

### Services

- `patient-api`: Receives patient events via REST API and (in later steps) persists to MongoDB and publishes to Kafka.
- `event-producer`: Dedicated Kafka publishing module/service.
- `indexer-service`: Consumes events from Kafka and indexes into Elasticsearch.
- `query-service`: Exposes REST search endpoints backed by Elasticsearch.
- `ai-query-service`: Converts natural language requests into Elasticsearch DSL queries.
- `shared`: Common constants and shared definitions.

## Monorepo Structure

```text
.
├── ai-query-service
├── event-producer
├── indexer-service
├── patient-api
├── query-service
├── shared
├── docker-compose.yml
├── package.json
└── .env.example
```

## Infrastructure (Docker Compose)

`docker-compose.yml` provisions:

- Kafka + Zookeeper
- MongoDB
- Elasticsearch (single-node)
- All MediStream services with source volume mounts for hot reload

## Quick Start

1. Copy environment file:

```bash
cp .env.example .env
```

2. Start the full stack:

```bash
npm run up
```

3. Stop the stack:

```bash
npm run down
```

## Environment Variable Validation

Every service validates required environment variables at startup. If any required variable is missing, the service exits immediately with a clear error message listing missing keys.

## Step 1 Status

Step 1 scaffolding is complete:

- Monorepo structure created
- Docker Compose stack defined
- Root workspace scripts added
- `.env.example` created
- Per-service startup env validation added
- Baseline `GET /health` + `X-Request-ID` middleware scaffolded for all services
