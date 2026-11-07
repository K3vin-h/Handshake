// STUB (Group 2, group-2 Task 6).
export function Complete({ lessonId }: { lessonId: string }) {
  return (
    <div className="page">
      <h1>Lesson {lessonId} complete</h1>
      <p className="row">
        <a href={`#/lesson/${lessonId}`}>Practice again</a>
        <a href="#/">Back to your path</a>
      </p>
    </div>
  );
}
