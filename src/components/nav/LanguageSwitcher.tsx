'use client';

import { initialCourses } from '@/features/curriculum/fixture';
import styles from './language-switcher.module.css';

function courseShortName(title: string): string {
  return title.replace(/^English to /, '').replace(/: A1 patterns$/, '');
}

const FLAG_BY_LANGUAGE: Record<string, string> = {
  french: '🇫🇷', italian: '🇮🇹', spanish: '🇪🇸', portuguese: '🇵🇹',
};

function courseLevel(slug: string): string {
  const course = initialCourses.find((candidate) => candidate.slug === slug);
  const levels = course?.concepts.map((concept) => concept.cefrLevel) ?? [];
  // Floor, not ceiling: B1 stretch drills don't promote an A1 course.
  if (levels.length > 0 && levels.every((level) => level === 'A1')) return 'A1';
  const rank: Record<string, number> = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 };
  const floor = levels.map((level) => rank[level] ?? 0).sort((a, b) => a - b)[0] ?? 0;
  return Object.keys(rank).find((level) => rank[level] === floor) ?? 'A1';
}

function courseLabel(slug: string, title: string): string {
  const language = slug.replace(/^english-to-/, '');
  const flag = FLAG_BY_LANGUAGE[language] ?? '🌐';
  return `${flag} ${courseShortName(title)} · ${courseLevel(slug)}`;
}

export function LanguageSwitcher({ currentCourse, dashboard = false, onChange, courses = initialCourses }: Readonly<{ currentCourse?: string; dashboard?: boolean; onChange?: (courseSlug: string) => void; courses?: readonly { slug: string; title: string }[] }>) {
  const selected = currentCourse ?? courses[0]?.slug ?? '';

  const changeCourse = (courseSlug: string) => {
    if (!courseSlug) return;
    onChange?.(courseSlug);
    if (dashboard) {
      window.history.pushState({}, '', `/?course=${encodeURIComponent(courseSlug)}`);
    } else {
      window.location.href = `/learn/${courseSlug}`;
    }
  };

  return (
    <label className={styles.control}>
      <span className={styles.label}>Learning language</span>
      <select aria-label="Learning language" value={selected} onChange={(event) => changeCourse(event.target.value)}>
        {courses.map((course) => <option key={course.slug} value={course.slug}>{courseLabel(course.slug, course.title)}</option>)}
      </select>
      <span className={styles.chevron} aria-hidden="true">⌄</span>
    </label>
  );
}
