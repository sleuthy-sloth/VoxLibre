import { initialCourses } from '@/features/curriculum/fixture';
export type PlacementBand = 'A1' | 'A2' | 'B1';

export type PlacementItemKind = 'CHOICE' | 'CLOZE' | 'PRODUCTION';

export type PlacementItem = Readonly<{
  id: string;
  conceptId?: string;
  band: PlacementBand;
  kind: PlacementItemKind;
  prompt: string;
  choices?: readonly string[];
  answerKey?: string;
  acceptedResponses: readonly string[];
}>;

// French-first placement set: 15 fixed items, 5 per band. Every item is
// auto-checkable (choice key or normalized production match) so placement
// never needs a tutor or an LLM judge. Other languages follow this template.
export const frenchPlacementItems: readonly PlacementItem[] = [
  // A1 — formulaic travel survival
  {
    id: 'fr-place-1', band: 'A1', kind: 'CHOICE',
    prompt: 'Greet a shopkeeper politely.',
    choices: ['Bonjour, je voudrais une table, s’il vous plaît.', 'Où est la gare ?', 'Au secours !'],
    answerKey: 'Bonjour, je voudrais une table, s’il vous plaît.',
    acceptedResponses: [],
  },
  {
    id: 'fr-place-2', band: 'A1', kind: 'CHOICE',
    prompt: 'Order a coffee politely.',
    choices: ['Je voudrais un café, s’il vous plaît.', 'Je voudrais payer par carte.', 'Bonsoir, au revoir.'],
    answerKey: 'Je voudrais un café, s’il vous plaît.',
    acceptedResponses: [],
  },
  {
    id: 'fr-place-3', band: 'A1', kind: 'PRODUCTION',
    prompt: 'Ask where the station is. Type your answer.',
    acceptedResponses: ['Où est la gare ?'],
  },
  {
    id: 'fr-place-4', band: 'A1', kind: 'CHOICE',
    prompt: 'Ask for the bill politely.',
    choices: ['L’addition, s’il vous plaît.', 'Le train est annulé.', 'Je ne comprends pas.'],
    answerKey: 'L’addition, s’il vous plaît.',
    acceptedResponses: [],
  },
  {
    id: 'fr-place-5', band: 'A1', kind: 'CHOICE',
    prompt: 'Ask someone politely if they can help you.',
    choices: ['Pouvez-vous m’aider ?', 'Fermez la porte.', 'Combien ça coûte ?'],
    answerKey: 'Pouvez-vous m’aider ?',
    acceptedResponses: [],
  },
  // A2 — routine past, near future, pronouns, connectors
  {
    id: 'fr-place-6', band: 'A2', kind: 'CLOZE',
    prompt: 'Complete with the passé composé: Hier, nous ____ au marché.',
    acceptedResponses: ['Hier, nous sommes allés au marché.'],
  },
  {
    id: 'fr-place-7', band: 'A2', kind: 'CHOICE',
    prompt: 'Say you are going to visit the museum tomorrow (near future).',
    choices: ['Demain, je vais visiter le musée.', 'Demain, je visitais le musée.', 'Demain, je visiterai le musée.'],
    answerKey: 'Demain, je vais visiter le musée.',
    acceptedResponses: [],
  },
  {
    id: 'fr-place-8', band: 'A2', kind: 'CLOZE',
    prompt: 'Complete with “to them”: Je ____ ai parlé hier.',
    acceptedResponses: ['Je leur ai parlé hier.'],
  },
  {
    id: 'fr-place-9', band: 'A2', kind: 'CHOICE',
    prompt: 'Complete the sentence: Il pleut, ____ je reste à la maison.',
    choices: ['donc', 'parce que', 'pour'],
    answerKey: 'donc',
    acceptedResponses: [],
  },
  {
    id: 'fr-place-10', band: 'A2', kind: 'PRODUCTION',
    prompt: 'Say you ate at a restaurant yesterday. Type your answer.',
    acceptedResponses: ['Hier, j’ai mangé au restaurant.', 'J’ai mangé au restaurant hier.'],
  },
  // B1 — conditional politeness, aspect choice, pronoun placement, opinion, repair
  {
    id: 'fr-place-11', band: 'B1', kind: 'CHOICE',
    prompt: 'Which request is the most polite?',
    choices: ['Je voudrais un café, s’il vous plaît.', 'Je veux un café.', 'Donne-moi un café.'],
    answerKey: 'Je voudrais un café, s’il vous plaît.',
    acceptedResponses: [],
  },
  {
    id: 'fr-place-12', band: 'B1', kind: 'CLOZE',
    prompt: 'Complete with the habitual past: Quand j’étais petit, nous ____ chaque été.',
    acceptedResponses: ['Quand j’étais petit, nous partions chaque été.'],
  },
  {
    id: 'fr-place-13', band: 'B1', kind: 'CLOZE',
    prompt: 'Complete the reply: — Tu vas à la boulangerie ? — Oui, j’____ vais.',
    acceptedResponses: ['— Tu vas à la boulangerie ? — Oui, j’y vais.'],
  },
  {
    id: 'fr-place-14', band: 'B1', kind: 'CHOICE',
    prompt: 'Give an opinion with a reason.',
    choices: ['À mon avis, c’est trop cher parce que c’est petit.', 'Je ne sais pas.', 'Oui, merci.'],
    answerKey: 'À mon avis, c’est trop cher parce que c’est petit.',
    acceptedResponses: [],
  },
  {
    id: 'fr-place-15', band: 'B1', kind: 'CHOICE',
    prompt: 'Reply naturally: — Le train est annulé. — ____',
    choices: ['Zut ! Comment vais-je rentrer ?', 'Bonjour !', 'L’addition, s’il vous plaît.'],
    answerKey: 'Zut ! Comment vais-je rentrer ?',
    acceptedResponses: [],
  },
];


// Italian placement set: 15 fixed items, 5 per band, mirroring the French
// template. Every item is auto-checkable (choice key or normalized
// production match) so placement never needs a tutor or an LLM judge.
// A1 items map onto the travel-course foundations in score.ts.
export const italianPlacementItems: readonly PlacementItem[] = [
  // A1 — formulaic travel survival
  {
    id: 'it-place-1', band: 'A1', kind: 'CHOICE',
    prompt: 'Greet a shopkeeper politely.',
    choices: ['Buongiorno, vorrei un tavolo, per favore.', 'Dov’è la stazione?', 'Aiuto!'],
    answerKey: 'Buongiorno, vorrei un tavolo, per favore.',
    acceptedResponses: [],
  },
  {
    id: 'it-place-2', band: 'A1', kind: 'CHOICE',
    prompt: 'Order a coffee politely.',
    choices: ['Vorrei un caffè, per favore.', 'Vorrei pagare con la carta.', 'Buonasera, arrivederci.'],
    answerKey: 'Vorrei un caffè, per favore.',
    acceptedResponses: [],
  },
  {
    id: 'it-place-3', band: 'A1', kind: 'PRODUCTION',
    prompt: 'Ask where the station is. Type your answer.',
    acceptedResponses: ['Dov’è la stazione?'],
  },
  {
    id: 'it-place-4', band: 'A1', kind: 'CHOICE',
    prompt: 'Ask for the bill politely.',
    choices: ['Il conto, per favore.', 'Il treno è cancellato.', 'Non capisco.'],
    answerKey: 'Il conto, per favore.',
    acceptedResponses: [],
  },
  {
    id: 'it-place-5', band: 'A1', kind: 'CHOICE',
    prompt: 'Ask someone politely if they can help you.',
    choices: ['Può aiutarmi?', 'Chiuda la porta.', 'Quanto costa?'],
    answerKey: 'Può aiutarmi?',
    acceptedResponses: [],
  },
  // A2 — routine past, near future, pronouns, connectors
  {
    id: 'it-place-6', band: 'A2', kind: 'CLOZE',
    prompt: 'Complete with the passato prossimo: Ieri, noi ____ al mercato.',
    acceptedResponses: ['Ieri, noi siamo andati al mercato.'],
  },
  {
    id: 'it-place-7', band: 'A2', kind: 'CHOICE',
    prompt: 'Say you are going to visit the museum tomorrow (near future).',
    choices: ['Domani visito il museo.', 'Domani visitavo il museo.', 'Domani visiterò il museo.'],
    answerKey: 'Domani visito il museo.',
    acceptedResponses: [],
  },
  {
    id: 'it-place-8', band: 'A2', kind: 'CLOZE',
    prompt: 'Complete with “to them”: ____ ho parlato ieri.',
    acceptedResponses: ['Gli ho parlato ieri.'],
  },
  {
    id: 'it-place-9', band: 'A2', kind: 'CHOICE',
    prompt: 'Complete the sentence: Piove, ____ resto a casa.',
    choices: ['quindi', 'perché', 'per'],
    answerKey: 'quindi',
    acceptedResponses: [],
  },
  {
    id: 'it-place-10', band: 'A2', kind: 'PRODUCTION',
    prompt: 'Say you ate at a restaurant yesterday. Type your answer.',
    acceptedResponses: ['Ieri ho mangiato al ristorante.', 'Ho mangiato al ristorante ieri.'],
  },
  // B1 — conditional politeness, aspect choice, pronoun placement, opinion, repair
  {
    id: 'it-place-11', band: 'B1', kind: 'CHOICE',
    prompt: 'Which request is the most polite?',
    choices: ['Vorrei un caffè, per favore.', 'Voglio un caffè.', 'Dammi un caffè.'],
    answerKey: 'Vorrei un caffè, per favore.',
    acceptedResponses: [],
  },
  {
    id: 'it-place-12', band: 'B1', kind: 'CLOZE',
    prompt: 'Complete with the habitual past: Quando ero piccolo, ____ ogni estate.',
    acceptedResponses: ['Quando ero piccolo, partivamo ogni estate.'],
  },
  {
    id: 'it-place-13', band: 'B1', kind: 'CLOZE',
    prompt: 'Complete the reply: — Vai in panetteria? — Sì, ____ vado.',
    acceptedResponses: ['— Vai in panetteria? — Sì, ci vado.'],
  },
  {
    id: 'it-place-14', band: 'B1', kind: 'CHOICE',
    prompt: 'Give an opinion with a reason.',
    choices: ['Secondo me, è troppo caro perché è piccolo.', 'Non lo so.', 'Sì, grazie.'],
    answerKey: 'Secondo me, è troppo caro perché è piccolo.',
    acceptedResponses: [],
  },
  {
    id: 'it-place-15', band: 'B1', kind: 'CHOICE',
    prompt: 'Reply naturally: — Il treno è cancellato. — ____',
    choices: ['Accidenti! Come torno a casa?', 'Buongiorno!', 'Il conto, per favore.'],
    answerKey: 'Accidenti! Come torno a casa?',
    acceptedResponses: [],
  },
];

export function placementItemsFor(courseSlug: string): readonly PlacementItem[] {
  if (courseSlug === 'english-to-french') return frenchPlacementItems;
  if (courseSlug === 'english-to-italian') return italianPlacementItems;
  const course = initialCourses.find(course => course.slug === courseSlug);
  if (!course) return [];
  return course.concepts.map((concept, index) => {
    const answer = concept.modelDialogue.answer;
    const choices = [answer, course.concepts[(index + 2) % course.concepts.length].modelDialogue.answer, course.concepts[(index + 4) % course.concepts.length].modelDialogue.answer];
    const offset = index % choices.length;
    return {
      id: `${concept.id}-placement`, conceptId: concept.id, band: 'A1' as const,
      kind: index % 2 === 0 ? 'CHOICE' as const : 'PRODUCTION' as const,
      prompt: concept.modelDialogue.prompt,
      choices: [...choices.slice(offset), ...choices.slice(0, offset)],
      answerKey: answer, acceptedResponses: [answer],
    };
  });
}
