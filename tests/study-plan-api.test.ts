import { beforeEach, expect, it, vi } from 'vitest';
import { generatePlan } from '@/features/study-plan/generate';
import { initialCourses } from '@/features/curriculum/fixture';
const db = vi.hoisted(() => ({ session: vi.fn(), findFirst: vi.fn(), create: vi.fn(), deleteMany: vi.fn(), progress: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ verifySessionToken: db.session }));
vi.mock('@/lib/prisma', () => ({ prisma: { studyPlan: { findFirst: db.findFirst, create: db.create, deleteMany: db.deleteMany }, userProgress: { findMany: db.progress } } }));
import { GET, POST, DELETE } from '@/app/api/study-plan/route';
const slug = 'english-to-french';
const plan = generatePlan({ courseSlug: slug, startCefr: 'A1', startConceptId: 'fr-greet-politely', targetLevel: 'B1', daysPerWeek: 5, minutesPerDay: 8, startDate: '2026-09-07' }, initialCourses[0].concepts);
function request(method = 'GET', body?: unknown, headers: Record<string, string> = {}, userId = 'user-a') {
  return new Request(`http://localhost/api/study-plan?courseSlug=${slug}&userId=${userId}`, { method, headers: { cookie: 'verbalibera_session=token; verbalibera_csrf=abc', 'x-csrf-token': 'abc', origin: 'http://localhost', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
beforeEach(() => { vi.resetAllMocks(); db.session.mockResolvedValue({ userId: 'user-a' }); db.findFirst.mockResolvedValue(null); db.progress.mockResolvedValue([]); });
it('requires authentication and rejects a changed account', async () => {
  expect((await GET(request('GET', undefined, { cookie: '' }))).status).toBe(401);
  expect((await POST(request('POST', { plan }, {}, 'user-b'))).status).toBe(409);
  expect(db.create).not.toHaveBeenCalled();
});
it('requires matching origin and CSRF for saves and resets', async () => {
  expect((await POST(request('POST', { plan }, { origin: 'https://elsewhere.test' }))).status).toBe(403);
  expect((await DELETE(request('DELETE', undefined, { 'x-csrf-token': '' }))).status).toBe(403);
  expect(db.create).not.toHaveBeenCalled(); expect(db.deleteMany).not.toHaveBeenCalled();
});
it('saves a validated plan under the authenticated account', async () => {
  const response = await POST(request('POST', { plan, userId: 'attacker' }));
  expect(response.status).toBe(200);
  expect(db.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'user-a', courseSlug: slug, planJson: plan }) });
  expect(response.headers.get('cache-control')).toBe('no-store');
});
it('rejects malformed references and oversized requests', async () => {
  expect((await POST(request('POST', { plan: { ...plan, weeks: [null] } }))).status).toBe(400);
  expect((await POST(request('POST', { plan: { ...plan, courseSlug: 'english-to-italian' } }))).status).toBe(400);
  expect((await POST(request('POST', { data: 'x'.repeat(260000) }))).status).toBe(413);
  expect(db.create).not.toHaveBeenCalled();
});
it('loads the account plan and derives progress from saved retrieval', async () => {
  db.findFirst.mockResolvedValue({ planJson: plan });
  db.progress.mockResolvedValue([{ drillItemId: 'fr-greet-politely-drill', lastQuality: 4 }]);
  const result = await (await GET(request())).json();
  expect(result.plan).toEqual(plan);
  expect(Object.keys(result.done).length).toBeGreaterThan(0);
  expect(db.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-a', courseSlug: slug } }));
});
it('resets only this account and course', async () => {
  expect((await DELETE(request('DELETE'))).status).toBe(200);
  expect(db.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-a', courseSlug: slug } });
});
it('reports database failure without claiming a save', async () => {
  db.create.mockRejectedValue(new Error('offline'));
  expect((await POST(request('POST', { plan }))).status).toBe(503);
});
