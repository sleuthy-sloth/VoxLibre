import { z } from 'zod';
import { csrfHeaders } from '../../lib/auth/cookies';
import { eventSchema, mergeEvents, type PracticeEvent } from './progress';
import { readEvents, storeEvents } from './storage';
const pageSchema = z.object({ userId: z.string(), events: z.array(eventSchema).max(500), nextCursor: z.string().regex(/^\d{1,18}$/).nullable() });
async function responseJson(response: Response) {
  const body = await response.json();
  if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Synchronization failed. Local practice is safe.');
  return body;
}
export async function identifyAccount(): Promise<string> {
  const body = await responseJson(await fetch('/api/course-progress', { cache: 'no-store', credentials: 'same-origin' }));
  return z.string().min(1).max(100).parse(body.userId);
}
export async function synchronizePractice(userId: string, signal?: AbortSignal) {
  let after = '0';
  const remote: PracticeEvent[] = [];
  do {
    const response = await fetch(`/api/course-progress?userId=${encodeURIComponent(userId)}&after=${after}`, { cache: 'no-store', credentials: 'same-origin', signal });
    const page = pageSchema.parse(await responseJson(response));
    if (page.userId !== userId) throw new Error('The signed-in account changed. Local practice was not uploaded.');
    if (page.nextCursor && BigInt(page.nextCursor) <= BigInt(after)) throw new Error('Invalid synchronization cursor. Retry later.');
    await storeEvents(page.events, userId);
    remote.push(...page.events);
    if (!page.nextCursor) break;
    after = page.nextCursor;
  } while (!signal?.aborted);
  if (signal?.aborted) throw new Error('Synchronization interrupted. Local practice is safe.');
  const local = await readEvents(userId);
  mergeEvents(remote, local); // Reject conflicting IDs instead of silently overwriting either copy.
  const known = new Set(remote.map(e => e.id));
  const pending = local.filter(e => !known.has(e.id));
  for (let offset = 0; offset < pending.length; offset += 100) {
    const body = await responseJson(await fetch('/api/course-progress', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store', signal,
      headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
      body: JSON.stringify({ userId, events: pending.slice(offset, offset + 100) }),
    }));
    if (body.userId !== userId || body.saved !== true) throw new Error('Account synchronization was not acknowledged. Local practice is safe.');
  }
  return readEvents(userId);
}
