'use client';

import Link from 'next/link';
import { initialCourses } from '@/features/curriculum/fixture';
import sessionStyles from '@/components/session/session.module.css';
import { currentWeekIndex, planItemKey } from '@/features/study-plan/today';
import type { StudyPlan } from '@/features/study-plan/types';

export { currentWeekIndex, planItemKey };

const MODE_LABEL: Record<string, string> = { teach: 'Learn', drill: 'Drill', review: 'Review' };

export function PlanOverview({ plan, done, onToggle, onReset, automatic = false }: Readonly<{
  plan: StudyPlan;
  done: Record<string, boolean>;
  onToggle: (key: string, checked: boolean) => void;
  onReset: () => void;
  todayIso?: string;
  automatic?: boolean;
}>) {
  const current = currentWeekIndex(plan, done);
  const doneCount = plan.weeks.reduce((sum, week, weekIndex) => sum + week.items.filter((item, itemIndex) => done[planItemKey(weekIndex, itemIndex, item.conceptId, item.mode, item.drillId)]).length, 0);
  const totalCount = plan.weeks.reduce((sum, week) => sum + week.items.length, 0);

  return (
    <div>
      <p className={sessionStyles.eyebrow}>Week {current + 1} of {plan.weeks.length} · {plan.targetLevel} track</p>
      <p aria-live="polite">{doneCount} of {totalCount} items done</p>
      <p className={sessionStyles.prompt}>{automatic ? 'Completion follows successful saved drills for each concept. Repeated checklist items share that evidence; due reviews are scheduled separately. This does not certify mastery.' : 'Your personal checklist is stored in this browser. Check off each practice when you finish; this does not certify mastery.'}</p>
      {plan.frontier ? <p role="note">{plan.frontier.note} Your plan covers through {plan.frontier.coveredThrough}.</p> : null}
      {plan.weeks.map((week, weekIndex) => (
        <section className={sessionStyles.planWeek} key={week.startsOn} aria-labelledby={`plan-week-${weekIndex}`}>
          <h2 id={`plan-week-${weekIndex}`}>Week {weekIndex + 1} · starts {week.startsOn}{weekIndex === current ? ' · this week' : ''}</h2>
          <ul className={sessionStyles.planChecklist}>
            {week.items.map((item, itemIndex) => {
              const key = planItemKey(weekIndex, itemIndex, item.conceptId, item.mode, item.drillId);
              const id = `plan-done-${key.replace(/[^a-z0-9]+/gi, '-')}`;
              const scenario = initialCourses.find((course) => course.slug === plan.courseSlug)?.concepts.find((concept) => concept.id === item.conceptId)?.scenario ?? 'Practice pattern';
              return <li key={key}>
                <input id={id} type="checkbox" disabled={automatic} checked={done[key] ?? false} onChange={(event) => onToggle(key, event.target.checked)} />{' '}
                <label htmlFor={id}>{MODE_LABEL[item.mode] ?? item.mode} · {scenario}</label>
                <Link href={`/learn/${plan.courseSlug}?concept=${encodeURIComponent(item.conceptId)}${item.drillId ? `&drill=${encodeURIComponent(item.drillId)}` : ''}`} aria-label={`Open lesson: ${scenario}`}>Study<span aria-hidden="true"> →</span></Link>
              </li>;
            })}
          </ul>
        </section>
      ))}
      <div className={sessionStyles.actionDock}><button type="button" onClick={onReset}>Start over with a new plan</button></div>
    </div>
  );
}
