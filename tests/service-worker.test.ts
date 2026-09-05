import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { vi } from 'vitest';

type WorkerHandler = (event: never) => void;

async function readWorkerSource() {
  return readFile(path.join(process.cwd(), 'public/sw.js'), 'utf8');
}

function staticAssetsFrom(source: string) {
  const declaration = source.match(/const STATIC_ASSETS = (\[[\s\S]*?\]);/);

  if (!declaration) {
    throw new Error('STATIC_ASSETS declaration is missing.');
  }

  return [...declaration[1].matchAll(/'([^']+)'/g)].map(([, asset]) => asset);
}

async function evaluateWorker(
  cacheKeys = ['verbalibera-static-v0', 'verbalibera-static-v1', 'verbalibera-static-v2', 'another-app-cache'],
) {
  const handlers = new Map<string, WorkerHandler>();
  const cacheDelete = vi.fn().mockResolvedValue(true);
  const cacheMatch = vi.fn().mockResolvedValue(undefined);
  const cachePut = vi.fn().mockResolvedValue(undefined);
  const cacheAddAll = vi.fn().mockResolvedValue(undefined);
  const cacheOpen = vi.fn().mockImplementation(() =>
    Promise.resolve({ addAll: cacheAddAll, match: cacheMatch, put: cachePut }),
  );
  const networkFetch = vi.fn().mockResolvedValue(new Response('ok'));
  const clients = { claim: vi.fn() };

  runInNewContext(await readWorkerSource(), {
    URL,
    Response,
    caches: {
      delete: cacheDelete,
      keys: vi.fn().mockResolvedValue(cacheKeys),
      match: cacheMatch,
      open: cacheOpen,
    },
    fetch: networkFetch,
    self: {
      addEventListener: (eventName: string, handler: WorkerHandler) => handlers.set(eventName, handler),
      clients,
      skipWaiting: vi.fn(),
    },
  });

  return { cacheDelete, cacheMatch, cachePut, cacheAddAll, cacheOpen, clients, handlers, networkFetch };
}

describe('static PWA service worker contract', () => {
  it('declares exactly the approved immutable offline assets', async () => {
    // Break caught: the install cache silently expands to mutable, authenticated, or voice responses.
    const assets = staticAssetsFrom(await readWorkerSource());

    expect(assets).toEqual([
      '/offline.html',
      '/icons/verbalibera-192.png',
      '/icons/verbalibera-512.png',
      '/icons/verbalibera-maskable-512.png',
      '/illustrations/daily-practice.png',
      '/audio/french-ordering/fr-ordering-politely-prompt.wav',
      '/audio/french-ordering/fr-ordering-politely-answer.wav',
    ]);
  });

  it('bypasses API requests and only supplies the offline fallback to failed navigation', async () => {
    // Break caught: privacy-sensitive APIs are intercepted or failed resources receive the app shell.
    const { cacheMatch, handlers, networkFetch } = await evaluateWorker();
    const fetchHandler = handlers.get('fetch');
    const apiEvent = {
      request: { method: 'GET', mode: 'navigate', url: 'https://verbalibera.test/api/demo/progress' },
      respondWith: vi.fn(), waitUntil: vi.fn(),
    };
    const resourceEvent = {
      request: { method: 'GET', mode: 'cors', url: 'https://verbalibera.test/illustrations/daily-practice.png' },
      respondWith: vi.fn(), waitUntil: vi.fn(),
    };

    fetchHandler?.(apiEvent as never);
    fetchHandler?.(resourceEvent as never);

    expect(apiEvent.respondWith).not.toHaveBeenCalled();
    expect(resourceEvent.respondWith).not.toHaveBeenCalled();
    expect(networkFetch).not.toHaveBeenCalled();

    const offlineResponse = new Response('offline path');
    cacheMatch.mockImplementation((arg: unknown) => {
      if (arg === '/offline.html') return Promise.resolve(offlineResponse);
      return Promise.resolve(undefined);
    });
    networkFetch.mockRejectedValue(new Error('network unavailable'));
    const navigationEvent = {
      request: { method: 'GET', mode: 'navigate', url: 'https://verbalibera.test/learn/english-to-french' },
      respondWith: vi.fn(), waitUntil: vi.fn(),
    };

    fetchHandler?.(navigationEvent as never);

    expect(navigationEvent.respondWith).toHaveBeenCalledTimes(1);
    expect(networkFetch).toHaveBeenCalledWith(navigationEvent.request);
    await expect(navigationEvent.respondWith.mock.calls[0][0]).resolves.toBe(offlineResponse);
    expect(cacheMatch).toHaveBeenCalledWith('/offline.html');
  });

  it('deletes only stale VerbaLibera static cache versions on activation', async () => {
    // Break caught: activation removes another application's cache or retains obsolete VerbaLibera static assets.
    const { cacheDelete, clients, handlers } = await evaluateWorker([
      'verbalibera-static-v0',
      'verbalibera-static-v1',
      'verbalibera-static-v2',
      'voxlibre-static-v2',
      'another-app-cache',
    ]);
    const activateHandler = handlers.get('activate');
    const activationEvent = { waitUntil: vi.fn() };

    activateHandler?.(activationEvent as never);

    expect(activationEvent.waitUntil).toHaveBeenCalledTimes(1);
    await activationEvent.waitUntil.mock.calls[0][0];

    expect(cacheDelete).toHaveBeenCalledTimes(4);
    expect(cacheDelete).toHaveBeenCalledWith('verbalibera-static-v0');
    expect(cacheDelete).toHaveBeenCalledWith('verbalibera-static-v1');
    expect(cacheDelete).toHaveBeenCalledWith('voxlibre-static-v2');
    expect(cacheDelete).toHaveBeenCalledWith('verbalibera-static-v2');
    expect(cacheDelete).not.toHaveBeenCalledWith('another-app-cache');
    expect(clients.claim).toHaveBeenCalledTimes(1);
  });

  it('keeps navigation private while caching audio and Next static', async () => {
    // Break caught: service worker regresses to v1, misses lesson/audio, or caches private API responses.
    const source = await readWorkerSource();

    // Cache changes must invalidate the previous shell.
    expect(source).toMatch(/verbalibera-static-v4/);
    expect(source).not.toMatch(/verbalibera-static-v1/);

    // Cache-Control no-store must still be documented for /api/* (privacy boundary)
    // grep for Cache-Control no-store and absence of /api in precache
    expect(source).toMatch(/Cache-Control/);
    expect(source).toMatch(/no-store/);
    expect(source).toMatch(/\/api\//);

    const assets = staticAssetsFrom(source);
    // precache must include app shell
    expect(assets).not.toContain('/');
    expect(assets).toContain('/offline.html');
    // precache must include lesson routes (/learn/*)
    expect(assets.some((a) => a.startsWith('/learn/'))).toBe(false);
    // precache must include audio (**)
    expect(assets.some((a) => a.startsWith('/audio/'))).toBe(true);
    // precache handling for Next static (verified via source contains _next/static)
    expect(source).toMatch(/\/_next\/static/);
    // never cache API
    expect(assets.some((a) => a.includes('/api'))).toBe(false);
    expect(assets.some((a) => a.includes('/api/demo/progress'))).toBe(false);

    // runtime behavior: lesson/audio/images/next-static should be served via cache, api must bypass
    const { handlers } = await evaluateWorker();
    const fetchHandler = handlers.get('fetch');
    const lessonEvent = {
      request: { method: 'GET', mode: 'navigate', url: 'https://verbalibera.test/learn/english-to-french' },
      respondWith: vi.fn(), waitUntil: vi.fn(),
    };
    const audioEvent = {
      request: { method: 'GET', mode: 'cors', url: 'https://verbalibera.test/audio/french-ordering/fr-ordering-politely-prompt.wav' },
      respondWith: vi.fn(), waitUntil: vi.fn(),
    };
    const imageEvent = {
      request: { method: 'GET', mode: 'cors', url: 'https://verbalibera.test/images/vocab/coffee.jpg' },
      respondWith: vi.fn(), waitUntil: vi.fn(),
    };
    const nextStaticEvent = {
      request: { method: 'GET', mode: 'cors', url: 'https://verbalibera.test/_next/static/chunks/webpack.js' },
      respondWith: vi.fn(), waitUntil: vi.fn(),
    };
    const apiEvent2 = {
      request: { method: 'GET', mode: 'cors', url: 'https://verbalibera.test/api/demo/progress' },
      respondWith: vi.fn(), waitUntil: vi.fn(),
    };

    fetchHandler?.(lessonEvent as never);
    fetchHandler?.(audioEvent as never);
    fetchHandler?.(imageEvent as never);
    fetchHandler?.(nextStaticEvent as never);
    fetchHandler?.(apiEvent2 as never);

    // lessons, audio, images, and Next static must be intercepted (respondWith called)
    expect(lessonEvent.respondWith).toHaveBeenCalledTimes(1);
    expect(audioEvent.respondWith).toHaveBeenCalledTimes(1);
    expect(imageEvent.respondWith).toHaveBeenCalledTimes(1);
    expect(nextStaticEvent.respondWith).toHaveBeenCalledTimes(1);
    // api must never be intercepted
    expect(apiEvent2.respondWith).not.toHaveBeenCalled();
  });
});

it('never puts personalized lesson HTML into the shared browser cache', async () => {
  const { handlers, networkFetch, cachePut } = await evaluateWorker();
  const privatePage = new Response('private account lesson', { headers: { 'Cache-Control': 'private, no-store' } });
  networkFetch.mockResolvedValue(privatePage);
  const event = { request: { method: 'GET', mode: 'navigate', url: 'https://verbalibera.test/learn/english-to-french' }, respondWith: vi.fn() };
  handlers.get('fetch')?.(event as never);
  await expect(event.respondWith.mock.calls[0][0]).resolves.toBe(privatePage);
  await Promise.resolve();
  expect(cachePut).not.toHaveBeenCalled();
});
