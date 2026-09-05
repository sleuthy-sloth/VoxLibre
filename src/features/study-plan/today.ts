import type { PlanItem, StudyPlan } from './types';

// Mirrors generate.ts: a day's share of the weekly pace budget.
const MAX_ITEMS_PER_SESSION = 14;

export function planItemKey(
  weekIndex: number,
  itemIndex: number,
  conceptId: string,
  mode: string,
  drillId?: string,
): string {
  return `${weekIndex}:${itemIndex}:${mode}:${conceptId}:${drillId ?? ''}`;
}

export type PositionedPlanItem = Readonly<{
  weekIndex: number;
  itemIndex: number;
  key: string;
  item: PlanItem;
}>;

export function flattenPlanItems(plan: StudyPlan): readonly PositionedPlanItem[] {
  return plan.weeks.flatMap((week, weekIndex) =>
    week.items.map((item, itemIndex) => ({
      weekIndex,
      itemIndex,
      key: planItemKey(weekIndex, itemIndex, item.conceptId, item.mode, item.drillId),
      item,
    })),
  );
}

function isDone(done: Record<string, boolean> | ReadonlySet<string>, key: string): boolean {
  if (typeof (done as ReadonlySet<string>).has === 'function') return (done as ReadonlySet<string>).has(key);
  return (done as Record<string, boolean>)[key] ?? false;
}

// Position-based, never date-punitive: today's items are simply the first
// incomplete items in plan order. Skipped days shift nothing — the same
// position resumes. Default limit is one day's share of the pace budget.
export function todayPlanItems(
  plan: StudyPlan,
  done: Record<string, boolean> | ReadonlySet<string>,
  limit: number = Math.min(MAX_ITEMS_PER_SESSION, plan.minutesPerDay),
): readonly PlanItem[] {
  const cap = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
  return flattenPlanItems(plan)
    .filter((positioned) => !isDone(done, positioned.key))
    .slice(0, cap)
    .map((positioned) => positioned.item);
}

export type PlanPosition = Readonly<{
  currentWeek: number;
  weekCount: number;
  doneCount: number;
  totalCount: number;
}>;

// Server-side progress binding without a schema change: a plan drill is
// done when its drill was completed with quality ≥ 3 (the same bar the
// snapshot already uses for concept completion). Teach/review items for a
// concept are satisfied once the concept's drill is demonstrated — the plan
// teaches before it drills, and a completed drill demonstrates the retrieval
// the review was scheduled for. A dedicated position-pointer column stays
// deferred (see phase-status: placement/study-plan sync remains open).
export function planDoneKeys(
  plan: StudyPlan,
  completedDrillIds: ReadonlySet<string>,
): Record<string, boolean> {
  const flat = flattenPlanItems(plan);
  const drilledConcepts = new Set(
    flat
      .filter((positioned) => positioned.item.mode === 'drill' && positioned.item.drillId && completedDrillIds.has(positioned.item.drillId))
      .map((positioned) => positioned.item.conceptId),
  );
  const done: Record<string, boolean> = {};
  for (const positioned of flat) {
    const satisfied =
      positioned.item.mode === 'drill'
        ? Boolean(positioned.item.drillId && completedDrillIds.has(positioned.item.drillId))
        : drilledConcepts.has(positioned.item.conceptId);
    if (satisfied) done[positioned.key] = true;
  }
  return done;
}

// Zero-based index of the first week with an incomplete item; the final
// week when everything is checked off. Kept for the plan overview.
export function currentWeekIndex(
  plan: StudyPlan,
  done: Record<string, boolean> | ReadonlySet<string>,
): number {
  const firstIncomplete = plan.weeks.findIndex((week, weekIndex) =>
    week.items.some((item, itemIndex) => !isDone(done, planItemKey(weekIndex, itemIndex, item.conceptId, item.mode, item.drillId))),
  );
  return firstIncomplete === -1 ? Math.max(0, plan.weeks.length - 1) : firstIncomplete;
}

export function planPosition(
  plan: StudyPlan,
  done: Record<string, boolean> | ReadonlySet<string>,
): PlanPosition {
  const flat = flattenPlanItems(plan);
  const doneCount = flat.filter((positioned) => isDone(done, positioned.key)).length;
  return {
    currentWeek: currentWeekIndex(plan, done) + 1,
    weekCount: plan.weeks.length,
    doneCount,
    totalCount: flat.length,
  };
}

/** Pair each remaining teaching item with retrieval before spending the daily budget.
 * Stored weekly checklists keep their original positions and keys.
 */
export function practicePlanItems(plan: StudyPlan, done: Record<string, boolean>, limit: number): readonly PlanItem[] {
  const pending = flattenPlanItems(plan).filter(position => !isDone(done, position.key));
  const groups = new Map<string, PlanItem[]>();
  for (const { item } of pending) {
    const group = groups.get(item.conceptId) ?? [];
    if (!group.some(existing => existing.mode === item.mode && existing.drillId === item.drillId)) group.push(item);
    groups.set(item.conceptId, group);
  }
  const selected: PlanItem[] = [];
  for (const group of groups.values()) {
    const teach = group.find(item => item.mode === 'teach');
    const drills = group.filter(item => item.mode === 'drill');
    const ordered = [...(teach ? [teach] : []), ...drills, ...group.filter(item => item.mode === 'review')];
    if (teach && drills.length && limit - selected.length < 2) break;
    selected.push(...ordered.slice(0, Math.max(0, limit - selected.length)));
    if (selected.length >= limit) break;
  }
  return selected;
}
