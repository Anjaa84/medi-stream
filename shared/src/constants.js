export const KAFKA_TOPICS = {
  PATIENT_EVENTS: 'patient.events',
  PATIENT_EVENTS_DLQ: 'patient.events.dlq'
};

export const EVENT_TYPES = ['admission', 'lab_result', 'vitals', 'discharge'];

export const SEVERITY_LEVELS = ['normal', 'warning', 'critical'];

export const ELASTICSEARCH_INDEX = 'patient-events';
