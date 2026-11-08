import { AuthCard } from "../components/AuthCard";

// "Forgot password?" lives inside AuthCard (log-in mode), right under the password field.
export function Login() {
  return <div className="page"><AuthCard mode="login" onDone={() => (location.hash = "#/")} /></div>;
}
