import type { Stats } from "../lib/api";

const W = 320;
const H = 120;
const PAD = 16;

export function AccuracyChart({ daily }: { daily: Stats["daily"] }) {
  if (!daily.length) return <p>Practice a lesson to see how often you match the reference.</p>;
  const x = (i: number) => (daily.length === 1 ? W / 2 : PAD + (i * (W - 2 * PAD)) / (daily.length - 1));
  const y = (a: number) => H - PAD - a * (H - 2 * PAD);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-labelledby="acc-title">
        <title id="acc-title">Share of attempts that matched the reference, last 14 days</title>
        <text x="0" y={y(1) + 4} fontSize="10" fill="currentColor">100%</text>
        <text x="0" y={y(0) + 4} fontSize="10" fill="currentColor">0%</text>
        {daily.length > 1 && (
          <polyline points={daily.map((d, i) => `${x(i)},${y(d.accuracy)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="2" />
        )}
        {daily.map((d, i) => (
          <circle key={d.day} cx={x(i)} cy={y(d.accuracy)} r="3" fill="currentColor" />
        ))}
      </svg>
      <table>
        <caption>Share of attempts that matched the reference, by day</caption>
        <thead>
          <tr><th scope="col">Day</th><th scope="col">Attempts</th><th scope="col">Matched</th></tr>
        </thead>
        <tbody>
          {daily.map((d) => (
            <tr key={d.day}><td>{d.day}</td><td>{d.attempts}</td><td>{Math.round(d.accuracy * 100)}%</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
