// The API lives on the Vultr VM in production (VITE_API_BASE_URL, public, set in Vercel); locally Vite proxies /api.
const base = String(import.meta.env?.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");
export const apiUrl = (path: string) => base + path;
