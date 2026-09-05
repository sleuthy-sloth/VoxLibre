import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), pull: vi.fn(), append: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ verifySessionToken: mocks.session }));
vi.mock('@/lib/course-progress', () => ({ pullPractice: mocks.pull, appendPractice: mocks.append }));
import { GET, POST } from '@/app/api/course-progress/route';
const event = { id: 'one', packId: 'it-foundations', version: '1.0.0', exerciseId: 'one', at: '2026-09-05T10:00:00.000Z', correct: true, revealed: false };
const request = (body: unknown, extra: Record<string, string> = {}) => new Request('http://localhost/api/course-progress', {
  method: 'POST', headers: { cookie: 'verbalibera_session=token; verbalibera_csrf=abc', 'x-csrf-token': 'abc', origin: 'http://localhost', ...extra }, body: JSON.stringify(body),
});
beforeEach(() => { vi.resetAllMocks(); mocks.session.mockResolvedValue({ userId: 'user-a' }); mocks.pull.mockResolvedValue({ events: [event], nextCursor: null }); });
it('rejects unauthenticated reads without accessing progress', async () => {
  expect((await GET(new Request('http://localhost/api/course-progress'))).status).toBe(401);
  expect(mocks.pull).not.toHaveBeenCalled();
});
it('rejects account changes before reading or writing', async () => {
  expect((await POST(request({ userId: 'user-b', events: [event] }))).status).toBe(409);
  expect((await GET(new Request('http://localhost/api/course-progress?userId=user-b', { headers: { cookie: 'verbalibera_session=token' } }))).status).toBe(409);
  expect(mocks.append).not.toHaveBeenCalled(); expect(mocks.pull).not.toHaveBeenCalled();
});
it('requires CSRF and matching origin', async () => {
  expect((await POST(request({}, { 'x-csrf-token': '' }))).status).toBe(403);
  expect((await POST(request({}, { origin: 'https://elsewhere.example' }))).status).toBe(403);
});
it('validates batches and rejects oversized bodies', async () => {
  expect((await POST(request({ userId: 'user-a', events: Array(101).fill(event) }))).status).toBe(400);
  expect((await POST(request({ data: 'a'.repeat(130000) }))).status).toBe(413);
  expect(mocks.append).not.toHaveBeenCalled();
});
it('stores one copy of repeated events and never caches responses', async () => {
  const response = await POST(request({ userId: 'user-a', events: [event, event] }));
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(mocks.append).toHaveBeenCalledWith('user-a', [event]);
});
it('rejects conflicting payloads atomically before persistence', async () => {
  expect((await POST(request({ userId: 'user-a', events: [event, { ...event, correct: false }] }))).status).toBe(409);
  expect(mocks.append).not.toHaveBeenCalled();
});
