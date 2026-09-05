import type { PlanItem } from '@/features/study-plan/types';

export type SessionStepKind = 'REVIEW' | 'DRILL' | 'NEW_PATTERN';

export type SessionCandidate = Readonly<{ id: string; contentId: string }>;
export type DrillSessionCandidate = SessionCandidate & Readonly<{ drillId: string }>;

type SessionStepBase = Readonly<{
  id: string;
  courseSlug: string;
  contentId: string;
}>;

export type SessionStep =
  | (SessionStepBase & Readonly<{ kind: 'REVIEW' | 'NEW_PATTERN' }>)
  | (SessionStepBase & Readonly<{ kind: 'DRILL'; drillId: string }>);

export type DailySessionInput = Readonly<{
  courseSlug: string;
  dueReviews?: readonly SessionCandidate[];
  drillRounds?: readonly DrillSessionCandidate[];
  newPattern?: SessionCandidate | null;
  // Slice 3: when today's plan items are present, steps derive from them
  // (teach → NEW_PATTERN, drill → DRILL, review → REVIEW) instead of the
  // fixed demo slice below. Absent/empty keeps the demo fallback.
  planItems?: readonly PlanItem[];
  maxSteps: number;
}>;

function composePlanSteps(courseSlug: string, planItems: readonly PlanItem[], maxSteps: number): readonly SessionStep[] {
  const steps: SessionStep[] = [];
  for (const item of planItems) {
    if (steps.length >= maxSteps) break;
    if (item.mode === 'teach') {
      steps.push({ id: `plan-teach-${item.conceptId}`, kind: 'NEW_PATTERN', courseSlug, contentId: item.conceptId });
    } else if (item.mode === 'drill') {
      // A drill item without a drill cannot be practiced — skip it rather
      // than invent a step. generatePlan always sets drillId; this guards
      // hand-written or older stored plans.
      if (!item.drillId) continue;
      steps.push({ id: `plan-drill-${item.drillId}`, kind: 'DRILL', courseSlug, contentId: item.conceptId, drillId: item.drillId });
    } else {
      steps.push({ id: `plan-review-${item.conceptId}`, kind: 'REVIEW', courseSlug, contentId: item.conceptId });
    }
  }
  return steps;
}

export function composeDailySession(input: DailySessionInput): readonly SessionStep[] {
  const maxSteps = Number.isFinite(input.maxSteps) ? Math.max(0, Math.floor(input.maxSteps)) : 0;
  if (input.planItems?.length) return composePlanSteps(input.courseSlug, input.planItems, maxSteps);
  const steps: SessionStep[] = [];
  const dueReviews = input.dueReviews ?? [];
  const drillRounds = input.drillRounds ?? [];
  const newPattern = input.newPattern ?? null;

  // Teach first: the new pattern leads so the learner sees the model
  // dialogue before any step asks them to produce language.
  if (newPattern && steps.length < maxSteps) {
    steps.push({
      id: newPattern.id,
      kind: 'NEW_PATTERN',
      courseSlug: input.courseSlug,
      contentId: newPattern.contentId,
    });
  }

  for (const review of dueReviews) {
    if (steps.length >= maxSteps) break;
    steps.push({
      id: review.id,
      kind: 'REVIEW',
      courseSlug: input.courseSlug,
      contentId: review.contentId,
    });
  }

  for (const drill of drillRounds) {
    if (steps.length >= maxSteps) break;
    steps.push({
      id: drill.id,
      kind: 'DRILL',
      courseSlug: input.courseSlug,
      contentId: drill.contentId,
      drillId: drill.drillId,
    });
  }

  return steps;
}
