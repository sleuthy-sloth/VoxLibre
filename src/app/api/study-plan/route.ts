import { initialCourses } from '@/features/curriculum/fixture';
import { parseStoredPlan } from '@/features/study-plan/parse';
import { planDoneKeys } from '@/features/study-plan/today';
import { sessionTokenFromCookies } from '@/lib/auth/cookies';
import { validateCsrfRequest } from '@/lib/auth/csrf';
import { verifySessionToken } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

async function context(request: Request) {
  const token = sessionTokenFromCookies(request.headers.get('cookie') ?? '');
  const userId = token ? (await verifySessionToken(token))?.userId : null;
  if (!userId) return reply({ error: 'Sign in to use an account study plan.' }, 401);
  const params = new URL(request.url).searchParams;
  // Bind writes to the account that loaded the editor, including after a tab switches accounts.
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
    const stored = await prisma.studyPlan.findFirst({ where: ctx, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    const plan = stored ? parseStoredPlan(stored.planJson, ctx.courseSlug) : null;
    const progress = plan ? await prisma.userProgress.findMany({ where: { userId: ctx.userId }, select: { drillItemId: true, lastQuality: true } }) : [];
    const completed = new Set(progress.filter(row => (row.lastQuality ?? 0) >= 3).map(row => row.drillItemId));
    return reply({ userId: ctx.userId, plan, done: plan ? planDoneKeys(plan, completed) : {} });
  } catch { return reply({ error: 'Account plans are unavailable. Please retry.' }, 503); }
}

export async function POST(request: Request) {
  const ctx = await context(request);
  if (ctx instanceof Response) return ctx;
  const reader = request.body?.getReader();
  if (!reader) return reply({ error: 'Missing plan.' }, 400);
  let raw: unknown;
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 256_000) { await reader.cancel(); return reply({ error: 'Plan too large.' }, 413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    raw = JSON.parse(new TextDecoder().decode(bytes));
  } catch { return reply({ error: 'Invalid plan.' }, 400); }
  finally { reader.releaseLock(); }
  const plan = parseStoredPlan(raw && typeof raw === 'object' && 'plan' in raw ? raw.plan : null, ctx.courseSlug);
  if (!plan) return reply({ error: 'Invalid plan.' }, 400);
  try {
    // Append a revision; latest creation wins without a destructive read/delete race.
    await prisma.studyPlan.create({ data: { ...ctx, targetLevel: plan.targetLevel, daysPerWeek: plan.daysPerWeek, minutesPerDay: plan.minutesPerDay, startDate: plan.startDate, planJson: JSON.parse(JSON.stringify(plan)) } });
    return reply({ saved: true });
  } catch { return reply({ error: 'Your plan was not saved. Please retry.' }, 503); }
}

export async function DELETE(request: Request) {
  const ctx = await context(request);
  if (ctx instanceof Response) return ctx;
  try {
    await prisma.studyPlan.deleteMany({ where: ctx });
    return reply({ saved: true });
  } catch { return reply({ error: 'Your plan was not reset. Please retry.' }, 503); }
}
