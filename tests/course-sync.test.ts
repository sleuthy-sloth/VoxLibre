import { beforeEach, expect, it, vi } from 'vitest';
const local = vi.hoisted(() => ({ read: vi.fn(), store: vi.fn() }));
vi.mock('@/features/course-pack/storage', () => ({ readEvents: local.read, storeEvents: local.store }));
import { synchronizePractice } from '@/features/course-pack/sync';
const event = { id: 'remote', packId: 'it-foundations', version: '1.0.0', exerciseId: 'one', at: '2026-09-05T10:00:00.000Z', correct: true, revealed: false };
const pending = { ...event, id: 'pending' };
const fetchMock = vi.fn();
beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal('fetch', fetchMock); local.read.mockResolvedValue([event, pending]); local.store.mockResolvedValue(undefined); });
it('persists downloaded events before uploading only missing local events', async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ userId: 'a', events: [event], nextCursor: null })).mockResolvedValueOnce(Response.json({ userId: 'a', saved: true }));
  await synchronizePractice('a');
  expect(local.store).toHaveBeenCalledWith([event], 'a');
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ userId: 'a', events: [pending] });
  expect(local.store.mock.invocationCallOrder[0]).toBeLessThan(fetchMock.mock.invocationCallOrder[1]);
});
it('does not upload under a changed account', async () => {
  fetchMock.mockResolvedValue(Response.json({ userId: 'b', events: [], nextCursor: null }));
  await expect(synchronizePractice('a')).rejects.toThrow(/account/i);
  expect(local.store).not.toHaveBeenCalled(); expect(fetchMock).toHaveBeenCalledTimes(1);
});
it('never acknowledges a download that failed local persistence', async () => {
  fetchMock.mockResolvedValue(Response.json({ userId: 'a', events: [event], nextCursor: null }));
  local.store.mockRejectedValue(new Error('Quota exceeded'));
  await expect(synchronizePractice('a')).rejects.toThrow('Quota');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it('retries an interrupted upload with identical mutation IDs', async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ userId: 'a', events: [], nextCursor: null })).mockRejectedValueOnce(new Error('Offline'));
  await expect(synchronizePractice('a')).rejects.toThrow('Offline');
  const sent = fetchMock.mock.calls[1][1].body;
  fetchMock.mockResolvedValueOnce(Response.json({ userId: 'a', events: [], nextCursor: null })).mockResolvedValueOnce(Response.json({ userId: 'a', saved: true }));
  await synchronizePractice('a');
  expect(fetchMock.mock.calls[3][1].body).toBe(sent);
});
it('walks every page and does not duplicate already synchronized events', async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ userId: 'a', events: [event], nextCursor: '500' })).mockResolvedValueOnce(Response.json({ userId: 'a', events: [pending], nextCursor: null }));
  await synchronizePractice('a');
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[1][0]).toContain('after=500');
});
