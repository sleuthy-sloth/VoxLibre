'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { initialCourses } from '@/features/curriculum/fixture';
import type { DemoProgressSnapshot } from '@/features/progress/types';
import { planPosition, todayPlanItems } from '@/features/study-plan/today';
import { parseStoredPlan } from '@/features/study-plan/parse';
import type { StudyPlan } from '@/features/study-plan/types';
import { csrfHeaders } from '@/lib/auth/cookies';
import { dashboardBadgeCopy, planStatusCopy, planTodayCopy } from '@/lib/progress/copy';
import { FirstRunOnboarding } from './FirstRunOnboarding';
import { LanguageSwitcher } from '@/components/nav/LanguageSwitcher';
import styles from './dashboard.module.css';

function useDebugFlag(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('debug') === '1';
  } catch {
    return false;
  }
}

type DailyPathDashboardProps = Readonly<{
  progress: DemoProgressSnapshot;
  requestedCourseSlug?: string;
}>;

const practiceSteps = [
  { label: 'Learn', detail: 'Understand the pattern with a worked example', tone: 'pattern' },
  { label: 'Practice', detail: 'Build, listen, and try it for yourself', tone: 'drill' },
  { label: 'Remember', detail: 'Recall it and plan your next review', tone: 'review' },
] as const;

type GuestPlanStatus = Readonly<{ plan: StudyPlan; done: Record<string, boolean> }>;

// Slice 3: the browser-local plan mirror (written by the plan builder) is
// the dashboard's plan source for guests. Signed-in plans surface through
// the progress snapshot session instead. Corrupt storage means no plan,
// never a broken dashboard.
function readGuestPlan(courseSlug: string): GuestPlanStatus | null {
  try {
    const saved = parseStoredPlan(JSON.parse(localStorage.getItem(`verbalibera_plan:${courseSlug}`) ?? 'null'), courseSlug);
    if (!saved) return null;
    const flags = JSON.parse(
      localStorage.getItem(`verbalibera_plan_done:${courseSlug}`) ?? 'null',
    ) as Record<string, boolean> | null;
    return { plan: saved, done: flags ?? {} };
  } catch {
    return null;
  }
}

export function DailyPathDashboard({ progress, requestedCourseSlug }: DailyPathDashboardProps) {
  const isPreview = progress.isPreview !== false;
  const isDebug = useDebugFlag();
  const [signOutError, setSignOutError] = useState(false);
  const requestedCourseIndex = requestedCourseSlug
    ? progress.courses.findIndex((course) => course.slug === requestedCourseSlug)
    : -1;
  const snapshotCourseIndex = progress.courses.findIndex(
    (course) => course.slug === progress.selectedCourseSlug,
  );
  const initialCourseIndex = requestedCourseIndex >= 0
    ? requestedCourseIndex
    : Math.max(0, snapshotCourseIndex);
  const [selectedCourseIndex, setSelectedCourseIndex] = useState(initialCourseIndex);
  const selectedCourse = progress.courses[selectedCourseIndex] ?? progress.courses[0];
  const [guestPlan, setGuestPlan] = useState<GuestPlanStatus | null>(null);
  useEffect(() => {
    if (!isPreview || typeof window === 'undefined' || !selectedCourse) return;
    // Deferred like the plan builder: read storage after paint so the effect
    // never sets state synchronously (cascading-render lint).
    const slug = selectedCourse.slug;
    const timer = setTimeout(() => {
      setGuestPlan(readGuestPlan(slug));
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedCourse, isPreview]);
  const isBlank = progress.dueReviewCount === 0 && progress.dailyGoal.completed === 0;

  if (!selectedCourse) {
    return (
      <main id="main-content" tabIndex={-1} className={`${styles.dashboard} ${styles.focusSurface}`}>
        <p className={styles.eyebrow}>VerbaLibera preview</p>
        <h1>VerbaLibera</h1>
        <p>No preview courses are ready yet.</p>
      </main>
    );
  }

  const authoredCourse = initialCourses.find((course) => course.slug === selectedCourse.slug);
  const nextStep = progress.session.find(
    (step) =>
      step.courseSlug === selectedCourse.slug &&
      authoredCourse?.concepts.some((concept) => concept.id === step.contentId),
  );
  const nextConcept = authoredCourse?.concepts.find((concept) => concept.id === nextStep?.contentId)
    ?? authoredCourse?.concepts[0];
  const nextScenario = nextConcept?.scenario;

  const goalLabel = `${progress.dailyGoal.completed} of ${progress.dailyGoal.target} daily steps`;
  // The stored plan belongs to its own course — never show a previous
  // selection's status while the fresh read is still deferred.
  const activePlan = isPreview ? guestPlan : progress.studyPlans?.[selectedCourse.slug];
  const planSummary =
    activePlan && activePlan.plan.courseSlug === selectedCourse.slug
      ? {
        status: planStatusCopy({
          week: planPosition(activePlan.plan, activePlan.done).currentWeek,
          weekCount: planPosition(activePlan.plan, activePlan.done).weekCount,
          targetLevel: activePlan.plan.targetLevel,
        }),
        today: planTodayCopy({ count: isPreview ? todayPlanItems(activePlan.plan, activePlan.done).length : progress.session.filter(step => step.courseSlug === selectedCourse.slug && step.id.startsWith('plan-')).length }),
        frontierNote: activePlan.plan.frontier?.note ?? null,
      }
    : null;
  const hasSelectedSession =
    initialCourses.some((course) => course.slug === selectedCourse.slug) &&
    progress.session.some((step) => step.courseSlug === selectedCourse.slug);

  return (
    <main id="main-content" tabIndex={-1} className={`${styles.dashboard} ${styles.focusSurface}`}>
      <header className={styles.brandHeader}>
        <Link className={styles.wordmark} href="/" aria-label="VerbaLibera home">
          <span aria-hidden="true">V</span>
          VerbaLibera
        </Link>
        <LanguageSwitcher currentCourse={selectedCourse.slug} courses={progress.courses} dashboard onChange={(slug) => {
          const nextIndex = progress.courses.findIndex((course) => course.slug === slug);
          if (nextIndex >= 0) setSelectedCourseIndex(nextIndex);
        }} />
        <p className={styles.previewBadge}>
          <span aria-hidden="true" />
          {dashboardBadgeCopy({ isPreview })}
        </p>
        {isDebug && progress.contentVersion ? (
          <p data-testid="content-version-badge" className={styles.previewBadge} style={{ marginLeft: '0.5rem' }}>
            v{progress.contentVersion}
          </p>
        ) : null}
        {isPreview ? <Link className={styles.accountLink} href="/login">Save your progress</Link> : <button className={styles.accountLink} type="button" onClick={async () => {
          try {
            const response = await fetch('/api/auth/logout', { method: 'POST', headers: csrfHeaders() });
            if (!response.ok) throw new Error('Sign-out failed');
            window.location.assign('/');
          } catch { setSignOutError(true); }
        }}>Sign out</button>}
        {signOutError ? <p role="alert">Could not sign out. Please try again.</p> : null}
      </header>

      <section className={styles.intro} aria-labelledby="dashboard-title">
        <p className={styles.eyebrow}>Today · your daily path</p>
        <h1 id="dashboard-title">
          <span className={styles.srOnly}>VerbaLibera — </span>
          Keep your useful phrases moving.
        </h1>
        <p className={styles.introCopy}>
          Learn how the language works, practice one useful pattern, and make it part of your everyday vocabulary. Already know some?{' '}
          <Link href={`/learn/${selectedCourse.slug}/placement`}>Take the 3-minute placement quiz</Link>.
        </p>
        <div className={styles.introArtwork}>
          <Image alt="" height={1024} src="/illustrations/daily-practice.png" width={1536} />
        </div>
      </section>

      <div className={styles.learningPromise}>
        <span>Free to learn</span><span>Explanations before exercises</span><span>No timers or lost hearts</span>
      </div>
      <div className={styles.dashboardGrid}>
        <section className={styles.todayCard} aria-labelledby="today-title">
          <div className={styles.todayHeading}>
            <div>
              <p className={styles.kicker} id="today-title">{"Today's 8-minute path"}</p>
              <p className={`${styles.kicker} ${styles.contrastTag}`}>Up next</p>
              <h2>{selectedCourse.unitLabel}</h2>
              <p className={styles.courseMeta}>{selectedCourse.title}</p>
              {nextScenario ? <p className={styles.scenario}>{nextScenario}</p> : null}
            </div>
            <p className={styles.pathTime}>About 8 min</p>
          </div>

          {planSummary ? (
            <div>
              <p className={styles.kicker}>{planSummary.status}</p>
              <p className={styles.scenario}>{planSummary.today}</p>
              {planSummary.frontierNote ? (
                <p className={styles.scenario}>{planSummary.frontierNote}</p>
              ) : null}
              <p className={styles.courseMeta}>
                <Link href={`/learn/${selectedCourse.slug}/plan`}>Review your study plan</Link>
              </p>
            </div>
          ) : null}

          {isBlank ? (
            <FirstRunOnboarding courseSlug={selectedCourse.slug} />
          ) : (
            <>
              <div className={styles.goal}>
                <div className={styles.goalLabel}>
                  <span>Daily goal</span>
                  <strong>{goalLabel}</strong>
                </div>
                <progress
                  aria-label="Daily goal"
                  aria-valuetext={goalLabel}
                  max={progress.dailyGoal.target}
                  value={Math.min(progress.dailyGoal.completed, progress.dailyGoal.target)}
                />
              </div>

              <ol className={styles.practicePath}>
                {practiceSteps.map((step, index) => (
                  <li
                    className={styles.pathStep}
                    data-state={index === 0 ? 'active' : 'pending'}
                    data-tone={step.tone}
                    key={step.label}
                  >
                    <span className={styles.stepMarker} aria-hidden="true">{index + 1}</span>
                    <div>
                      <h3>{step.label}</h3>
                      <p>{step.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>

              {hasSelectedSession ? (
                <Link className={styles.primaryAction} href={`/learn/${selectedCourse.slug}`}>
                  Continue 8-minute session
                  <span aria-hidden="true">→</span>
                </Link>
              ) : (
                <p className={styles.pendingAction} role="status">
                  Session preview coming soon
                </p>
              )}
            </>
          )}
        </section>

        <aside className={styles.progressPanel} aria-labelledby="progress-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.kicker}>Your pace</p>
              <h2 id="progress-title">Progress snapshot</h2>
            </div>
          </div>

          <dl className={styles.metrics}>
            <div>
              <dt className={styles.metricLabel}>Total XP</dt>
              <dd>{progress.xp} XP</dd>
            </div>
            <div>
              <dt className={styles.metricLabel}>Practice flow</dt>
              <dd><p>{progress.practiceFlowDays}-day practice flow</p></dd>
            </div>
            <div>
              <dt className={styles.metricLabel}>Streak</dt>
              <dd>
                <p>
                  {progress.streakDays === 0
                    ? 'No streak yet — finish a session to start one.'
                    : `${progress.streakDays}-day streak`}
                </p>
              </dd>
            </div>
            <div>
              <dt className={styles.metricLabel}>Review queue</dt>
              <dd>
                <p>
                  {progress.dueReviewCount === 0
                    ? "You're caught up — one pattern tomorrow keeps the flow."
                    : `${progress.dueReviewCount} reviews waiting`}
                </p>
              </dd>
            </div>
            {isDebug && progress.contentVersion ? (
              <div data-testid="content-version-panel">
                <dt className={styles.metricLabel}>Content version</dt>
                <dd>{progress.contentVersion}</dd>
              </div>
            ) : null}
          </dl>
        </aside>
      </div>
    </main>
  );
}
