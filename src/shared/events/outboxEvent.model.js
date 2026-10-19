import mongoose from 'mongoose';

const outboxEventSchema = new mongoose.Schema(
  {
    eventType: { type: String, required: true, index: true },
    aggregateType: { type: String, required: true },
    aggregateId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    rooms: [{ type: String, required: true }],
    publishedAt: { type: Date, default: null, index: true },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: null },
  },
  { timestamps: true },
);

outboxEventSchema.index({ publishedAt: 1, createdAt: 1 });

export const OutboxEvent = mongoose.model('OutboxEvent', outboxEventSchema);

