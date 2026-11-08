import type { Progress, ItemState } from "./progress.ts";
import type { Profile } from "./profile.ts";

export type AccountState = { profile: Profile | null; progress: Progress };

/** Spec "Saving and merging": `a` is local, `b` is the server (wins ties). Never smaller than either side for XP or completed. */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const aLater = (a.lastActiveDay ?? "") > (b.lastActiveDay ?? "") || ((a.lastActiveDay ?? "") === (b.lastActiveDay ?? "") && a.streakDays > b.streakDays);
  const streak = aLater ? a : b;
  const items: Record<string, ItemState> = { ...b.items };
  for (const [k, v] of Object.entries(a.items)) if (!items[k] || v.attempts > items[k].attempts) items[k] = v;
  const completed = [...new Set([...a.completed, ...b.completed])];
  const partial: Record<string, number> = {};
  for (const [k, v] of Object.entries({ ...b.partial, ...a.partial })) if (!completed.includes(k)) partial[k] = Math.max(a.partial?.[k] ?? 0, b.partial?.[k] ?? 0, v ?? 0);
  return {
    xp: Math.max(a.xp, b.xp),
    streakDays: streak.streakDays,
    lastActiveDay: streak.lastActiveDay,
    completed,
    items,
    ...(Object.keys(partial).length ? { partial } : {}),
  };
}

/** `server` null = the account has no saved state yet. */
export function mergeState(local: AccountState, server: AccountState | null): AccountState {
  if (!server) return local;
  return { profile: server.profile ?? local.profile, progress: mergeProgress(local.progress, server.progress) };
}
