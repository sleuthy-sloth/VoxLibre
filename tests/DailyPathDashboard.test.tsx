import { act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, vi } from 'vitest';
import {
  DailyPathDashboard,
} from '@/components/dashboard/DailyPathDashboard';
import { DashboardDataBoundary } from '@/components/dashboard/DashboardDataBoundary';
import styles from '@/components/dashboard/dashboard.module.css';
import { initialCourses } from '@/features/curriculum/fixture';
import { blankDemoProgress, demoProgress } from '@/features/progress/demo-progress';
import { generatePlan } from '@/features/study-plan/generate';
import { planItemKey } from '@/features/study-plan/today';

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function QueryTestProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>;
}

function maskCssComments(stylesheet: string) {
  return stylesheet.replace(/\/\*[\s\S]*?\*\//g, (comment) => ' '.repeat(comment.length));
}

function normalizeMediaCondition(condition: string) {
  return condition.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function topLevelMediaBlocks(stylesheet: string) {
  const blocks: Array<{ condition: string; content: string; start: number; end: number }> = [];
  const searchableStylesheet = maskCssComments(stylesheet).toLowerCase();
  let cursor = 0;

  while (cursor < stylesheet.length) {
    if (!searchableStylesheet.startsWith('@media', cursor)) {
      cursor += 1;
      continue;
    }

    const start = cursor;
    const openingBrace = searchableStylesheet.indexOf('{', start);
    let depth = 1;
    cursor = openingBrace + 1;

    while (cursor < stylesheet.length && depth > 0) {
      if (searchableStylesheet[cursor] === '{') depth += 1;
      if (searchableStylesheet[cursor] === '}') depth -= 1;
      cursor += 1;
    }

    if (openingBrace > -1 && depth === 0) {
      blocks.push({
        condition: normalizeMediaCondition(stylesheet.slice(start + '@media'.length, openingBrace)),
        content: stylesheet.slice(openingBrace + 1, cursor - 1),
        start,
        end: cursor,
      });
    }
  }

  return blocks;
}

function hasLegacyWidthCondition(condition: string, qualifier: 'min' | 'max', pixels: number) {
  return new RegExp(`${qualifier}-\\s*width\\s*:\\s*${pixels}\\s*px\\b`).test(condition);
}

function includesDesktopWidthAt760(condition: string) {
  return (
    hasLegacyWidthCondition(condition, 'min', 760) ||
    /\bwidth\s*>=\s*760\s*px\b/.test(condition) ||
    /\b760\s*px\s*<=\s*width\b/.test(condition)
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DailyPathDashboard', () => {
  it('turns preview progress into a sequential daily practice path', () => {
    // Break caught: the dashboard loses its primary session entry point or progress summary.
    render(<DailyPathDashboard progress={demoProgress} />);

    expect(screen.getByRole('heading', { level: 1, name: /VerbaLibera/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /continue 8-minute session/i })).toHaveAttribute(
      'href',
      '/learn/english-to-french',
    );
    expect(screen.getByText(/5 of 5 daily steps/i)).toBeInTheDocument();
    expect(screen.getByText(/4-day practice flow/i)).toBeInTheDocument();
    expect(screen.getByText(/28 reviews waiting/i)).toBeInTheDocument();
    expect(screen.getByText(/preview progress/i)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Italian: A1 patterns' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /daily goal/i })).toHaveAttribute(
      'aria-valuetext',
      '5 of 5 daily steps',
    );
  });

  it('switches the displayed course using only preview data', async () => {
    // Break caught: local course selection mutates preview data or links to a session the snapshot did not provide.
    const user = userEvent.setup();
    render(<DailyPathDashboard progress={demoProgress} />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Learning language' }), 'english-to-italian');

    expect(screen.getByRole('link', { name: /continue 8-minute session/i })).toHaveAttribute(
      'href',
      '/learn/english-to-italian',
    );
    expect(screen.getByText(/5 of 5 daily steps/i)).toBeInTheDocument();
    expect(demoProgress.selectedCourseSlug).toBe('english-to-french');
  });

  it('renders every available course instead of assuming a fixed language pair', () => {
    // Break caught: adding a course leaves it inaccessible behind French/Italian-specific selector copy.
    render(
      <DailyPathDashboard
        progress={{
          ...demoProgress,
          selectedCourseSlug: 'english-to-german',
          courses: [
            ...demoProgress.courses,
            {
              slug: 'english-to-german',
              title: 'English to German: A1 patterns',
              unitLabel: 'Unit 1: Meeting someone',
              completionPercent: 10,
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole('option', { name: 'German: A1 patterns' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Learning language' })).toHaveValue('english-to-german');
  });

  it('renders generic course segments in the header', () => {
    // Break caught: course selection falls back to a separate, language-specific course lane.
    render(<DailyPathDashboard progress={demoProgress} />);

    expect(screen.getByRole('combobox', { name: 'Learning language' })).toHaveValue('english-to-french');
    expect(screen.queryByRole('heading', { name: /your course lane/i })).not.toBeInTheDocument();
  });

  it('keeps goal and three steps in the Today card', () => {
    // Break caught: daily-path content is split between a session card and a separate path section.
    render(<DailyPathDashboard progress={demoProgress} />);

    const today = screen.getByRole('region', { name: /today's 8-minute path/i });
    expect(today).toHaveTextContent('Learn');
    expect(today).toHaveTextContent('Practice');
    expect(today).toHaveTextContent('Remember');
    expect(within(today).getByRole('progressbar', { name: /daily goal/i })).toBeInTheDocument();
  });

  it('shows the review queue once, in Progress snapshot', () => {
    // Break caught: the review count is repeated in the daily path instead of living in the secondary snapshot.
    render(<DailyPathDashboard progress={demoProgress} />);

    expect(screen.getAllByText(/28 reviews waiting/i)).toHaveLength(1);
  });

  it('does not link an available course to a session that has not been supplied yet', () => {
    // Break caught: selecting a future course sends the learner to an unavailable guided-session route.
    render(
      <DailyPathDashboard
        progress={{
          ...demoProgress,
          selectedCourseSlug: 'english-to-german',
          session: [
            ...demoProgress.session,
            { id: 'de-greeting-drill-1', kind: 'DRILL', courseSlug: 'english-to-german', contentId: 'de-greeting', drillId: 'de-greeting-drill' },
          ],
          courses: [
            ...demoProgress.courses,
            {
              slug: 'english-to-german',
              title: 'English to German: A1 patterns',
              unitLabel: 'Unit 1: Meeting someone',
              completionPercent: 10,
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('Session preview coming soon')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /continue 8-minute session/i })).not.toBeInTheDocument();
  });

  it('uses caught-up copy when no reviews are due', () => {
    // Break caught: a zero review count is announced as work waiting anywhere on the path.
    render(<DailyPathDashboard progress={{ ...demoProgress, dueReviewCount: 0 }} />);

    expect(screen.getByText(/You're caught up — one pattern tomorrow keeps the flow\./)).toBeInTheDocument();
    expect(screen.queryByText(/bring six phrases back into reach/i)).not.toBeInTheDocument();
  });

  it('keeps the session action in the responsive dashboard hierarchy', () => {
    // Break caught: the mobile layout loses its root hook or its prominent action target.
    window.innerWidth = 390;
    render(<DailyPathDashboard progress={demoProgress} />);

    expect(screen.getByRole('main')).toHaveClass(styles.dashboard);
    expect(screen.getByRole('link', { name: /continue 8-minute session/i })).toHaveClass(
      styles.primaryAction,
    );
  });

  it('keeps the 760px boundary in the one-column, full-width-action layout', () => {
    // Break caught: a desktop breakpoint at 760px turns the binding mobile boundary into two columns.
    const dashboardStyles = readFileSync(
      resolve(process.cwd(), 'src/components/dashboard/dashboard.module.css'),
      'utf8',
    );
    const mediaBlocks = topLevelMediaBlocks(dashboardStyles);
    const desktopBlock = mediaBlocks.find((block) =>
      hasLegacyWidthCondition(block.condition, 'min', 761),
    );
    const mobileBlock = mediaBlocks.find((block) =>
      hasLegacyWidthCondition(block.condition, 'max', 760),
    );
    const desktopGrid = /\.dashboardGrid\s*\{[^}]*grid-template-columns\s*:/;
    const stickyProgress = /\.progressPanel\s*\{[^}]*position\s*:\s*sticky\s*;/;
    const fullWidthCta = /\.primaryAction\s*,\s*\.pendingAction\s*\{[^}]*width\s*:\s*100%\s*;/;

    expect(mediaBlocks.some((block) => includesDesktopWidthAt760(block.condition))).toBe(false);
    expect(desktopBlock).toBeDefined();
    expect(mobileBlock).toBeDefined();
    expect(desktopBlock?.content).toMatch(desktopGrid);
    expect(desktopBlock?.content).toMatch(stickyProgress);
    expect(mobileBlock?.content).toMatch(fullWidthCta);
    expect(mobileBlock?.content).not.toMatch(desktopGrid);
    expect(mobileBlock?.content).not.toMatch(stickyProgress);
    expect(desktopBlock?.content).not.toMatch(fullWidthCta);

    const outsideDesktop = dashboardStyles.slice(0, desktopBlock?.start) + dashboardStyles.slice(desktopBlock?.end);
    const outsideMobile = dashboardStyles.slice(0, mobileBlock?.start) + dashboardStyles.slice(mobileBlock?.end);
    expect(outsideDesktop).not.toMatch(desktopGrid);
    expect(outsideDesktop).not.toMatch(stickyProgress);
    expect(outsideMobile).not.toMatch(fullWidthCta);
  });

  it.each([
    '@media (min-width: 760px)',
    '@MEDIA (MIN-WIDTH: /* boundary */ 760PX)',
    '@media (width >= 760px)',
    '@MEDIA (WIDTH /* boundary */ >= 760PX)',
    '@media (760px <= width)',
    '@MEDIA (760PX /* boundary */ <= WIDTH)',
  ])('recognizes a forbidden desktop boundary condition in %s', (mediaQuery) => {
    // Break caught: a desktop query at 760px evades the guard through syntax, operand order, comments, or casing.
    const mediaBlocks = topLevelMediaBlocks(`${mediaQuery} { .futureRule { display: grid; } }`);

    expect(mediaBlocks).toHaveLength(1);
    expect(includesDesktopWidthAt760(mediaBlocks[0]?.condition ?? '')).toBe(true);
  });

  it('exposes high-contrast styling hooks on mixed-color focus and small-text surfaces', () => {
    // Break caught: focus falls back to the low-contrast coral ring or small indigo copy loses its contrast surface.
    render(<DailyPathDashboard progress={demoProgress} />);

    expect(screen.getByRole('main')).toHaveClass(styles.focusSurface);
    expect(screen.getByText('Up next')).toHaveClass(styles.contrastTag);
    expect(screen.getByText('English to French: A1 patterns')).toHaveClass(styles.courseMeta);
    expect(screen.getByRole('combobox', { name: 'Learning language' })).toBeInTheDocument();
  });

  it('keeps every small metric label on the accessible Ink contrast hook', () => {
    // Break caught: metric labels fall back to the low-contrast 58%-Ink mixture on Cloud.
    render(<DailyPathDashboard progress={demoProgress} />);

    expect(screen.getByText('Total XP')).toHaveClass(styles.metricLabel);
    expect(screen.getByText('Practice flow')).toHaveClass(styles.metricLabel);
    expect(screen.getByText('Review queue')).toHaveClass(styles.metricLabel);
  });

  it('uses the original daily-practice illustration as decorative dashboard support', () => {
    // Break caught: the approved original supporting illustration is removed or announced redundantly.
    render(<DailyPathDashboard progress={demoProgress} />);

    const illustration = screen.getByAltText('');
    expect(illustration).toHaveAttribute('src', expect.stringContaining('daily-practice.png'));
    expect(illustration.parentElement?.tagName).toBe('DIV');
  });

  it('shows onboarding when progress is blank', () => {
    // Break caught: first-run lands on fake metrics instead of an honest empty state.
    render(<DailyPathDashboard progress={blankDemoProgress} />);

    expect(screen.getByRole('heading', { name: /Start with one useful phrase/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Start 8-minute session/i })).toHaveAttribute(
      'href',
      '/learn/english-to-french',
    );
  });
});

describe('DashboardDataBoundary', () => {
  it('shows a static practice-path skeleton while progress is loading', () => {
    // Break caught: an unresolved preview request leaves the page blank or unannounced.
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)));

    render(<DashboardDataBoundary />, { wrapper: QueryTestProvider });

    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Preparing your practice path…');
  });

  it('explains a failed preview request and retries it on request', async () => {
    // Break caught: failures are not announced or retry remains actionable without an announced busy state.
    const user = userEvent.setup();
    let resolveRetry: ((response: Response) => void) | undefined;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => {
          resolveRetry = resolve;
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    render(<DashboardDataBoundary />, { wrapper: QueryTestProvider });

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load your practice path.');
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Trying again…' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Trying to load your practice path again…');

    resolveRetry?.(new Response(JSON.stringify(demoProgress)));
    expect(await screen.findByRole('link', { name: /continue 8-minute session/i })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('DailyPathDashboard study-plan status', () => {
  const FRENCH_SLUG = 'english-to-french';

  function ensureMockLocalStorage() {
    const createMock = () => {
      const store = new Map<string, string>();
      return {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => {
          store.set(k, String(v));
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
        clear: () => {
          store.clear();
        },
        get length() {
          return store.size;
        },
        key: (index: number) => Array.from(store.keys())[index] ?? null,
      } as unknown as Storage;
    };
    let needsMock = true;
    try {
      const ls = (window as unknown as { localStorage?: Storage }).localStorage;
      needsMock = !ls || typeof ls.clear !== 'function';
    } catch {
      needsMock = true;
    }
    if (needsMock) {
      const mock = createMock();
      try {
        Object.defineProperty(window, 'localStorage', { value: mock, configurable: true, writable: true });
      } catch {}
      try {
        Object.defineProperty(globalThis, 'localStorage', { value: mock, configurable: true, writable: true });
      } catch {}
    }
  }

  ensureMockLocalStorage();

  function seedPlan(doneAll = false) {
    const concepts = initialCourses.find((course) => course.slug === FRENCH_SLUG)!.concepts;
    const plan = generatePlan(
      {
        courseSlug: FRENCH_SLUG,
        startCefr: 'A1',
        startConceptId: concepts[0]!.id,
        targetLevel: 'B1',
        daysPerWeek: 5,
        minutesPerDay: 8,
        startDate: '2026-09-07',
      },
      concepts,
    );
    localStorage.setItem(`verbalibera_plan:${FRENCH_SLUG}`, JSON.stringify(plan));
    if (doneAll) {
      const done: Record<string, boolean> = {};
      plan.weeks.forEach((week, weekIndex) => {
        week.items.forEach((item, itemIndex) => {
          done[planItemKey(weekIndex, itemIndex, item.conceptId, item.mode, item.drillId)] = true;
        });
      });
      localStorage.setItem(`verbalibera_plan_done:${FRENCH_SLUG}`, JSON.stringify(done));
    }
    return plan;
  }

  it('shows week position and today’s items when a browser-local plan exists', async () => {
    localStorage.clear();
    const plan = seedPlan();

    render(<DailyPathDashboard progress={demoProgress} />);

    expect(await screen.findByText(`Week 1 of ${plan.weeks.length} · B1 track`)).toBeInTheDocument();
    expect(screen.getByText('8 plan items today')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /review your study plan/i })).toHaveAttribute(
      'href',
      `/learn/${FRENCH_SLUG}/plan`,
    );
  });

  it('uses account plan status instead of another browser-local plan', async () => {
    localStorage.clear();
    const guest = seedPlan();
    const account = { ...guest, targetLevel: 'A2' as const };
    render(<DailyPathDashboard progress={{ ...demoProgress, isPreview: false, session: [{ id: 'plan-teach-fr-greet-politely', kind: 'NEW_PATTERN', courseSlug: FRENCH_SLUG, contentId: 'fr-greet-politely' }, { id: 'plan-drill-fr-greet-politely-drill', kind: 'DRILL', courseSlug: FRENCH_SLUG, contentId: 'fr-greet-politely', drillId: 'fr-greet-politely-drill' }], studyPlans: { [FRENCH_SLUG]: { plan: account, done: {} } } }} />);
    expect(await screen.findByText(/· A2 track/)).toBeInTheDocument();
    expect(screen.queryByText(/· B1 track/)).not.toBeInTheDocument();
    expect(screen.getByText('2 plan items today')).toBeInTheDocument();
  });

  it('does not show guest plans on an account with no saved plan', async () => {
    localStorage.clear();
    seedPlan();
    render(<DailyPathDashboard progress={{ ...demoProgress, isPreview: false }} />);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
    expect(screen.queryByRole('link', { name: /review your study plan/i })).not.toBeInTheDocument();
  });

  it('stays on demo content when no plan is stored', () => {
    localStorage.clear();

    render(<DailyPathDashboard progress={demoProgress} />);

    expect(screen.queryByText(/· \w+ track/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /review your study plan/i })).not.toBeInTheDocument();
    expect(screen.getByText(/keep your useful phrases moving/i)).toBeInTheDocument();
  });

  it('announces completion when every plan item is checked off', async () => {
    localStorage.clear();
    seedPlan(true);

    render(<DailyPathDashboard progress={demoProgress} />);

    expect(await screen.findByText(/plan complete — every item is checked off/i)).toBeInTheDocument();
  });

  it('ignores corrupt stored plans instead of breaking the dashboard', () => {
    localStorage.clear();
    localStorage.setItem(`verbalibera_plan:${FRENCH_SLUG}`, 'not-json{{{');

    render(<DailyPathDashboard progress={demoProgress} />);

    expect(screen.queryByRole('link', { name: /review your study plan/i })).not.toBeInTheDocument();
    expect(screen.getByText(/keep your useful phrases moving/i)).toBeInTheDocument();
  });
});
