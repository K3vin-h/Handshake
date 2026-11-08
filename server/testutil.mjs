import express from "express";
import http from "node:http";

// Starts a bare Express app on a free port. `setup(app)` registers the routes under test.
export async function serve(setup) {
  const app = express();
  setup(app);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const read = async (res) => ({ status: res.status, body: res.status === 204 ? null : await res.json() });
  return {
    base,
    close: () =>
      new Promise((r) => {
        server.closeAllConnections?.();
        server.close(r);
      }),
    post: async (url, body) =>
      read(await fetch(base + url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })),
    get: async (url) => read(await fetch(base + url)),
    // node:http, not fetch, so tests can set Host and read every Set-Cookie (headers["set-cookie"] is an array).
    request: (method, url, { body, headers = {} } = {}) =>
      new Promise((resolve, reject) => {
        const data = body === undefined ? undefined : JSON.stringify(body);
        const req = http.request(base + url, {
          method,
          headers: { ...(data ? { "Content-Type": "application/json" } : {}), ...headers },
        }, (res) => {
          let text = "";
          res.setEncoding("utf8");
          res.on("data", (c) => (text += c));
          res.on("end", () => resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null, headers: res.headers }));
        });
        req.on("error", reject);
        req.end(data);
      }),
  };
}
