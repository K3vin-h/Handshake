import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(o: { client_id: string; callback: (r: { credential: string }) => void }): void;
          renderButton(el: HTMLElement, o: { theme: string; size: string; text: string; width: number }): void;
        };
      };
    };
  }
}

const SRC = "https://accounts.google.com/gsi/client";
let loading: Promise<boolean> | null = null;
function loadGsi(): Promise<boolean> {
  if (window.google?.accounts) return Promise.resolve(true);
  return (loading ??= new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => { loading = null; resolve(false); };
    document.head.appendChild(s);
  }));
}

/** Google's own button (no One Tap). If the script cannot load, renders nothing and the email form carries on. */
export function GoogleButton({ clientId, onCredential }: { clientId: string; onCredential(credential: string): void }) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onCredential);
  cb.current = onCredential;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    void loadGsi().then((ok) => {
      if (!live) return;
      if (!ok || !window.google?.accounts || !ref.current) return setFailed(true);
      window.google.accounts.id.initialize({ client_id: clientId, callback: (r) => cb.current(r.credential) });
      window.google.accounts.id.renderButton(ref.current, { theme: "outline", size: "large", text: "continue_with", width: Math.max(200, Math.min(320, ref.current.clientWidth)) });
    });
    return () => { live = false; };
  }, [clientId]);

  return failed ? null : <div ref={ref} className="google-btn" />;
}
