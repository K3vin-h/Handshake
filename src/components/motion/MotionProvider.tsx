import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { MotionConfig, useReducedMotion } from "motion/react";
import "./motion.css";

const KEY = "handshake.reduceMotion.v1";
type Ctx = { reduce: boolean; userChoice: boolean; setUserChoice(v: boolean): void };
const MotionCtx = createContext<Ctx>({ reduce: false, userChoice: false, setUserChoice() {} });

function loadChoice(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}

/**
 * Honours the OS "reduce motion" setting AND an in-app switch (WCAG 2.2.2: a way to stop movement).
 * The in-app choice sets data-reduce-motion on <html>, which motion.css uses to stop every CSS animation.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  const os = useReducedMotion() ?? false;
  const [userChoice, setChoice] = useState(loadChoice);
  useEffect(() => {
    document.documentElement.toggleAttribute("data-reduce-motion", userChoice);
  }, [userChoice]);
  const setUserChoice = useCallback((v: boolean) => {
    setChoice(v);
    try { localStorage.setItem(KEY, v ? "1" : "0"); } catch { /* storage blocked: choice lasts for this visit */ }
  }, []);
  return (
    <MotionCtx.Provider value={{ reduce: os || userChoice, userChoice, setUserChoice }}>
      <MotionConfig reducedMotion={userChoice ? "always" : "user"}>{children}</MotionConfig>
    </MotionCtx.Provider>
  );
}

/** True when the OS or the in-app switch asks for no motion. */
export function useReduceMotion(): boolean {
  return useContext(MotionCtx).reduce;
}

/** Nav switch. Text states the current setting, so it never relies on colour or an icon. */
export function ReduceMotionToggle() {
  const { userChoice, setUserChoice } = useContext(MotionCtx);
  return (
    <button type="button" className="reduce-motion-toggle" aria-pressed={userChoice} onClick={() => setUserChoice(!userChoice)}>
      Reduce motion: {userChoice ? "On" : "Off"}
    </button>
  );
}
