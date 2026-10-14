import { z } from "zod";

export const applicationSchema = z.object({
  company: z.string().trim().min(1).max(80),
  role: z.string().trim().min(1).max(80),
  type: z.enum(["freelance", "job"]),
  source: z.enum(["upwork", "linkedin", "referral", "cold", "other"]).default("other"),
  rateEur: z.coerce.number().min(0).max(500).optional().nullable(),
  estimatedHours: z.coerce.number().min(0).max(1000).optional().nullable(),
  platformFeePct: z.coerce.number().min(0).max(40).default(0),
  status: z.enum(["applied", "interview", "offer", "won", "rejected"]),
  probability: z.coerce.number().int().min(0).max(100).optional(),
  followUpOn: z.string().datetime().optional().nullable(),
  nextAction: z.string().trim().max(200).optional().default(""),
  notes: z.string().trim().max(800).optional().default(""),
});
