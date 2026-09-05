import { describe, it, expect } from 'vitest';
import { initialCourses } from '@/features/curriculum/fixture';
import { composeLessonSession } from '@/features/session/lesson-path';

describe('a coherent teaching-first lesson', () => {
  it('only practices the pattern just taught', () => {
    const course = initialCourses[0];
    const steps = composeLessonSession(course, course.concepts[2].id);
    expect(steps[0]).toMatchObject({ kind: 'NEW_PATTERN', contentId: course.concepts[2].id });
    expect(steps.every(step => step.contentId === course.concepts[2].id)).toBe(true);
    expect(steps.filter(step => step.kind === 'DRILL')).toHaveLength(4);
  });
  it('does not invent a lesson or automatically insert untaught stretch grammar', () => {
    expect(composeLessonSession(initialCourses[0], 'missing')).toEqual([]);
    const steps = composeLessonSession(initialCourses[0], 'fr-ordering-politely');
    expect(steps.some(step => step.kind === 'DRILL' && step.drillId.endsWith('-cloze'))).toBe(false);
  });
});

it('opens an explicitly requested plan drill with its teaching, including stretch practice', () => {
  const steps = composeLessonSession(initialCourses[0], 'fr-ordering-politely', 'fr-ordering-politely-cloze');
  expect(steps).toHaveLength(3);
  expect(steps[0].kind).toBe('NEW_PATTERN');
  expect(steps[1]).toMatchObject({ kind: 'DRILL', drillId: 'fr-ordering-politely-cloze' });
  expect(composeLessonSession(initialCourses[0], 'fr-ordering-politely', 'it-ordering-politely-cloze')).toEqual([]);
});
