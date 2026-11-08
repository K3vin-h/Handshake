import { CountUp } from "./motion/CountUp";

/**
 * Streak and XP as one chip. The numbers are text, so nothing depends on icon or colour.
 *
 * Props
 * - streakDays: consecutive days practiced (from loadProgress().streakDays).
 * - xp: total XP (from loadProgress().xp).
 */
export function StreakXpChip(props: { streakDays: number; xp: number }) {
  const { streakDays, xp } = props;
  return (
    <p className="streak-chip">
      <span>
        <strong><CountUp value={streakDays} /></strong> {streakDays === 1 ? "day" : "days"} streak
      </span>
      <span aria-hidden="true"> · </span>
      <span>
        <strong><CountUp value={xp} /></strong> XP
      </span>
    </p>
  );
}
