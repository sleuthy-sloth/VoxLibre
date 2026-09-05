import { NextResponse } from 'next/server';

import { blankDemoProgress } from '@/features/progress/demo-progress';
import { getProgressSnapshot } from '@/lib/progress/snapshot';
import { verifySessionToken } from '@/lib/auth/session';
import { sessionTokenFromCookies } from '@/lib/auth/cookies';
import { withObserve } from '@/lib/observe';

async function getHandler(request?: Request) {
  const req = request ?? new Request('http://localhost/api/demo/progress');
  const cookieHeader = req.headers.get('cookie') ?? '';
  const token = sessionTokenFromCookies(cookieHeader);

  if (token) {
    const session = await verifySessionToken(token);
    if (session) {
      const snapshot = await getProgressSnapshot(session.userId);
      return NextResponse.json(snapshot, {
        headers: { 'Cache-Control': 'no-store' },
      });
    }
  }

  return NextResponse.json(blankDemoProgress, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export const GET = withObserve('/api/demo/progress', getHandler as unknown as (req?: Request) => Promise<Response>);
