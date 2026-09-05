import { z } from 'zod';
import { initialCourses } from '@/features/curriculum/fixture';
import type { PlacementResult } from './score';

const schema = z.object({
  score: z.number().int().min(0),
  total: z.number().int().min(1).max(30),
  band: z.enum(['A1', 'A2', 'B1', 'B1+']),
  startCefr: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']),
  startConceptId: z.string().min(1),
  stretchUnlocked: z.boolean(),
  aboveContent: z.boolean(),
}).refine((result) => result.score <= result.total, { message: 'score exceeds total' });

/** Validate a stored placement result before rendering or scheduling from it. */
export function parseStoredPlacement(raw: unknown, courseSlug: string): PlacementResult | null {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return null;
  const course = initialCourses.find((candidate) => candidate.slug === courseSlug);
  if (!course?.concepts.some((concept) => concept.id === parsed.data.startConceptId)) return null;
  return parsed.data;
}
