import type { InputHTMLAttributes, Ref } from "react";

/**
 * A labelled text field in a frosted shell with a soft animated rim (our own CSS, inspired by the look of
 * Cult UI's "Halo Field"; none of its code is used).
 *
 * Props
 * - id: required, links the label, hint and error to the input.
 * - label: visible label text.
 * - description: optional hint under the field (linked with aria-describedby).
 * - error: optional error text. Shown as "Error: ..." with an icon, sets aria-invalid, and gets its own
 *   border style, so it never depends on colour alone. Announce the error summary with <StatusMessage>.
 * - inputRef: ref to the <input>, e.g. to move focus to the first invalid field.
 * - ...rest: any normal <input> prop (value, onChange, maxLength, autoComplete...).
 *
 * The rim animates only when motion is allowed: it stops under prefers-reduced-motion and under the in-app
 * "Reduce motion" switch (data-reduce-motion). The field border itself is a solid 3:1 line, and focus adds
 * an outline, so the rim is decoration only.
 */
export function HaloField(props: InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; description?: string; error?: string; inputRef?: Ref<HTMLInputElement> }) {
  const { id, label, description, error, inputRef, ...input } = props;
  const describedBy = [description ? `${id}-desc` : "", error ? `${id}-err` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`halo-field${error ? " has-error" : ""}`}>
      <label htmlFor={id} className="halo-label">
        {label}
      </label>
      <div className="halo-rim">
        <div className="halo-shell">
          <input id={id} ref={inputRef} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...input} />
        </div>
      </div>
      {description && (
        <p id={`${id}-desc`} className="halo-desc">
          {description}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} className="halo-error">
          <span aria-hidden="true">✕ </span>
          <strong>Error:</strong> {error}
        </p>
      )}
    </div>
  );
}
