import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, afterEach, beforeEach, vi } from 'vitest';
import { PlacementQuiz } from '@/components/placement/PlacementQuiz';
import { frenchPlacementItems } from '@/features/placement/items';
import { nextAdaptivePlacementItem } from '@/features/placement/adaptive';

function ensureMockLocalStorage() {
  try {
    if (typeof window.localStorage?.clear === 'function') return;
  } catch {}
  const store = new Map<string, string>();
  const mock = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    get length() { return store.size; },
    key: (index: number) => [...store.keys()][index] ?? null,
  } as unknown as Storage;
  Object.defineProperty(window, 'localStorage', { value: mock, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: mock, configurable: true });
}

ensureMockLocalStorage();
beforeEach(() => localStorage.clear());

async function answerFoundationIncorrectly() {
  const user = userEvent.setup();
  render(<PlacementQuiz courseSlug="english-to-french" />);
  await user.click(screen.getAllByRole('radio').at(-1)!);
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await user.click(screen.getAllByRole('radio').at(-1)!);
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await user.type(screen.getByLabelText(/your answer/i), 'wrong answer');
  await user.click(screen.getByRole('button', { name: 'See my result' }));
  return user;
}

async function answerAdaptiveCorrectly() {
  const user = userEvent.setup();
  render(<PlacementQuiz courseSlug="english-to-french" />);
  const answers: Record<string, string> = {};
  const completed: string[] = [];
  for (let step = 0; step < 9; step += 1) {
    const item = nextAdaptivePlacementItem(frenchPlacementItems, answers, completed)!;
    if (item.kind === 'CHOICE') await user.click(screen.getByRole('radio', { name: item.answerKey! }));
    else if (item.kind === 'CLOZE') {
      const assembled = item.acceptedResponses[0]!;
      const template = item.prompt.replace(/^Complete[^:]*: /, '');
      const [before, after] = template.split('____');
      await user.type(screen.getByLabelText(/blank 1/i), assembled.replace(before!, '').replace(after!, ''));
    } else await user.type(screen.getByLabelText(/your answer/i), item.acceptedResponses[0]!);
    answers[item.id] = item.kind === 'CHOICE' ? item.answerKey! : item.acceptedResponses[0]!;
    completed.push(item.id);
    await user.click(screen.getByRole('button', { name: step === 8 ? 'See my result' : 'Continue' }));
  }
  return user;
}

describe('PlacementQuiz', () => {
  it('ends early after unsuccessful foundation checks', async () => {
    await answerFoundationIncorrectly();
    expect(screen.getByText(/starting at the beginning/i)).toBeInTheDocument();
    expect(screen.getByText(/0 of 3/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /build my learning plan/i })).toHaveAttribute('href', '/learn/english-to-french/plan');
  });

  it('persists an adaptive result for the learning plan', async () => {
    await answerFoundationIncorrectly();
    expect(JSON.parse(localStorage.getItem('verbalibera_placement:english-to-french') ?? 'null')).toMatchObject({ score: 0, total: 3, band: 'A1' });
  });

  it('reports the top band after strong evidence at each checkpoint', async () => {
    await answerAdaptiveCorrectly();
    expect(screen.getByText(/above our current content/i)).toBeInTheDocument();
    expect(screen.getByText(/9 of 9/i)).toBeInTheDocument();
  });

  it('restores a saved result instead of restarting the quiz', async () => {
    localStorage.setItem('verbalibera_placement:english-to-french', JSON.stringify({ score: 3, total: 3, band: 'A1', startCefr: 'A1', startConceptId: 'fr-greet-politely', stretchUnlocked: false, aboveContent: false }));
    render(<PlacementQuiz courseSlug="english-to-french" />);
    expect(await screen.findByText(/starting at the beginning/i)).toBeInTheDocument();
    expect(screen.queryByText(/placement · question 1/i)).not.toBeInTheDocument();
  });
});

describe('PlacementQuiz account sync', () => {
  const stored = { score: 12, total: 15, band: 'B1', startCefr: 'B1', startConceptId: 'fr-greet-politely', stretchUnlocked: false, aboveContent: false };

  afterEach(() => { vi.unstubAllGlobals(); });

  it('loads the account result instead of the browser copy', async () => {
    localStorage.setItem('verbalibera_placement:english-to-french', JSON.stringify({ score: 0, total: 3, band: 'A1', startCefr: 'A1', startConceptId: 'fr-greet-politely', stretchUnlocked: false, aboveContent: false }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ userId: 'user-a', result: stored }))));
    render(<PlacementQuiz courseSlug="english-to-french" userId="user-a" />);
    expect(await screen.findByText(/independent learner/i)).toBeInTheDocument();
    expect(screen.getByText(/saved to your account/i)).toBeInTheDocument();
    expect(screen.queryByText(/placement · question 1/i)).not.toBeInTheDocument();
  });

  it('saves the finished result to the account', async () => {
    const posted: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'POST') posted.push({ url, init });
      return Promise.resolve(new Response(JSON.stringify(init?.method === 'POST' ? { saved: true } : { userId: 'user-a', result: null })));
    }));
    const user = userEvent.setup();
    render(<PlacementQuiz courseSlug="english-to-french" userId="user-a" />);
    await screen.findByText(/placement · question 1/i);
    await user.click(screen.getAllByRole('radio').at(-1)!);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getAllByRole('radio').at(-1)!);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(screen.getByLabelText(/your answer/i), 'wrong answer');
    await user.click(screen.getByRole('button', { name: 'See my result' }));
    expect(await screen.findByText(/starting at the beginning/i)).toBeInTheDocument();
    await waitFor(() => expect(posted).toHaveLength(1));
    const body = JSON.parse(posted[0]!.init!.body as string);
    expect(body.result).toMatchObject({ band: 'A1', startConceptId: expect.any(String) });
    expect(posted[0]!.url).toContain('/api/placement?courseSlug=english-to-french&userId=user-a');
  });

  it('explains an account load failure and retries on request', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('Network down')).mockResolvedValue(new Response(JSON.stringify({ userId: 'user-a', result: null })));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<PlacementQuiz courseSlug="english-to-french" userId="user-a" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Network down');
    await user.click(screen.getByRole('button', { name: /retry loading result/i }));
    expect(await screen.findByText(/placement · question 1/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
