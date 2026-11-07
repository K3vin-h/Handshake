// Confetti + a short sound when something is completed.
// - Confetti is skipped entirely when the OS asks for reduced motion.
// - The sound is never the only cue: callers also show text (see <StatusMessage>).
// - No libraries, no network. Confetti pieces remove themselves.

const COLOURS = ["#1d4ed8", "#0f766e", "#b45309", "#7c3aed", "#be123c"];

function reducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.26);
    osc.onended = () => ctx.close();
  } catch {
    /* audio blocked: the visible text is the cue */
  }
}

export function celebrate() {
  beep();
  if (reducedMotion() || typeof document === "undefined") return;
  const layer = document.createElement("div");
  layer.className = "confetti-layer";
  layer.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 36; i++) {
    const bit = document.createElement("span");
    bit.className = "confetti-bit";
    bit.style.left = `${Math.random() * 100}%`;
    bit.style.background = COLOURS[i % COLOURS.length];
    bit.style.animationDelay = `${Math.random() * 0.3}s`;
    bit.style.setProperty("--drift", `${Math.round((Math.random() - 0.5) * 160)}px`);
    layer.appendChild(bit);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 2200);
}
