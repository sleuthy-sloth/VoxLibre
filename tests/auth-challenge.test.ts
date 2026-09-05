import { describe, it, expect, vi } from 'vitest';
import { consumeChallenge } from '@/lib/auth/challenge';
vi.mock('@/lib/prisma', () => ({ prisma: { authChallenge: { findUnique: vi.fn(), deleteMany: vi.fn() } } }));
import { prisma } from '@/lib/prisma';

describe('server-issued authentication challenges', () => {
  it('rejects requests without a challenge cookie', async () => {
    expect(await consumeChallenge(new Request('https://example.com'), 'login')).toBeNull();
  });
  it('rejects expired challenges and challenges for another operation', async () => {
    vi.mocked(prisma.authChallenge.findUnique).mockResolvedValue({ id: 'nonce', purpose: 'register', expiresAt: new Date(0) } as never);
    expect(await consumeChallenge(new Request('https://example.com', { headers: { cookie: 'verbalibera_challenge=nonce' } }), 'login')).toBeNull();
  });
  it('returns a challenge once and rejects a replay', async () => {
    const stored = { id: 'nonce', purpose: 'login', challenge: 'server-random', accountIdentifier: null, expiresAt: new Date(Date.now() + 60000) };
    vi.mocked(prisma.authChallenge.findUnique).mockResolvedValue(stored);
    vi.mocked(prisma.authChallenge.deleteMany).mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const request = new Request('https://example.com', { headers: { cookie: 'verbalibera_challenge=nonce' } });
    expect(await consumeChallenge(request, 'login')).toEqual(stored);
    expect(await consumeChallenge(request, 'login')).toBeNull();
  });
});

it('consumes an unexpired challenge using the current time, not its own expiry', async () => {
  const now = new Date('2026-09-05T12:00:00Z');
  vi.useFakeTimers(); vi.setSystemTime(now);
  try {
    const expiresAt = new Date('2026-09-05T12:05:00Z');
    vi.mocked(prisma.authChallenge.findUnique).mockResolvedValue({ id: 'valid', purpose: 'login', challenge: 'server-random', accountIdentifier: null, expiresAt });
    vi.mocked(prisma.authChallenge.deleteMany).mockResolvedValue({ count: 1 });
    await consumeChallenge(new Request('https://example.com', { headers: {cookie: 'verbalibera_challenge=valid'} }), 'login');
    expect(prisma.authChallenge.deleteMany).toHaveBeenLastCalledWith({where: {id: 'valid', purpose: 'login', expiresAt: {equals: expiresAt, gt: now}}});
  } finally {vi.useRealTimers();}
});
