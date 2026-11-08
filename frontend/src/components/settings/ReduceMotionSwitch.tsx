import { useMotionChoice } from "../motion/MotionProvider";
import "./settings.css";

/**
 * Reduce-motion switch, bound to the same state as the old button (MotionProvider).
 * Device preference wins: when the OS asks for reduced motion the switch shows On and is locked.
 * The On/Off word sits beside the track so state is never colour-only.
 */
export function ReduceMotionSwitch({ labelledBy, describedBy }: { labelledBy: string; describedBy: string }) {
  const { os, userChoice, setUserChoice } = useMotionChoice();
  const on = os || userChoice;
  return (
    <button type="button" role="switch" className="set-switch" aria-checked={on} aria-labelledby={labelledBy} aria-describedby={describedBy} disabled={os} onClick={() => setUserChoice(!userChoice)}>
      <span className="set-switch-text">{on ? "On" : "Off"}</span>
      <span className="set-switch-track" aria-hidden="true">
        <span className="set-switch-thumb" />
      </span>
    </button>
  );
}

/** The sentence under the switch; copy unchanged from the old Settings control. */
export function reduceMotionHelp(os: boolean) {
  return os
    ? "Your device asks for reduced motion, so animation is off. Handshake follows that setting."
    : "By default Handshake follows your device setting, which currently allows animation. Turn this on to stop movement anyway.";
}
