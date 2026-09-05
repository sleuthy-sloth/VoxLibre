import { z } from 'zod';
import { sessionTokenFromCookies } from '@/lib/auth/cookies';
import { verifySessionToken } from '@/lib/auth/session';
import { validateCsrfRequest } from '@/lib/auth/csrf';
import { appendPractice, pullPractice } from '@/lib/course-progress';
import { eventSchema, mergeEvents } from '@/features/course-pack/progress';
export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const batchSchema = z.object({ userId: z.string().min(1).max(100), events: z.array(eventSchema).max(100) });
async function identity(request: Request) {
  const token = sessionTokenFromCookies(request.headers.get('cookie') ?? '');
  return token ? (await verifySessionToken(token))?.userId : null;
}
export async function GET(request: Request) {
  const userId = await identity(request);
  if (!userId) return reply({ error: 'Sign in to synchronize account practice.' }, 401);
  const params = new URL(request.url).searchParams;
  if (!params.has('userId')) return reply({ userId }); // Explicit account selection handshake.
  if (params.get('userId') !== userId) return reply({ error: 'The signed-in account changed. Select account practice again.' }, 409);
  const after = params.get('after') ?? '0';
  if (!/^\d{1,18}$/.test(after)) return reply({ error: 'Invalid cursor.' }, 400);
  try {
    return reply({ userId, ...await pullPractice(userId, BigInt(after)) });
  } catch {
    return reply({ error: 'Account storage is unavailable. Local practice is safe; retry later.' }, 503);
  }
}
export async function POST(request: Request) {
  const userId = await identity(request);
  if (!userId) return reply({ error: 'Sign in to synchronize account practice.' }, 401);
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin || !validateCsrfRequest(request))
      return reply({ error: 'Refresh your sign-in before synchronizing.' }, 403);
  } catch { return reply({ error: 'Invalid CSRF token.' }, 403); }
  const reader = request.body?.getReader();
  if (!reader) return reply({ error: 'Missing events.' }, 400);
  let body;
  try {
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 128_000) { await reader.cancel(); return reply({ error: 'Batch too large.' }, 413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    body = batchSchema.parse(JSON.parse(new TextDecoder().decode(bytes)));
  } catch { return reply({ error: 'Invalid practice batch.' }, 400); }
  finally { reader.releaseLock(); }
  if (body.userId !== userId) return reply({ error: 'The signed-in account changed. Local practice was not uploaded.' }, 409);
  try {
    await appendPractice(userId, mergeEvents(body.events));
    return reply({ userId, saved: true });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Conflicting practice'))
      return reply({ error: 'Conflicting practice ID. No events in this batch were changed; retain your backup.' }, 409);
    return reply({ error: 'Account storage is unavailable. Local practice is safe; retry later.' }, 503);
  }
}
