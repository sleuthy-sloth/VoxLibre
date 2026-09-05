import Link from 'next/link';
import { cookies } from 'next/headers';
import { PlacementQuiz } from '@/components/placement/PlacementQuiz';
import { initialCourses } from '@/features/curriculum/fixture';
import { sessionTokenFromCookies } from '@/lib/auth/cookies';
import { verifySessionToken } from '@/lib/auth/session';

export default async function PlacementPage({
  params,
}: {
  params: Promise<{ courseSlug: string }>;
}) {
  const { courseSlug } = await params;
  const course = initialCourses.find((candidate) => candidate.slug === courseSlug);

  if (!course) {
    return (
      <main id="main-content">
        <p>VerbaLibera preview</p>
        <h1>This course is not available in preview.</h1>
        <Link href="/">Return to your daily path</Link>
      </main>
    );
  }

  const token = sessionTokenFromCookies((await cookies()).toString());
  const session = token ? await verifySessionToken(token) : null;
  return <PlacementQuiz key={`${courseSlug}:${session?.userId ?? 'guest'}`} courseSlug={courseSlug} userId={session?.userId ?? null} />;
}
