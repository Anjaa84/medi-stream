import { Client } from '@elastic/elasticsearch';

const ES_QUERY_TIMEOUT = '5s';

export function createElasticClient(config) {
  const client = new Client({ node: config.elasticsearchUrl });

  return {
    async connect() {
      await client.ping();
    },

    async disconnect() {
      await client.close();
    },

    async checkHealth() {
      await client.ping();
      return true;
    },

    async search({ query, from, size, sort }) {
      const response = await client.search({
        index: config.elasticsearchIndex,
        timeout: ES_QUERY_TIMEOUT,
        from,
        size,
        query,
        sort: Array.isArray(sort) && sort.length > 0 ? sort : [{ timestamp: { order: 'desc' } }]
      });

      return response;
    },

    async aggregations({ query }) {
      const response = await client.search({
        index: config.elasticsearchIndex,
        timeout: ES_QUERY_TIMEOUT,
        size: 0,
        query,
        aggs: {
          bySeverity: {
            terms: {
              field: 'severity',
              size: 10
            }
          },
          byEventType: {
            terms: {
              field: 'eventType',
              size: 10
            }
          }
        }
      });

      return response;
    }
  };
}
