export type StatusKind = "match" | "notyet" | "info" | "error";

const LABEL: Record<StatusKind, string> = { match: "Matches the reference", notyet: "Not yet", info: "Note", error: "Error" };
const ICON: Record<StatusKind, string> = { match: "✓", notyet: "!", info: "i", error: "✕" };

/**
 * The one place detection results and errors are announced. Every message is visual AND text:
 * an icon, a text label ("Matches the reference", "Not yet", ...) and the message itself.
 *
 * Keep this component MOUNTED for the whole screen and change only `message`. A live region that is
 * added at the same moment as its text is often not announced.
 *
 * Props
 * - kind: "match" | "notyet" | "info" | "error".
 * - message: the text. Empty or undefined renders an empty (but still mounted) live region.
 * - urgent: use role="alert" (assertive) instead of role="status" (polite). Fix this value for the
 *   lifetime of the component; use it only for blocking errors such as "Camera blocked".
 * Never moves focus. Do not auto-hide it quickly.
 */
export function StatusMessage(props: { kind: StatusKind; message?: string; urgent?: boolean }) {
  const { kind, message, urgent } = props;
  return (
    <div
      className={`status status-${kind}${message ? "" : " is-empty"}`}
      role={urgent ? "alert" : "status"}
      aria-live={urgent ? "assertive" : "polite"}
      aria-atomic="true"
    >
      {message ? (
        <>
          <span className="status-icon" aria-hidden="true">{ICON[kind]}</span>
          <span>
            <strong>{LABEL[kind]}:</strong> {message}
          </span>
        </>
      ) : null}
    </div>
  );
}
