import { z } from "zod";

export const SettingsSchema = z.object({
  targetScore: z.number().min(0).max(5).default(4.8),
  rescanThresholdRatio: z.number().min(0).max(1).default(0.95),
  cacheExpireDays: z.number().min(0).default(14),
});

export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  targetScore: 4.8,
  rescanThresholdRatio: 0.95,
  cacheExpireDays: 14,
};
