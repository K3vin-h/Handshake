import { useEffect, useRef, useState } from "react";
import { getAuthConfig, getUser, logOut, subscribe, type User } from "../lib/auth";

/** Header chip: email + small menu when signed in, "Log in" otherwise, nothing when the server has no accounts. */
export function AccountChip() {
  const [on, setOn] = useState(false);
  const [user, setUser] = useState<User | null>(getUser());
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    void getAuthConfig().then((r) => setOn(r.ok && r.accounts));
    return subscribe(setUser);
  }, []);

  if (!on) return null;
  if (!user) return <a className="account-chip" href="#/login">Log in</a>;
  return (
    <div className="account-chip" onKeyDown={(e) => { if (e.key === "Escape" && open) { setOpen(false); toggle.current?.focus(); } }}>
      <button ref={toggle} type="button" className="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="account-email">{user.email}</span>
      </button>
      {open && (
        <div className="account-menu" role="group" aria-label="Account">
          <a href="#/settings" onClick={() => setOpen(false)}>Settings</a>
          <button type="button" className="secondary" onClick={() => { setOpen(false); void logOut(); }}>Log out</button>
        </div>
      )}
    </div>
  );
}
