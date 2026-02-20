import { Client } from '@elastic/elasticsearch';

const PATIENT_EVENTS_INDEX_MAPPING = {
  dynamic: false,
  properties: {
    patientId: { type: 'keyword' },
    eventType: { type: 'keyword' },
    severity: { type: 'keyword' },
    department: {
      type: 'text',
      fields: {
        keyword: { type: 'keyword' }
      }
    },
    data: {
      type: 'object',
      dynamic: true
    },
    timestamp: { type: 'date' }
  }
};

export function createElasticClient(config) {
  const client = new Client({ node: config.elasticsearchUrl });

  return {
    async connect() {
      await client.ping();
    },

    async ensurePatientEventsIndex() {
      const existsResponse = await client.indices.exists({ index: config.elasticsearchIndex });
      const exists = existsResponse === true || existsResponse?.body === true;
      if (exists) {
        return;
      }

      await client.indices.create({
        index: config.elasticsearchIndex,
        mappings: PATIENT_EVENTS_INDEX_MAPPING
      });
    },

    async indexEvent(event) {
      await client.index({
        index: config.elasticsearchIndex,
        document: {
          patientId: event.patientId,
          eventType: event.eventType,
          severity: event.severity,
          department: event.department,
          data: event.data,
          timestamp: event.timestamp
        }
      });
    },

    async checkHealth() {
      await client.ping();
      return true;
    },

    async disconnect() {
      await client.close();
    }
  };
}
