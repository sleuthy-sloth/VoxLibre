import { frenchPlacementItems, italianPlacementItems } from '@/features/placement/items';
import { scorePlacement } from '@/features/placement/score';

function answersFor(correctCount: number): Record<string, string> {
  const answers: Record<string, string> = {};
  frenchPlacementItems.forEach((item, index) => {
    if (index < correctCount) {
      answers[item.id] = item.kind === 'CHOICE' ? (item.answerKey ?? '') : item.acceptedResponses[0]!;
    } else {
      answers[item.id] = 'wrong answer';
    }
  });
  return answers;
}

describe('scorePlacement', () => {
  it('covers 15 items across A1, A2, B1', () => {
    expect(frenchPlacementItems).toHaveLength(15);
    expect(frenchPlacementItems.filter((item) => item.band === 'A1')).toHaveLength(5);
    expect(frenchPlacementItems.filter((item) => item.band === 'A2')).toHaveLength(5);
    expect(frenchPlacementItems.filter((item) => item.band === 'B1')).toHaveLength(5);
  });

  it.each([
    [0, 'A1'],
    [5, 'A1'],
    [6, 'A2'],
    [10, 'A2'],
    [11, 'B1'],
    [13, 'B1'],
    [14, 'B1+'],
    [15, 'B1+'],
  ])('scores %i correct as %s', (correct, band) => {
    expect(scorePlacement(frenchPlacementItems, answersFor(correct)).band).toBe(band);
  });

  it('points learners to the first missed foundation', () => {
    const a1 = scorePlacement(frenchPlacementItems, answersFor(3));
    expect(a1.startCefr).toBe('A1');
    expect(a1.startConceptId).toBe('fr-pay-politely');

    const b1 = scorePlacement(frenchPlacementItems, answersFor(12));
    expect(b1.startCefr).toBe('B1');
  });

  it('flags above-content learners honestly instead of inventing B2', () => {
    const top = scorePlacement(frenchPlacementItems, answersFor(15));
    expect(top.aboveContent).toBe(true);
    expect(scorePlacement(frenchPlacementItems, answersFor(13)).aboveContent).toBe(false);
  });

  it('accepts variant production answers via normalized matching', () => {
    const answers = answersFor(0);
    answers['fr-place-3'] = 'ou est la gare ?';
    const result = scorePlacement(frenchPlacementItems, answers);
    expect(result.score).toBe(1);
  });
});

it('recommends an available lesson for the first missed foundation', () => {
  const answers = answersFor(15);
  answers['fr-place-3'] = 'wrong';
  expect(scorePlacement(frenchPlacementItems, answers).startConceptId).toBe('fr-find-place');
});

function italianAnswersFor(correctCount: number): Record<string, string> {
  const answers: Record<string, string> = {};
  italianPlacementItems.forEach((item, index) => {
    if (index < correctCount) {
      answers[item.id] = item.kind === 'CHOICE' ? (item.answerKey ?? '') : item.acceptedResponses[0]!;
    } else {
      answers[item.id] = 'wrong answer';
    }
  });
  return answers;
}

describe('scorePlacement (Italian)', () => {
  it('covers 15 items across A1, A2, B1', () => {
    expect(italianPlacementItems).toHaveLength(15);
    expect(italianPlacementItems.filter((item) => item.band === 'A1')).toHaveLength(5);
    expect(italianPlacementItems.filter((item) => item.band === 'A2')).toHaveLength(5);
    expect(italianPlacementItems.filter((item) => item.band === 'B1')).toHaveLength(5);
  });

  it.each([
    [0, 'A1'],
    [5, 'A1'],
    [6, 'A2'],
    [10, 'A2'],
    [11, 'B1'],
    [13, 'B1'],
    [14, 'B1+'],
    [15, 'B1+'],
  ])('scores %i correct as %s', (correct, band) => {
    expect(scorePlacement(italianPlacementItems, italianAnswersFor(correct), 'english-to-italian').band).toBe(band);
  });

  it('points learners to the first missed foundation', () => {
    const a1 = scorePlacement(italianPlacementItems, italianAnswersFor(3), 'english-to-italian');
    expect(a1.startCefr).toBe('A1');
    expect(a1.startConceptId).toBe('it-pay-politely');

    const b1 = scorePlacement(italianPlacementItems, italianAnswersFor(12), 'english-to-italian');
    expect(b1.startCefr).toBe('B1');
  });

  it('flags above-content learners honestly instead of inventing B2', () => {
    const top = scorePlacement(italianPlacementItems, italianAnswersFor(15), 'english-to-italian');
    expect(top.aboveContent).toBe(true);
    expect(scorePlacement(italianPlacementItems, italianAnswersFor(13), 'english-to-italian').aboveContent).toBe(false);
  });

  it('accepts variant production answers via normalized matching', () => {
    const answers = italianAnswersFor(0);
    answers['it-place-3'] = "dov'e la stazione?";
    const result = scorePlacement(italianPlacementItems, answers, 'english-to-italian');
    expect(result.score).toBe(1);
  });

  it('serves the fixed Italian set for the Italian course', async () => {
    const { placementItemsFor } = await import('@/features/placement/items');
    expect(placementItemsFor('english-to-italian')).toBe(italianPlacementItems);
  });
});
