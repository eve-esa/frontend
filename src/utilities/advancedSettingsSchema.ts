import { z } from "zod";
import { OptionSchema } from "@/types";

// Lives outside SettingsForm so that utilities (messageDefaultSettings,
// helpers) can use the type without importing a React component.
export const AdvancedSettingsSchema = z.object({
  score_threshold: z.number(),
  temperature: z.number(),
  year: z
    .object({
      startYear: z.number().optional(),
      endYear: z.number().optional(),
    })
    .optional(),
  journal: z.string().optional(),
  thematic_perspective: OptionSchema.optional(),
  scientific_and_technical: OptionSchema.optional(),
  market_perspective: OptionSchema.optional(),
  n_citations: z
    .number()
    .max(500000, { message: "Value must be less than 500000" })
    .optional(),
  k: z.number().optional(),
});

export type AdvancedSettingsValidation = z.infer<typeof AdvancedSettingsSchema>;
