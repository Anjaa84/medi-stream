export const PATIENT_EVENTS_INDEX_MAPPING = {
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

export const ALLOWED_FIELDS = new Set([
  'patientId',
  'eventType',
  'severity',
  'department',
  'department.keyword',
  'timestamp'
]);
