import { z } from 'zod';
import { initialCourses } from '@/features/curriculum/fixture';
import type { StudyPlan } from './types';

const level = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
const date = z.iso.date();
const item = z.object({ conceptId: z.string().min(1), mode: z.enum(['teach', 'drill', 'review']), drillId: z.string().min(1).optional() });
const schema = z.object({
  courseSlug: z.string(), targetLevel: level,
  daysPerWeek: z.number().int().min(1).max(7),
  minutesPerDay: z.union([z.literal(5), z.literal(8), z.literal(15)]),
  startDate: date,
  weeks: z.array(z.object({ weekIndex: z.number().int().nonnegative(), startsOn: date, items: z.array(item).max(98) })).max(200),
  frontier: z.object({ coveredThrough: level, targetLevel: level, note: z.string() }).nullable(),
});

/** Validate both persisted structure and references before rendering or scheduling. */
export function parseStoredPlan(raw: unknown, courseSlug: string): StudyPlan | null {
  const parsed = schema.safeParse(raw);
  if (!parsed.success || parsed.data.courseSlug !== courseSlug) return null;
  const course = initialCourses.find(candidate => candidate.slug === courseSlug);
  if (!course) return null;
  for (const week of parsed.data.weeks) {
    for (const item of week.items) {
      const concept = course.concepts.find(candidate => candidate.id === item.conceptId);
      if (!concept || (item.mode === 'drill' && !item.drillId)) return null;
      if (item.drillId && !concept.drills.some(drill => drill.id === item.drillId)) return null;
    }
  }
  return parsed.data;
}
