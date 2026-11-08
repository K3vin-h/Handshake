// Loads the repo-root .env (shared by every service; see .env.example). Import this first.
// On the VM systemd also supplies it through EnvironmentFile, and real environment variables win.
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });
