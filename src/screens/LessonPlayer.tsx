// STUB (Group 1, group-1 Task 6).
export function LessonPlayer({ lessonId }: { lessonId: string }) {
  return (
    <div className="page">
      <h1>Lesson {lessonId}</h1>
      <a href={`#/complete/${lessonId}`}>Finish (stub)</a>
    </div>
  );
}
