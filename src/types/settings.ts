import { z } from "zod";

export const SettingsSchema = z.object({
  targetScore: z.coerce
    .number()
    .transform((val) => Math.max(0.0, Math.min(5.0, val)))
    .default(4.8),
  rescanThreshold: z.coerce
    .number()
    .transform((val) => Math.max(0, Math.min(100, val)))
    .default(95),
  cacheExpireDays: z.coerce
    .number()
    .transform((val) => Math.max(0, val))
    .default(14),
  requestDelayMs: z.coerce
    .number()
    .transform((val) => Math.max(0, val))
    .default(800),
});

export type Settings = z.infer<typeof SettingsSchema>;
