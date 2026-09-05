export function isPreviewMode(session: { userId?: string | null } | null | undefined): boolean {
  return !session?.userId;
}

function resolveIsPreview(arg: boolean | { isPreview: boolean }): boolean {
  if (typeof arg === 'boolean') return arg;
  return arg.isPreview;
}

export function dashboardBadgeCopy(isPreview: boolean): string;
export function dashboardBadgeCopy(args: { isPreview: boolean }): string;
export function dashboardBadgeCopy(arg: boolean | { isPreview: boolean }): string {
  const isPreview = resolveIsPreview(arg);
  return isPreview ? 'Preview progress' : 'Saved to your account';
}

export function progressNoticeCopy(isPreview: boolean): string;
export function progressNoticeCopy(args: { isPreview: boolean }): string;
export function progressNoticeCopy(arg: boolean | { isPreview: boolean }): string {
  const isPreview = resolveIsPreview(arg);
  return isPreview ? 'Nothing was saved. Preview progress only.' : 'Saved to your account.';
}

export function sessionCompletionCopy(isPreview: boolean): string;
export function sessionCompletionCopy(args: { isPreview: boolean }): string;
export function sessionCompletionCopy(arg: boolean | { isPreview: boolean }): string {
  // The answer-check verdict sentence "Checked locally. Nothing was saved." is always true for the check pipeline
  // But progress saved copy differs
  const isPreview = resolveIsPreview(arg);
  return isPreview ? 'Nothing was saved.' : 'Saved to your account.';
}

export function reviewQueueCopy(isPreview: boolean, dueCount: number): string;
export function reviewQueueCopy(args: { isPreview: boolean; dueCount: number }): string;
export function reviewQueueCopy(
  isPreviewOrArgs: boolean | { isPreview: boolean; dueCount: number },
  dueCount?: number,
): string {
  const isPreview =
    typeof isPreviewOrArgs === 'object' && isPreviewOrArgs !== null && 'isPreview' in isPreviewOrArgs
      ? isPreviewOrArgs.isPreview
      : (isPreviewOrArgs as boolean);
  const count =
    typeof isPreviewOrArgs === 'object' && isPreviewOrArgs !== null && 'dueCount' in isPreviewOrArgs
      ? isPreviewOrArgs.dueCount
      : (dueCount as number);
  if (isPreview) {
    return count === 0 ? "You're caught up — one pattern tomorrow keeps the flow." : `${count} reviews waiting (preview)`;
  }
  return count === 0 ? "You're caught up — one pattern tomorrow keeps the flow." : `${count} reviews waiting`;
}

export function planStatusCopy(args: { week: number; weekCount: number; targetLevel: string }): string {
  return `Week ${args.week} of ${args.weekCount} · ${args.targetLevel} track`;
}

export function planTodayCopy(args: { count: number }): string {
  if (args.count === 0) return 'Plan complete — every item is checked off.';
  return args.count === 1 ? '1 plan item today' : `${args.count} plan items today`;
}

export function dailyGoalCopy(isPreview: boolean, completed: number, target: number): string;
export function dailyGoalCopy(args: { isPreview: boolean; completed: number; target: number }): string;
export function dailyGoalCopy(
  isPreviewOrArgs: boolean | { isPreview: boolean; completed: number; target: number },
  completed?: number,
  target?: number,
): string {
  let isPreview: boolean;
  let comp: number;
  let targ: number;
  if (
    typeof isPreviewOrArgs === 'object' &&
    isPreviewOrArgs !== null &&
    'isPreview' in isPreviewOrArgs
  ) {
    isPreview = isPreviewOrArgs.isPreview;
    comp = isPreviewOrArgs.completed;
    targ = isPreviewOrArgs.target;
  } else {
    isPreview = isPreviewOrArgs as boolean;
    comp = completed as number;
    targ = target as number;
  }
  const label = `${comp} of ${targ} daily steps`;
  return isPreview ? `${label} — preview` : label;
}
