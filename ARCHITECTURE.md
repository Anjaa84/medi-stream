# MediStream Architecture

## Overview

MediStream is organized as a set of focused backend microservices for ingesting, transporting, indexing, and querying healthcare event data in near real time.

## Services and Responsibilities

### `patient-api`

Responsibilities:

- Receives patient event payloads from clients.
- Applies strict input validation and request guardrails.
- Stores raw event records in MongoDB.
- Publishes validated events to Kafka (through shared producer module).

Key interfaces:

- `POST /events`
- `GET /events/:patientId`
- `GET /health`

Dependencies:

- MongoDB
- Kafka (`event-producer` module)

### `event-producer`

Responsibilities:

- Provides reusable Kafka publishing logic for patient events.
- Enforces consistent message schema (`headers`, `key`, `value`).
- Retries publish operations and routes hard failures to DLQ.

Key interfaces:

- Module export used by `patient-api`
- `GET /health` (service mode)

Dependencies:

- Kafka

### `indexer-service`

Responsibilities:

- Consumes events from Kafka topic `patient.events`.
- Verifies and creates Elasticsearch index/mapping at startup.
- Indexes events into Elasticsearch for search.
- Retries failed index operations and publishes final failures to DLQ.

Key interfaces:

- Kafka consumer loop
- `GET /health`

Dependencies:

- Kafka
- Elasticsearch

### `query-service`

Responsibilities:

- Exposes REST search API over Elasticsearch.
- Translates query params into Elasticsearch DSL.
- Returns paginated search results and aggregations.
- Accepts validated raw DSL for AI-assisted query execution.

Key interfaces:

- `GET /search`
- `GET /search/aggregations`
- `POST /search/dsl`
- `GET /health`

Dependencies:

- Elasticsearch

### `ai-query-service`

Responsibilities:

- Accepts natural language search requests.
- Uses configurable LLM provider (OpenAI or Anthropic) to generate Elasticsearch DSL.
- Validates LLM output (JSON + allowed fields) before execution.
- Forwards validated DSL to `query-service`.

Key interfaces:

- `POST /ai-search`
- `GET /health`

Dependencies:

- LLM provider API
- `query-service`

### `shared`

Responsibilities:

- Holds shared constants and common definitions used across services.

## Data and Message Flow

1. Client submits medical event to `patient-api`.
2. `patient-api` validates and stores raw event in MongoDB.
3. `patient-api` publishes event to Kafka topic `patient.events`.
4. `indexer-service` consumes from Kafka and indexes into Elasticsearch.
5. Client queries indexed data via `query-service` (`/search` or `/search/aggregations`).
6. For natural language search, client calls `ai-query-service`.
7. `ai-query-service` generates and validates DSL, then calls `query-service /search/dsl`.
8. `query-service` executes DSL against Elasticsearch and returns results.

## Contracts

### Event Contract (Kafka + persistence)

```json
{
  "patientId": "string",
  "eventType": "admission|lab_result|vitals|discharge",
  "severity": "normal|warning|critical",
  "department": "string",
  "data": {},
  "timestamp": "ISO-8601"
}
```

### Kafka Topics

- Primary: `patient.events`
- Dead-letter: `patient.events.dlq`

## Storage Boundaries

- MongoDB: raw event source of truth for ingestion records.
- Elasticsearch: optimized read model for full-text/filter/aggregation queries.

## Operational Notes

- All services emit `X-Request-ID` in responses for request correlation.
- Services fail fast on missing required environment variables.
- `/health` endpoints expose dependency status for local orchestration and observability.
