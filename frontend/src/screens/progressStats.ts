// Pure stats for the #/progress journal. No imports so `node --test` can run it directly.
export type Item = { streak: number; mastered: boolean; box: number; due: number; attempts: number; misses: number };
export type Mistakes = Record<string, Partial<Record<string, { count: number; lastAt: number }>>>;

const DAY = 86_400_000;
const KINDS = ["curl", "direction", "placement"] as const;

const share = (i: Item) => (i.attempts > 0 ? Math.max(0, i.attempts - i.misses) / i.attempts : 0);
const byLetter = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function letterBars(items: Record<string, Item>) {
  return Object.keys(items)
    .filter((l) => items[l].attempts > 0)
    .sort(byLetter)
    .map((letter) => {
      const i = items[letter];
      return { letter, attempts: i.attempts, matched: Math.max(0, i.attempts - i.misses), share: share(i) };
    });
}

export function strongAndWeak(items: Record<string, Item>) {
  const letters = Object.keys(items).sort(byLetter);
  const rank = (l: string) => share(items[l]);
  const strong = letters
    .filter((l) => items[l].attempts > 0 && (items[l].mastered || (items[l].attempts >= 3 && rank(l) >= 0.8)))
    .sort((a, b) => rank(b) - rank(a) || byLetter(a, b))
    .slice(0, 3);
  const weak = letters
    .filter((l) => !items[l].mastered && items[l].attempts >= 2 && rank(l) < 0.6)
    .sort((a, b) => rank(a) - rank(b) || byLetter(a, b))
    .slice(0, 3);
  return { strong, weak };
}

export function masteryCounts(items: Record<string, Item>) {
  let mastered = 0;
  let practicing = 0;
  for (const i of Object.values(items)) {
    if (i.mastered) mastered++;
    else if (i.attempts > 0) practicing++;
  }
  return { mastered, practicing };
}

export function almostThere(items: Record<string, Item>): { letter: string; need: number } | null {
  let best: { letter: string; streak: number } | null = null;
  for (const letter of Object.keys(items).sort(byLetter)) {
    const i = items[letter];
    if (i.mastered || i.streak >= 3 || i.streak <= 0) continue;
    if (!best || i.streak > best.streak) best = { letter, streak: i.streak };
  }
  return best ? { letter: best.letter, need: 3 - best.streak } : null;
}

function parse(code: string): { finger: string; kind: string } | null {
  const [finger, kind, ...rest] = code.split(":");
  if (!finger || rest.length || !(KINDS as readonly string[]).includes(kind)) return null;
  return { finger, kind };
}

function entries(m: Mistakes) {
  const out: { letter: string; code: string; finger: string; kind: string; count: number }[] = [];
  for (const letter of Object.keys(m)) {
    for (const [code, v] of Object.entries(m[letter] ?? {})) {
      const p = parse(code);
      if (p && v && v.count > 0) out.push({ letter, code, ...p, count: v.count });
    }
  }
  return out;
}

export function fingerBars(m: Mistakes, fingers: string[]) {
  const counts: Record<string, number> = {};
  for (const e of entries(m)) counts[e.finger] = (counts[e.finger] ?? 0) + e.count;
  return fingers.map((finger) => ({ finger, count: counts[finger] ?? 0 }));
}

export function kindCounts(m: Mistakes) {
  const out = { curl: 0, direction: 0, placement: 0 };
  for (const e of entries(m)) out[e.kind as keyof typeof out] += e.count;
  return out;
}

export function topMistake(m: Mistakes) {
  const byCode: Record<string, { finger: string; kind: string; count: number; letters: string[] }> = {};
  for (const e of entries(m)) {
    const c = (byCode[e.code] ??= { finger: e.finger, kind: e.kind, count: 0, letters: [] });
    c.count += e.count;
    c.letters.push(e.letter);
  }
  const codes = Object.keys(byCode).sort((a, b) => byCode[b].count - byCode[a].count || byLetter(a, b));
  if (!codes.length) return null;
  const t = byCode[codes[0]];
  return { ...t, letters: [...new Set(t.letters)].sort(byLetter) };
}

export function boxCounts(items: Record<string, Item>) {
  const out = [0, 0, 0, 0, 0];
  for (const i of Object.values(items)) if (i.box >= 0 && i.box <= 4) out[Math.floor(i.box)]++;
  return out;
}

export function reviewPlan(items: Record<string, Item>, now: number) {
  const plan = { today: [] as string[], tomorrow: [] as string[], threeDays: [] as string[], week: [] as string[], later: [] as string[] };
  for (const letter of Object.keys(items).sort(byLetter)) {
    const i = items[letter];
    if (i.attempts <= 0) continue;
    if (i.due <= now) { plan.today.push(letter); continue; }
    const days = Math.ceil((i.due - now) / DAY);
    if (days <= 1) plan.tomorrow.push(letter);
    else if (days <= 3) plan.threeDays.push(letter);
    else if (days <= 7) plan.week.push(letter);
    else plan.later.push(letter);
  }
  return plan;
}
