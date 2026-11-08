import { AuthCard } from "../components/AuthCard";

export function Login() {
  return (
    <div className="page">
      <AuthCard mode="login" onDone={() => (location.hash = "#/")} />
      <p className="auth-skip"><a href="#/forgot">Forgot password?</a></p>
    </div>
  );
}
