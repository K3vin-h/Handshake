import express from "express";

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
  };
}
