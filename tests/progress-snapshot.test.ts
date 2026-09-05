import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { getProgressSnapshot } from '../src/lib/progress/snapshot';
import { demoProgress } from '../src/features/progress/demo-progress';
import { initialCourses } from '../src/features/curriculum/fixture';
import { generatePlan } from '../src/features/study-plan/generate';

// Mock prisma for contentVersion fallback (no DB) and due counts
vi.mock('@/lib/prisma', () => ({
  prisma: {
    contentVersion: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    userProgress: {
      count: vi.fn().mockResolvedValue(3),
      findMany: vi.fn().mockResolvedValue([]),
    },
    reviewLog: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    conceptMastery: { findMany: vi.fn().mockResolvedValue([]) },
    studyPlan: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import { prisma } from '@/lib/prisma';

describe('progress snapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns demoProgress for signed-out (null user)', async () => {
    const snapshot = await getProgressSnapshot(null);
    // demoProgress is byte-identical for everyone except contentVersion + snapshotAt which are dynamic
    const { snapshotAt, contentVersion, ...rest } = snapshot as unknown as Record<string, unknown>;
    const { snapshotAt: _a, contentVersion: _b, ...demoRest } = demoProgress as unknown as Record<string, unknown>;
    expect(rest).toEqual(demoRest);
  });

  it('returns demoProgress for undefined user', async () => {
    const snapshot = await getProgressSnapshot(null);
    // Should be byte-identical to demoProgress for preview (except dynamic fields)
    expect(snapshot.selectedCourseSlug).toBe(demoProgress.selectedCourseSlug);
    expect(snapshot.courses).toEqual(demoProgress.courses);
    expect(snapshot.session).toEqual(demoProgress.session);
  });

  it('has same structure as demoProgress', async () => {
    const snapshot = await getProgressSnapshot(null);
    expect(snapshot.courses).toBeDefined();
    expect(snapshot.session).toBeDefined();
    expect(Array.isArray(snapshot.courses)).toBe(true);
    expect(Array.isArray(snapshot.session)).toBe(true);
  });

  describe('UTC midnight rollover (Task 6)', () => {
    beforeEach(() => {
      vi.useFakeTimers({ now: new Date('2026-09-03T00:05:00Z') });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('exposes snapshotAt as UTC ISO string at frozen midnight, not server local', async () => {
      const snapshot = await getProgressSnapshot(null);
      // Must be UTC ISO via new Date().toISOString() at frozen time
      expect((snapshot as unknown as Record<string, unknown>).snapshotAt).toBe('2026-09-03T00:05:00.000Z');
      const snapshotAt = (snapshot as unknown as Record<string, unknown>).snapshotAt as string;
      expect(typeof snapshotAt).toBe('string');
      expect(snapshotAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      // not locale string (no GMT, PST etc.)
      expect(snapshotAt).not.toMatch(/GMT|PST|PDT|Local/);
      expect(snapshotAt.endsWith('Z')).toBe(true);
      // reparses to same instant
      expect(new Date(snapshotAt).toISOString()).toBe(snapshotAt);
    });

    it('due queue count uses UTC now (dueAt <= now) at frozen midnight', async () => {
      const mockCount = prisma.userProgress.count as unknown as ReturnType<typeof vi.fn>;
      mockCount.mockResolvedValue(2);
      const snapshot = await getProgressSnapshot('user-123');
      // snapshotAt still UTC ISO
      expect((snapshot as unknown as Record<string, unknown>).snapshotAt).toBe('2026-09-03T00:05:00.000Z');
      // prisma count was called with dueAt: { lte: now } where now is frozen UTC
      expect(mockCount).toHaveBeenCalled();
      const dueCall = mockCount.mock.calls.find((args) => (args[0] as { where?: { dueAt?: unknown } })?.where?.dueAt) as [{ where: { dueAt: { lte: Date } } }] | undefined;
      const callArgs = dueCall?.[0] as { where?: { dueAt?: { lte?: Date } } } | undefined;
      const lte = callArgs?.where?.dueAt?.lte;
      expect(lte).toBeInstanceOf(Date);
      expect((lte as Date).toISOString()).toBe('2026-09-03T00:05:00.000Z');
      // verify inclusive UTC midnight semantics: dueAt == now is considered due, 1ms after is not
      expect((lte as Date).getTime()).toBe(new Date('2026-09-03T00:05:00Z').getTime());
      expect(snapshot.dueReviewCount).toBe(2);
    });

    it('snapshotAt reparses as UTC even when server TZ would shift local midnight', async () => {
      const snapshot = await getProgressSnapshot(null);
      const snapshotAt = (snapshot as unknown as Record<string, unknown>).snapshotAt as string;
      const parsed = new Date(snapshotAt);
      // getUTCHours must be 0 for 00:05Z, getHours would vary with TZ, so assert UTC
      expect(parsed.getUTCHours()).toBe(0);
      expect(parsed.getUTCMinutes()).toBe(5);
      // ensure toISOString round-trips, not toLocaleString
      expect(parsed.toISOString()).toBe(snapshotAt);
      expect(parsed.toString()).not.toBe(snapshotAt);
    });
  });

  describe('streaks + real review queue', () => {
    beforeEach(() => {
      vi.useFakeTimers({ now: new Date('2026-09-04T12:00:00Z') });
      (prisma.reviewLog.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.userProgress.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('derives streakDays from distinct UTC review days', async () => {
      const mockReviews = prisma.reviewLog.findMany as unknown as ReturnType<typeof vi.fn>;
      mockReviews.mockResolvedValue([
        { createdAt: new Date('2026-09-04T08:00:00Z') },
        { createdAt: new Date('2026-09-03T20:00:00Z') },
        { createdAt: new Date('2026-09-02T09:00:00Z') },
      ]);
      const snapshot = await getProgressSnapshot('user-123');
      expect(snapshot.streakDays).toBe(3);
    });

    it('reports zero streak with no review activity', async () => {
      const snapshot = await getProgressSnapshot('user-123');
      expect(snapshot.streakDays).toBe(0);
    });

    it('prefers due SRS items as review steps in the signed-in session', async () => {
      const mockDue = prisma.userProgress.findMany as unknown as ReturnType<typeof vi.fn>;
      mockDue.mockResolvedValue([
        {
          drillItemId: 'fr-pay-politely-drill', dueAt: new Date('2026-09-03T00:00:00Z'), lastQuality: 4,
          drillItem: { conceptBlock: { id: 'fr-pay-politely', course: { slug: 'english-to-french' } } },
        },
      ]);
      const snapshot = await getProgressSnapshot('user-123');
      const french = snapshot.session.filter((step) => step.courseSlug === 'english-to-french');
      // Teaching still leads; the due SRS review follows immediately after.
      expect(french[0]).toMatchObject({ kind: 'NEW_PATTERN' });
      expect(french.find(step => step.id.endsWith('-due'))).toMatchObject({ kind: 'DRILL', contentId: 'fr-pay-politely', drillId: 'fr-pay-politely-drill' });
    });

    it('starts a coherent first lesson when nothing has been practiced', async () => {
      const snapshot = await getProgressSnapshot('user-123');
      expect(snapshot.session.filter(step => step.courseSlug === 'english-to-french').every(step => step.contentId === 'fr-greet-politely')).toBe(true);
    });
  });
});


describe('account metrics never borrow preview activity', () => {
  beforeEach(() => {
    vi.mocked(prisma.userProgress.count).mockResolvedValue(7);
    vi.mocked(prisma.userProgress.findMany).mockResolvedValue([]);
    vi.mocked(prisma.reviewLog.findMany).mockResolvedValue([]);
    vi.mocked(prisma.reviewLog.count).mockResolvedValue(0);
    vi.mocked(prisma.conceptMastery.findMany).mockResolvedValue([]);
    vi.mocked(prisma.studyPlan.findMany).mockResolvedValue([]);
  });
  it('starts an account at zero even with reviews waiting', async () => {
    const snapshot = await getProgressSnapshot('new-user');
    expect(snapshot.xp).toBe(0);
    expect(snapshot.dailyGoal.completed).toBe(0);
    expect(snapshot.practiceFlowDays).toBe(0);
    expect(snapshot.courses.every(course => course.completionPercent === 0)).toBe(true);
    expect(snapshot.isPreview).toBe(false);
  });
  it('counts completed reviews today separately from the due queue', async () => {
    vi.mocked(prisma.reviewLog.count).mockResolvedValueOnce(9).mockResolvedValueOnce(2);
    const snapshot = await getProgressSnapshot('active-user');
    expect(snapshot.xp).toBe(90);
    expect(snapshot.dailyGoal.completed).toBe(2);
    expect(snapshot.dueReviewCount).toBe(7);
  });
});

describe('study-plan driven signed-in session', () => {
  const concepts = initialCourses.find((course) => course.slug === 'english-to-french')!.concepts;
  const plan = generatePlan(
    {
      courseSlug: 'english-to-french',
      startCefr: 'A1',
      startConceptId: concepts[0]!.id,
      targetLevel: 'B1',
      daysPerWeek: 5,
      minutesPerDay: 8,
      startDate: '2026-09-07',
    },
    concepts,
  );

  beforeEach(() => {
    (prisma.userProgress.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.studyPlan.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it('composes the session from the stored plan instead of the next lesson', async () => {
    (prisma.studyPlan.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { courseSlug: 'english-to-french', planJson: plan },
    ]);
    const snapshot = await getProgressSnapshot('planner');
    const french = snapshot.session.filter((step) => step.courseSlug === 'english-to-french');
    expect(french.length).toBeGreaterThan(0);
    expect(french.every((step) => step.id.startsWith('plan-'))).toBe(true);
    expect(french[0]).toMatchObject({ kind: 'NEW_PATTERN', contentId: concepts[0]!.id });
  });

  it('advances the plan position past completed plan drills', async () => {
    const firstDrill = plan.weeks.flatMap((week) => week.items).find((item) => item.mode === 'drill')!;
    (prisma.userProgress.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { drillItemId: firstDrill.drillId!, lastQuality: 4, dueAt: new Date('2026-09-08T00:00:00Z') },
    ]);
    (prisma.studyPlan.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { courseSlug: 'english-to-french', planJson: plan },
    ]);
    const snapshot = await getProgressSnapshot('planner-advancing');
    const french = snapshot.session.filter((step) => step.courseSlug === 'english-to-french');
    expect(french.length).toBeGreaterThan(0);
    expect(french.some((step) => step.contentId === firstDrill.conceptId)).toBe(false);
  });

  it('falls back to the next lesson when the stored plan is corrupt', async () => {
    (prisma.studyPlan.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { courseSlug: 'english-to-french', planJson: { nonsense: true } },
    ]);
    const snapshot = await getProgressSnapshot('planner-corrupt');
    const french = snapshot.session.filter((step) => step.courseSlug === 'english-to-french');
    expect(french[0]).toMatchObject({ kind: 'NEW_PATTERN' });
    expect(french.some((step) => step.id.startsWith('plan-'))).toBe(false);
  });
});

describe('plan scheduling regressions', () => {
  const concepts = initialCourses.find(course => course.slug === 'english-to-french')!.concepts;
  const plan = generatePlan({ courseSlug: 'english-to-french', startCefr: 'A1', startConceptId: concepts[0].id, targetLevel: 'B1', daysPerWeek: 5, minutesPerDay: 8, startDate: '2026-09-07' }, concepts);
  beforeEach(() => {
    vi.mocked(prisma.userProgress.findMany).mockResolvedValue([]);
    vi.mocked(prisma.studyPlan.findMany).mockResolvedValue([{ courseSlug: plan.courseSlug, planJson: plan }] as never);
  });
  it('offers a completable drill in the default daily plan budget', async () => {
    const snapshot = await getProgressSnapshot('planner');
    const steps = snapshot.session.filter(step => step.courseSlug === plan.courseSlug);
    expect(steps.length).toBeLessThanOrEqual(8);
    expect(steps[0]).toMatchObject({ kind: 'NEW_PATTERN', contentId: concepts[0].id });
    expect(steps[1]).toMatchObject({ kind: 'DRILL', contentId: concepts[0].id });
  });
  it('retains overdue retrieval while following a plan', async () => {
    vi.mocked(prisma.userProgress.findMany).mockResolvedValue([{ drillItemId: 'fr-pay-politely-drill', lastQuality: 4, dueAt: new Date('2020-01-01') }] as never);
    const snapshot = await getProgressSnapshot('planner');
    expect(snapshot.session).toContainEqual(expect.objectContaining({ kind: 'DRILL', drillId: 'fr-pay-politely-drill' }));
  });
  it.each([ { ...plan, weeks: [null] }, { ...plan, weeks: [{ items: [null] }] }, { ...plan, courseSlug: 'english-to-italian' }, { ...plan, weeks: [{ ...plan.weeks[0], items: [{ mode: 'teach', conceptId: 'missing' }] }] } ])('ignores invalid nested or mismatched plan content', async (broken) => {
    vi.mocked(prisma.studyPlan.findMany).mockResolvedValue([{ courseSlug: plan.courseSlug, planJson: broken }] as never);
    const snapshot = await getProgressSnapshot('planner');
    expect(snapshot.session.some(step => step.id.startsWith('plan-'))).toBe(false);
  });
});
