import mongoose from 'mongoose';

const patientEventSchema = new mongoose.Schema(
  {
    patientId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    eventType: {
      type: String,
      required: true,
      enum: ['admission', 'lab_result', 'vitals', 'discharge']
    },
    severity: {
      type: String,
      required: true,
      enum: ['normal', 'warning', 'critical']
    },
    department: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    timestamp: {
      type: Date,
      required: true
    }
  },
  {
    strict: 'throw',
    versionKey: false,
    timestamps: true
  }
);

patientEventSchema.index({ patientId: 1, timestamp: -1 });

export const PatientEvent = mongoose.model('PatientEvent', patientEventSchema);
