import { z } from 'zod';

/**
 * A progress snapshot is the app's own data (lessons, XP, streak, practice…).
 * The server checks its envelope and size, stores it as is, and never needs to
 * understand the details: merging happens on the device.
 */
export const SnapshotSchema = z.looseObject({
  schemaVersion: z.number().int().positive(),
  createdAt: z.string().max(40).optional(),
});

export const PutProgressSchema = z.object({
  /** The revision the device last saw; the upload only wins if nothing newer is stored. */
  baseRevision: z.number().int().min(0),
  snapshot: SnapshotSchema,
});

export type PutProgressBody = z.infer<typeof PutProgressSchema>;
