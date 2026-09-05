import { GET } from '@/app/api/demo/progress/route';

describe('GET /api/demo/progress', () => {
  it('returns a read-only no-store preview snapshot', async () => {
    // Break caught: serving a cacheable or incomplete progress preview.
    const response = await GET();

    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ xp: 0, dueReviewCount: 0 });
  });
});
