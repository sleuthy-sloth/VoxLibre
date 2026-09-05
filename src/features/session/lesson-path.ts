import type { CourseFixture } from '@/features/curriculum/types';
import type { SessionStep } from './compose-session';

export function composeLessonSession(course: CourseFixture, conceptId: string, drillId?: string): readonly SessionStep[] {
  const concept = course.concepts.find(candidate => candidate.id === conceptId);
  if (!concept || (drillId && !concept.drills.some(drill => drill.id === drillId))) return [];
  return [
    { id: `${concept.id}-teach`, kind: 'NEW_PATTERN', courseSlug: course.slug, contentId: concept.id },
    ...concept.drills.filter(drill => drillId ? drill.id === drillId : drill.cefrLevel === concept.cefrLevel).map(drill => ({
      id: `${drill.id}-practice`, kind: 'DRILL' as const, courseSlug: course.slug, contentId: concept.id, drillId: drill.id,
    })),
    { id: `${concept.id}-recall`, kind: 'REVIEW', courseSlug: course.slug, contentId: concept.id },
  ];
}
