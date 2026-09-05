import { initialCourses } from '@/features/curriculum/fixture';
import { parseStoredPlacement } from '@/features/placement/parse';
import { sessionTokenFromCookies } from '@/lib/auth/cookies';
import { validateCsrfRequest } from '@/lib/auth/csrf';
import { verifySessionToken } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

async function context(request: Request) {
  const token = sessionTokenFromCookies(request.headers.get('cookie') ?? '');
  const userId = token ? (await verifySessionToken(token))?.userId : null;
  if (!userId) return reply({ error: 'Sign in to use an account placement result.' }, 401);
  const params = new URL(request.url).searchParams;
  // Bind writes to the account that loaded the quiz, including after a tab switches accounts.
  if (params.has('userId') && params.get('userId') !== userId) return reply({ error: 'Your account changed. Reload this page.' }, 409);
  const courseSlug = params.get('courseSlug') ?? '';
  if (!initialCourses.some(course => course.slug === courseSlug)) return reply({ error: 'Unknown course.' }, 400);
  if (request.method !== 'GET') {
    if (!params.has('userId')) return reply({ error: 'Reload this page before saving.' }, 409);
    try {
      if (request.headers.get('origin') !== new URL(request.url).origin || !validateCsrfRequest(request)) return reply({ error: 'Refresh your sign-in before saving.' }, 403);
    } catch { return reply({ error: 'Invalid CSRF token.' }, 403); }
  }
  return { userId, courseSlug };
}

export async function GET(request: Request) {
  const ctx = await context(request);
  if (ctx instanceof Response) return ctx;
  try {
    const stored = await prisma.placementResult.findFirst({ where: ctx, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    const result = stored
      ? parseStoredPlacement(
          {
            score: stored.score, total: stored.total, band: stored.band,
            startCefr: stored.startCefr, startConceptId: stored.startConceptId,
            stretchUnlocked: false, aboveContent: stored.band === 'B1+',
          },
          ctx.courseSlug,
        )
      : null;
    return reply({ userId: ctx.userId, result });
  } catch { return reply({ error: 'Account placement results are unavailable. Please retry.' }, 503); }
}

export async function POST(request: Request) {
  const ctx = await context(request);
  if (ctx instanceof Response) return ctx;
  const reader = request.body?.getReader();
  if (!reader) return reply({ error: 'Missing result.' }, 400);
  let raw: unknown;
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8_192) { await reader.cancel(); return reply({ error: 'Result too large.' }, 413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    raw = JSON.parse(new TextDecoder().decode(bytes));
  } catch { return reply({ error: 'Invalid result.' }, 400); }
  finally { reader.releaseLock(); }
  const result = parseStoredPlacement(raw && typeof raw === 'object' && 'result' in raw ? raw.result : null, ctx.courseSlug);
  if (!result) return reply({ error: 'Invalid result.' }, 400);
  try {
    // Append a revision; latest creation wins without a destructive read/delete race.
    await prisma.placementResult.create({
      data: {
        ...ctx,
        score: result.score, total: result.total, band: result.band,
        startCefr: result.startCefr, startConceptId: result.startConceptId,
      },
    });
    return reply({ saved: true });
  } catch { return reply({ error: 'Your result was not saved. Please retry.' }, 503); }
}

export async function DELETE(request: Request) {
  const ctx = await context(request);
  if (ctx instanceof Response) return ctx;
  try {
    await prisma.placementResult.deleteMany({ where: ctx });
    return reply({ saved: true });
  } catch { return reply({ error: 'Your result was not reset. Please retry.' }, 503); }
}
