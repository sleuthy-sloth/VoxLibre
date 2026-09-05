import type { StudyPlan } from '@/features/study-plan/types';
import type { SessionStep } from '@/features/session/compose-session';
export type DemoProgressSnapshot = Readonly<{
  isPreview?: boolean;
  selectedCourseSlug: string;
  xp: number;
  practiceFlowDays: number;
  dailyGoal: Readonly<{ completed: number; target: number }>;
  dueReviewCount: number;
  streakDays: number;
  courses: readonly Readonly<{
    slug: string;
    title: string;
    unitLabel: string;
    completionPercent: number;
  }>[];
  session: readonly SessionStep[];
  studyPlans?: Readonly<Record<string, { plan: StudyPlan; done: Record<string, boolean> }>>;
  contentVersion: string | null;
  /**
   * UTC ISO-8601 snapshot time (new Date().toISOString()) used for
   * due-queue freshness and midnight rollover proof. Always UTC, never
   * server-local string, so dashboard staleness is determined by dueAt <= now UTC.
   */
  snapshotAt: string;
}>;
