import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PlanBuilder } from '@/components/plan/PlanBuilder';
import { PlanOverview, currentWeekIndex, planItemKey } from '@/components/plan/PlanOverview';
import { initialCourses } from '@/features/curriculum/fixture';
import { generatePlan } from '@/features/study-plan/generate';
import type { StudyPlan } from '@/features/study-plan/types';

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

beforeEach(() => {
  localStorage.clear();
});

function frenchPlan(): StudyPlan {
  const concepts = initialCourses.find((course) => course.slug === 'english-to-french')!.concepts;
  return generatePlan(
    {
      courseSlug: 'english-to-french',
      startCefr: 'A1',
      startConceptId: 'fr-greet-politely',
      daysPerWeek: 5,
      minutesPerDay: 8,
      targetLevel: 'B1',
      startDate: '2026-09-07',
    },
    concepts,
  );
}

function longerFrenchPlan(): StudyPlan {
  const concepts = initialCourses.find((course) => course.slug === 'english-to-french')!.concepts;
  return generatePlan(
    {
      courseSlug: 'english-to-french',
      startCefr: 'A1',
      startConceptId: 'fr-greet-politely',
      daysPerWeek: 2,
      minutesPerDay: 5,
      targetLevel: 'B1',
      startDate: '2026-09-07',
    },
    concepts,
  );
}

describe('PlanBuilder', () => {
  it('previews weeks live and saves the plan', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <PlanBuilder
        courseSlug="english-to-french"
        startCefr="A1"
        startConceptId="fr-greet-politely"
        onSave={onSave}
      />,
    );

    expect(screen.getByText(/plan items/i)).toBeInTheDocument();
    expect(screen.getByText(/still being authored/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/days per week/i), { target: { value: '3' } });
    await user.click(screen.getByRole('button', { name: /save my plan/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]![0].daysPerWeek).toBe(3);
  });
});

describe('PlanOverview', () => {
  it('shows the current week, checklist, and frontier note', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <PlanOverview plan={frenchPlan()} done={{}} onToggle={onToggle} onReset={() => {}} />,
    );

    expect(screen.getByText(/week 1 of/i)).toBeInTheDocument();
    expect(screen.getByText(/items done/i)).toBeInTheDocument();
    expect(screen.getByText(/still being authored/i)).toBeInTheDocument();

    const first = screen.getAllByRole('checkbox')[0]!;
    await user.click(first);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('keeps learners on the first incomplete week instead of advancing by date', () => {
    const plan = longerFrenchPlan();
    expect(plan.weeks.length).toBeGreaterThan(1);
    expect(currentWeekIndex(plan, {})).toBe(0);

    const firstWeekDone = Object.fromEntries(
      plan.weeks[0]!.items.map((item, itemIndex) => [
        planItemKey(0, itemIndex, item.conceptId, item.mode, item.drillId),
        true,
      ]),
    );
    expect(currentWeekIndex(plan, firstWeekDone)).toBe(1);
  });

  it('gives repeated review items independent completion identities', () => {
    const plan = frenchPlan();
    const firstWeek = plan.weeks[0]!;
    const reviewIndexes = firstWeek.items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.mode === 'review');

    expect(reviewIndexes.length).toBeGreaterThan(1);
    const keys = firstWeek.items.map((item, itemIndex) =>
      planItemKey(0, itemIndex, item.conceptId, item.mode, item.drillId),
    );
    expect(new Set(keys).size).toBe(keys.length);

    render(<PlanOverview plan={plan} done={{}} onToggle={() => {}} onReset={() => {}} />);
    const ids = screen.getAllByRole('checkbox').map((checkbox) => checkbox.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});


it('gives repeated scheduled reviews independent identities and readable labels', () => {
  render(<PlanOverview plan={frenchPlan()} todayIso="2026-09-07" done={{}} onToggle={() => {}} onReset={() => {}} />);
  const inputs = screen.getAllByRole('checkbox');
  expect(new Set(inputs.map(input => input.id)).size).toBe(inputs.length);
  expect(screen.queryByText(/fr-greet-politely/)).not.toBeInTheDocument();
});

import { PlanSection } from '@/components/plan/PlanSection';
import { waitFor } from '@testing-library/react';
import { afterEach } from 'vitest';
afterEach(() => vi.unstubAllGlobals());
describe('account plan editor', () => {
  it('loads the account plan without adopting a guest plan', async () => {
    localStorage.setItem('verbalibera_plan:english-to-french', JSON.stringify(frenchPlan()));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ userId: 'user-a', plan: null, done: {} })));
    render(<PlanSection courseSlug="english-to-french" userId="user-a" />);
    expect(await screen.findByRole('button', { name: /save my plan/i })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
  it('keeps the builder available when account saving fails', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ userId: 'user-a', plan: null, done: {} })).mockResolvedValueOnce(Response.json({ error: 'Your plan was not saved. Please retry.' }, { status: 503 }));
    vi.stubGlobal('fetch', fetcher);
    render(<PlanSection courseSlug="english-to-french" userId="user-a" />);
    await userEvent.click(await screen.findByRole('button', { name: /save my plan/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/not saved/i);
    expect(screen.getByRole('button', { name: /save my plan/i })).toBeInTheDocument();
    expect(localStorage.getItem('verbalibera_plan:english-to-french')).toBeNull();
  });
  it('loads saved account progress as automatic completion, and resets on the server', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ userId: 'user-a', plan: frenchPlan(), done: { '0:0:teach:fr-greet-politely:': true } })).mockResolvedValueOnce(Response.json({ saved: true }));
    vi.stubGlobal('fetch', fetcher);
    render(<PlanSection courseSlug="english-to-french" userId="user-a" />);
    const boxes = await screen.findAllByRole('checkbox');
    expect(boxes[0]).toBeChecked();
    expect(boxes[0]).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /start over/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /save my plan/i })).toBeInTheDocument());
    expect(fetcher).toHaveBeenLastCalledWith(expect.stringContaining('userId=user-a'), expect.objectContaining({ method: 'DELETE' }));
  });
});
