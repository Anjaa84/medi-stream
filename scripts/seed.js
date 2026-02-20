#!/usr/bin/env node
import { randomUUID } from 'node:crypto';

const EVENT_TYPES = ['admission', 'lab_result', 'vitals', 'discharge'];
const SEVERITIES = ['normal', 'warning', 'critical'];
const DEPARTMENTS = ['cardiology', 'neurology', 'oncology', 'emergency', 'icu', 'orthopedics'];
const LAB_TESTS = ['CBC', 'CMP', 'Troponin', 'Lipid Panel', 'A1C'];
const SYMPTOMS = ['chest pain', 'headache', 'shortness of breath', 'fever', 'dizziness'];
const PATIENT_IDS = Array.from({ length: 20 }, (_, idx) => `P-${String(idx + 1).padStart(4, '0')}`);

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomTimestampWithinLastDays(days = 7) {
  const now = Date.now();
  const windowMs = days * 24 * 60 * 60 * 1000;
  return new Date(now - Math.floor(Math.random() * windowMs)).toISOString();
}

function buildEventData(eventType) {
  if (eventType === 'admission') {
    return {
      reason: pick(SYMPTOMS),
      room: `R-${randomInt(100, 599)}`,
      attendingPhysician: `Dr. ${pick(['Miller', 'Rao', 'Kim', 'Patel', 'Lopez'])}`
    };
  }

  if (eventType === 'lab_result') {
    return {
      testName: pick(LAB_TESTS),
      resultValue: Number((Math.random() * 200).toFixed(2)),
      unit: pick(['mg/dL', 'g/dL', 'mmol/L']),
      flagged: Math.random() > 0.7
    };
  }

  if (eventType === 'vitals') {
    return {
      heartRate: randomInt(55, 145),
      bloodPressure: `${randomInt(90, 170)}/${randomInt(60, 110)}`,
      temperatureC: Number((36 + Math.random() * 3).toFixed(1)),
      spo2: randomInt(88, 100)
    };
  }

  return {
    dischargeDisposition: pick(['home', 'rehab', 'transferred']),
    followUpDays: randomInt(3, 30),
    notes: pick(['stable', 'requires monitoring', 'improved symptoms'])
  };
}

function buildEvent() {
  const eventType = pick(EVENT_TYPES);
  const severity = pick(SEVERITIES);

  return {
    patientId: pick(PATIENT_IDS),
    eventType,
    severity,
    department: pick(DEPARTMENTS),
    data: buildEventData(eventType),
    timestamp: randomTimestampWithinLastDays(10)
  };
}

async function main() {
  const patientApiBaseUrl =
    process.env.PATIENT_API_URL ||
    `http://localhost:${process.env.PATIENT_API_PORT || '3001'}`;

  const total = Number(process.env.SEED_EVENT_COUNT || '50');
  if (!Number.isInteger(total) || total <= 0) {
    throw new Error('SEED_EVENT_COUNT must be a positive integer');
  }

  console.log(`[seed] target=${patientApiBaseUrl} count=${total}`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < total; i += 1) {
    const event = buildEvent();
    const requestId = randomUUID();

    try {
      const response = await fetch(`${patientApiBaseUrl}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId
        },
        body: JSON.stringify(event)
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        failed += 1;
        console.error(
          `[seed] failed index=${i + 1} status=${response.status} requestId=${requestId} error=${body.error || 'unknown'}`
        );
        continue;
      }

      success += 1;
      console.log(`[seed] sent index=${i + 1} patientId=${event.patientId} eventType=${event.eventType}`);
    } catch (error) {
      failed += 1;
      console.error(`[seed] failed index=${i + 1} requestId=${requestId} error=${error.message}`);
    }
  }

  console.log(`[seed] completed success=${success} failed=${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`[seed] fatal error: ${error.message}`);
  process.exit(1);
});
