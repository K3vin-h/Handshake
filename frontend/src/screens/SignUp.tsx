import { AuthCard } from "../components/AuthCard";

export function SignUp() {
  return <div className="page"><AuthCard mode="signup" onDone={() => (location.hash = "#/")} /></div>;
}
