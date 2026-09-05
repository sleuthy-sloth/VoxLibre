import Link from 'next/link';
import styles from '@/components/session/session.module.css';
import { cookies } from 'next/headers';
import { GuidedSession } from '@/components/session/GuidedSession';
import { SendToAnki } from '@/components/anki/SendToAnki';
import { initialCourses } from '@/features/curriculum/fixture';
import { demoProgress } from '@/features/progress/demo-progress';
import { composeLessonSession } from '@/features/session/lesson-path';
import { getProgressSnapshot } from '@/lib/progress/snapshot';
import { sessionTokenFromCookies } from '@/lib/auth/cookies';
import { verifySessionToken } from '@/lib/auth/session';
import { LanguageSwitcher } from '@/components/nav/LanguageSwitcher';

export default async function LearnPage({ params, searchParams }: {
  params: Promise<{ courseSlug: string }>;
  searchParams: Promise<{ concept?: string }>;
}) {
  const { courseSlug } = await params;
  const { concept: requestedConcept } = await searchParams;
  const course = initialCourses.find(course => course.slug === courseSlug);
  const token = sessionTokenFromCookies((await cookies()).toString());
  const session = token ? await verifySessionToken(token) : null;
  const progress = session ? await getProgressSnapshot(session.userId) : demoProgress;
  const nextConcept = progress.session.find(step => step.courseSlug === courseSlug && step.kind === 'NEW_PATTERN')?.contentId;
  const conceptId = requestedConcept ?? nextConcept ?? course?.concepts[0]?.id ?? '';
  const steps = session && !requestedConcept ? progress.session.filter(step => step.courseSlug === courseSlug) : course ? composeLessonSession(course, conceptId) : [];

  return <>
    <div className={styles.languageBar}><LanguageSwitcher currentCourse={courseSlug} /></div>
    <GuidedSession key={`${courseSlug}:${conceptId}`} courseSlug={courseSlug} progress={{ ...progress, session: steps }} />
    {course ? <nav aria-label="Course lessons" className={styles.courseIndex}>
      <h2>Explore the course</h2>
      {['it','fr'].includes(course.targetLanguageCode) ? <p><Link href={`/courses/${course.targetLanguageCode === 'it' ? 'italian' : 'french'}`}>New: structured A1 foundations with offline study</Link></p> : null}
      <p>Each lesson explains a useful pattern, shows a worked example, then gives you practice.</p>
      <ol>{course.concepts.map((concept, index) => <li key={concept.id}>
        <Link aria-current={concept.id === conceptId ? 'page' : undefined} href={`/learn/${courseSlug}?concept=${concept.id}`}><span className={styles.lessonNumber} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><span>{concept.scenario}</span><span aria-hidden="true">→</span></Link>
      </li>)}</ol>
      <Link href={`/learn/${courseSlug}/placement`}>Find your starting point</Link>{' · '}
      <Link href={`/learn/${courseSlug}/plan`}>Your study plan</Link>
    </nav> : null}
    {course ? <details className={styles.courseExtras}><summary>Take these lessons to Anki</summary><SendToAnki courseSlug={courseSlug} /></details> : null}
  </>;
}
