'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import sessionStyles from '@/components/session/session.module.css';
import { PlanBuilder } from '@/components/plan/PlanBuilder';
import { PlanOverview } from '@/components/plan/PlanOverview';
import { initialCourses } from '@/features/curriculum/fixture';
import type { CEFRLevel } from '@/features/curriculum/types';
import { parseStoredPlan } from '@/features/study-plan/parse';
import { csrfHeaders } from '@/lib/auth/cookies';
import type { StudyPlan } from '@/features/study-plan/types';

function planKey(courseSlug: string) {
  return `verbalibera_plan:${courseSlug}`;
}

function doneKey(courseSlug: string) {
  return `verbalibera_plan_done:${courseSlug}`;
}

function placementStart(courseSlug: string): { startCefr: CEFRLevel; startConceptId: string } | null {
  try {
    const saved = JSON.parse(localStorage.getItem(`verbalibera_placement:${courseSlug}`) ?? 'null') as {
      band?: string;
      startCefr?: CEFRLevel;
      startConceptId?: string;
    } | null;
    if (saved?.startConceptId && saved?.startCefr && initialCourses.find(course => course.slug === courseSlug)?.concepts.some(concept => concept.id === saved.startConceptId)) {
      return { startCefr: saved.startCefr, startConceptId: saved.startConceptId };
    }
  } catch {
    // Placement is optional; defaults apply.
  }
  return null;
}


export function PlanSection({ courseSlug, userId = null }: Readonly<{ courseSlug: string; userId?: string | null }>) {
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const endpoint = `/api/study-plan?courseSlug=${encodeURIComponent(courseSlug)}&userId=${encodeURIComponent(userId ?? '')}`;

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        if (userId) {
          const response = await fetch(endpoint, { cache: 'no-store' });
          const data = await response.json();
          if (!response.ok || data.userId !== userId) throw new Error(data.error ?? 'Your account changed. Reload this page.');
          if (cancelled) return;
          setPlan(parseStoredPlan(data.plan, courseSlug));
          setDone(data.done ?? {});
        } else {
          setPlan(parseStoredPlan(JSON.parse(localStorage.getItem(planKey(courseSlug)) ?? 'null'), courseSlug));
          const flags = JSON.parse(localStorage.getItem(doneKey(courseSlug)) ?? '{}');
          setDone(flags && typeof flags === 'object' ? flags : {});
        }
        setError(null);
        setLoaded(true);
      } catch (failure) {
        if (!cancelled) {
          setError(userId ? failure instanceof Error ? failure.message : 'Could not load your plan.' : 'Browser storage is unavailable. Your plan may not persist.');
          setLoaded(!userId);
        }
      }
    }, 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [courseSlug, userId, endpoint, reload]);

  if (!loaded) return <main id="main-content" className={sessionStyles.session}>{error ? <><p role="alert">{error}</p><button onClick={() => setReload(value => value + 1)}>Retry loading plan</button></> : <p role="status">Loading your study plan…</p>}</main>;

  const course = initialCourses.find((candidate) => candidate.slug === courseSlug);
  const fallbackConcept = course?.concepts[0]?.id ?? '';
  const placed = placementStart(courseSlug);

  const save = async (next: StudyPlan) => {
    setBusy(true);
    setError(null);
    try {
      if (userId) {
        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', ...csrfHeaders() }, body: JSON.stringify({ plan: next }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'Your plan was not saved.');
        // Reload the same account's derived progress, including existing practice.
        setLoaded(false);
        setReload(value => value + 1);
      } else {
        localStorage.setItem(planKey(courseSlug), JSON.stringify(next));
        setPlan(next);
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Your plan was not saved.'); }
    finally { setBusy(false); }
  };

  const toggle = (key: string, checked: boolean) => {
    const next = { ...done, [key]: checked };
    setDone(next);
    try {
      localStorage.setItem(doneKey(courseSlug), JSON.stringify(next));
    } catch {
      // Best-effort.
    }
  };

  const reset = async () => {
    setBusy(true);
    setError(null);
    if (userId) {
      try {
        const response = await fetch(endpoint, { method: 'DELETE', headers: csrfHeaders() });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'Your plan was not reset.');
        setPlan(null);
        setDone({});
      } catch (failure) { setError(failure instanceof Error ? failure.message : 'Your plan was not reset.'); }
      finally { setBusy(false); }
      return;
    }
    setPlan(null);
    setDone({});
    try {
      localStorage.removeItem(planKey(courseSlug));
      localStorage.removeItem(doneKey(courseSlug));
    } catch {
      setError('Browser storage could not be cleared.');
    }
    setBusy(false);
  };

  return (
    <main id="main-content" className={sessionStyles.session}>
      <p className={sessionStyles.eyebrow}>
        <Link href="/">← Daily path</Link>
      </p>
      <h1>Your {course?.title ?? 'course'} study plan</h1>
      <p>{userId ? 'Your plan is saved to your account and follows you across devices.' : 'Your plan and checklist stay in this browser.'}</p>
      {error ? <p role="alert">{error}</p> : null}
      <fieldset disabled={busy} style={{ border: 0, padding: 0, minWidth: 0 }}>
      {plan ? (
        <PlanOverview plan={plan} done={done} onToggle={toggle} onReset={reset} automatic={Boolean(userId)} />
      ) : (
        <>
          {placed ? (
            <p>Prefilled from your placement result — adjust the pace to taste.</p>
          ) : (
            <p>
              No placement yet?{' '}
              <Link href={`/learn/${courseSlug}/placement`}>Take the 3-minute quiz</Link> to
              set your starting point.
            </p>
          )}
          <PlanBuilder
            courseSlug={courseSlug}
            startCefr={placed?.startCefr ?? 'A1'}
            startConceptId={placed?.startConceptId ?? fallbackConcept}
            onSave={save}
          />
        </>
      )}
      </fieldset>
    </main>
  );
}
