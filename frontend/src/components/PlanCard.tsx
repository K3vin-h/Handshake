import type { Plan } from "../lib/api";

type Props = { plan: Plan | null; hasCandidates: boolean; failed: boolean };

export function PlanCard({ plan, hasCandidates, failed }: Props) {
  if (!hasCandidates) return <section><h2>Today</h2><p>Nothing to plan yet. Start a lesson from Home.</p></section>;
  if (failed) return <section><h2>Today</h2><p role="status">Couldn't plan today's session. Continue with your next lesson from Home.</p></section>;
  if (!plan) return <section><h2>Today</h2><p role="status">Planning your session…</p></section>;
  return (
    <section aria-labelledby="plan-h">
      <h2 id="plan-h">Today</h2>
      <p>
        Lesson {plan.lessonId}
        {plan.focus.length > 0 && <> · focus {plan.focus.join(", ")}</>}
        {plan.words.length > 0 && <> · try {plan.words.join(", ")}</>}
      </p>
      <p>{plan.tip}</p>
      <a href={`#/lesson/${plan.lessonId}`}>Start</a>
      <p><small>planned by: {plan.source}</small></p>
    </section>
  );
}
