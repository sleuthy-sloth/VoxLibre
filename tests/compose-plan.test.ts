import { composeDailySession } from '@/features/session/compose-session';
import { initialCourses } from '@/features/curriculum/fixture';
import { generatePlan } from '@/features/study-plan/generate';
import { planDoneKeys, planItemKey, planPosition, todayPlanItems } from '@/features/study-plan/today';
import type { PaceInput } from '@/features/study-plan/types';

const FRENCH = initialCourses.find((course) => course.slug === 'english-to-french')!.concepts;

const BASE: PaceInput = {
  courseSlug: 'english-to-french',
  startCefr: 'A1',
  startConceptId: 'fr-greet-politely',
  targetLevel: 'A2',
  daysPerWeek: 1,
  minutesPerDay: 5,
  startDate: '2026-09-07',
};

function doneKeysFor(plan: ReturnType<typeof generatePlan>, upto: number): Record<string, boolean> {
  const done: Record<string, boolean> = {};
  let seen = 0;
  plan.weeks.forEach((week, weekIndex) => {
    week.items.forEach((item, itemIndex) => {
      if (seen < upto) {
        done[planItemKey(weekIndex, itemIndex, item.conceptId, item.mode, item.drillId)] = true;
        seen += 1;
      }
    });
  });
  return done;
}

describe('composeDailySession with planItems', () => {
  it('derives steps from today’s plan items instead of the demo slice', () => {
    const plan = generatePlan(BASE, FRENCH);
    const items = todayPlanItems(plan, {});
    expect(items.length).toBeGreaterThan(0);
    const steps = composeDailySession({ courseSlug: plan.courseSlug, planItems: items, maxSteps: 14 });
    expect(steps).toHaveLength(items.length);
    const kinds = steps.map((step) => step.kind);
    expect(kinds).toEqual(
      items.map((item) => (item.mode === 'teach' ? 'NEW_PATTERN' : item.mode === 'drill' ? 'DRILL' : 'REVIEW')),
    );
    for (const [index, item] of items.entries()) {
      expect(steps[index]?.contentId).toBe(item.conceptId);
      expect(steps[index]?.courseSlug).toBe(plan.courseSlug);
      if (item.mode === 'drill') {
        expect(steps[index]).toMatchObject({ kind: 'DRILL', drillId: item.drillId });
      }
    }
  });

  it('caps plan-derived steps at maxSteps', () => {
    const plan = generatePlan(BASE, FRENCH);
    const steps = composeDailySession({ courseSlug: plan.courseSlug, planItems: todayPlanItems(plan, {}), maxSteps: 2 });
    expect(steps).toHaveLength(2);
  });

  it('falls back to the demo slice when planItems is missing or empty', () => {
    const demo = {
      courseSlug: 'english-to-french' as const,
      dueReviews: [{ id: 'review-1', contentId: 'content-1' }],
      drillRounds: [],
      newPattern: null,
      maxSteps: 4,
    };
    expect(composeDailySession({ ...demo, planItems: [] })).toEqual(composeDailySession(demo));
  });

  it('skips drill items that carry no drill to practice', () => {
    const steps = composeDailySession({
      courseSlug: 'english-to-french',
      planItems: [
        { conceptId: 'c1', mode: 'teach' },
        { conceptId: 'c1', mode: 'drill' },
        { conceptId: 'c1', mode: 'review' },
      ],
      maxSteps: 8,
    });
    expect(steps.map((step) => step.kind)).toEqual(['NEW_PATTERN', 'REVIEW']);
  });
});

describe('todayPlanItems', () => {
  it('serves the first incomplete items up to the daily budget', () => {
    const plan = generatePlan(BASE, FRENCH);
    const today = todayPlanItems(plan, {});
    expect(today).toHaveLength(5);
    expect(today[0]).toMatchObject({ conceptId: 'fr-greet-politely', mode: 'teach' });
  });

  it('is position-based: done items shift the schedule without date penalties', () => {
    const plan = generatePlan(BASE, FRENCH);
    const first = todayPlanItems(plan, {});
    const done = doneKeysFor(plan, first.length);
    const second = todayPlanItems(plan, done);
    expect(second.length).toBeGreaterThan(0);
    expect(second[0]).not.toEqual(first[0]);
    // A skipped day changes nothing — the same position resumes.
    expect(todayPlanItems(plan, done)).toEqual(second);
  });

  it('returns an empty list when every plan item is checked off', () => {
    const plan = generatePlan(BASE, FRENCH);
    const total = plan.weeks.reduce((sum, week) => sum + week.items.length, 0);
    expect(todayPlanItems(plan, doneKeysFor(plan, total))).toEqual([]);
  });

  it('honours an explicit limit', () => {
    const plan = generatePlan(BASE, FRENCH);
    expect(todayPlanItems(plan, {}, 2)).toHaveLength(2);
  });
});

describe('planDoneKeys', () => {
  it('marks drills done by completed drill id and satisfies sibling teach/review items', () => {
    const plan = generatePlan(BASE, FRENCH);
    const firstDrill = plan.weeks.flatMap((week) => week.items).find((item) => item.mode === 'drill');
    expect(firstDrill?.drillId).toBeTruthy();
    const done = planDoneKeys(plan, new Set([firstDrill!.drillId!]));
    const today = todayPlanItems(plan, done);
    // The completed drill satisfies its teach and concept reviews too.
    expect(today.some((item) => item.conceptId === firstDrill!.conceptId)).toBe(false);
    expect(today.length).toBeGreaterThan(0);
  });

  it('marks nothing done when no drills were completed', () => {
    const plan = generatePlan(BASE, FRENCH);
    expect(planDoneKeys(plan, new Set())).toEqual({});
  });
});

describe('planPosition', () => {
  it('reports week progress and completion counts', () => {
    const plan = generatePlan(BASE, FRENCH);
    const total = plan.weeks.reduce((sum, week) => sum + week.items.length, 0);
    const start = planPosition(plan, {});
    expect(start).toMatchObject({ currentWeek: 1, weekCount: plan.weeks.length, doneCount: 0, totalCount: total });

    const firstWeekSize = plan.weeks[0]?.items.length ?? 0;
    const advanced = planPosition(plan, doneKeysFor(plan, firstWeekSize));
    expect(advanced.doneCount).toBe(firstWeekSize);
    expect(advanced.currentWeek).toBe(plan.weeks.length > 1 ? 2 : 1);
  });
});

import { practicePlanItems } from '@/features/study-plan/today';
it.each([5, 8, 15] as const)('can finish every generated drill at a %i-minute pace without a teaching-only loop', minutesPerDay => {
  for (const daysPerWeek of [1, 2, 5, 7]) {
    const plan = generatePlan({ ...BASE, minutesPerDay, daysPerWeek }, FRENCH);
    const completed = new Set<string>();
    const required = new Set(plan.weeks.flatMap(week => week.items).flatMap(item => item.drillId ? [item.drillId] : []));
    for (let session = 0; session <= required.size; session++) {
      const items = practicePlanItems(plan, planDoneKeys(plan, completed), Math.min(14, minutesPerDay));
      if (!items.length) break;
      const drills = items.filter(item => item.mode === 'drill');
      expect(drills.length).toBeGreaterThan(0);
      expect(items.length).toBeLessThanOrEqual(Math.min(14, minutesPerDay));
      for (const drill of drills) completed.add(drill.drillId!);
    }
    expect(completed).toEqual(required);
  }
});
