import { HttpError } from './errors.js';

export function createQueryServiceClient(config) {
  return {
    async executeDslSearch({ dsl, requestId }) {
      const response = await fetch(`${config.queryServiceUrl}/search/dsl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId
        },
        body: JSON.stringify({
          dsl,
          page: 1,
          limit: 20
        })
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new HttpError(502, payload.error || 'query-service request failed');
      }

      return payload;
    },

    async checkHealth(requestId) {
      const response = await fetch(`${config.queryServiceUrl}/health`, {
        headers: {
          'X-Request-ID': requestId
        }
      });

      if (!response.ok) {
        throw new Error('query-service health check failed');
      }

      return true;
    }
  };
}
