import { beforeEach, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ session: vi.fn(), findFirst: vi.fn(), create: vi.fn(), deleteMany: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ verifySessionToken: db.session }));
vi.mock('@/lib/prisma', () => ({ prisma: { placementResult: { findFirst: db.findFirst, create: db.create, deleteMany: db.deleteMany } } }));
import { GET, POST, DELETE } from '@/app/api/placement/route';
const slug = 'english-to-french';
const result = {
  score: 12, total: 15, band: 'B1', startCefr: 'B1', startConceptId: 'fr-greet-politely',
  stretchUnlocked: false, aboveContent: false,
};
function request(method = 'GET', body?: unknown, headers: Record<string, string> = {}, userId = 'user-a') {
  return new Request(`http://localhost/api/placement?courseSlug=${slug}&userId=${userId}`, { method, headers: { cookie: 'verbalibera_session=token; verbalibera_csrf=abc', 'x-csrf-token': 'abc', origin: 'http://localhost', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
beforeEach(() => { vi.resetAllMocks(); db.session.mockResolvedValue({ userId: 'user-a' }); db.findFirst.mockResolvedValue(null); });
it('requires authentication and rejects a changed account', async () => {
  expect((await GET(request('GET', undefined, { cookie: '' }))).status).toBe(401);
  expect((await POST(request('POST', { result }, {}, 'user-b'))).status).toBe(409);
  expect(db.create).not.toHaveBeenCalled();
});
it('requires matching origin and CSRF for saves and resets', async () => {
  expect((await POST(request('POST', { result }, { origin: 'https://elsewhere.test' }))).status).toBe(403);
  expect((await DELETE(request('DELETE', undefined, { 'x-csrf-token': '' }))).status).toBe(403);
  expect(db.create).not.toHaveBeenCalled(); expect(db.deleteMany).not.toHaveBeenCalled();
});
it('saves a validated result under the authenticated account', async () => {
  const response = await POST(request('POST', { result }));
  expect(response.status).toBe(200);
  expect(db.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'user-a', courseSlug: slug, score: 12, total: 15, band: 'B1', startCefr: 'B1', startConceptId: 'fr-greet-politely' }) });
  expect(response.headers.get('cache-control')).toBe('no-store');
});
it('rejects malformed results and oversized requests', async () => {
  expect((await POST(request('POST', { result: { ...result, band: 'C2' } }))).status).toBe(400);
  expect((await POST(request('POST', { result: { ...result, score: 16 } }))).status).toBe(400);
  expect((await POST(request('POST', { result: { ...result, startConceptId: 'no-such-concept' } }))).status).toBe(400);
  expect((await POST(request('POST', { data: 'x'.repeat(9000) }))).status).toBe(413);
  expect(db.create).not.toHaveBeenCalled();
});
it('loads the account result for a known course', async () => {
  db.findFirst.mockResolvedValue({ ...result });
  const body = await (await GET(request())).json();
  expect(body.result).toMatchObject({ score: 12, band: 'B1', startConceptId: 'fr-greet-politely' });
  expect(db.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-a', courseSlug: slug } }));
});
it('resets only this account and course', async () => {
  expect((await DELETE(request('DELETE'))).status).toBe(200);
  expect(db.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-a', courseSlug: slug } });
});
it('reports database failure without claiming a save', async () => {
  db.create.mockRejectedValue(new Error('offline'));
  expect((await POST(request('POST', { result }))).status).toBe(503);
});
