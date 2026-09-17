import { createServer } from "node:http";
import os from "node:os";
import { gate } from "./policy.js";
import { createStore } from "./sessions.js";

const PORT = Number(process.env.PORT || 8787);
const NODE_ID = process.env.RUNNER_NODE_ID || os.hostname();
const SECRET = process.env.RUNNER_SHARED_SECRET || "";
const MAX = Number(process.env.RUN_MAX_CONCURRENCY || 5);

const store = createStore();
let active = 0;

const server = createServer(async (req, res) => {
  try {
    await handle(req, res);
  } catch (err) {
    json(res, 500, { error: String(err.message ?? err) });
  }
});

async function handle(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/health") {
    return json(res, 200, { ok: true, nodeId: NODE_ID, ts: Date.now() });
  }
  if (req.method === "GET" && url.pathname === "/fingerprint") {
    return json(res, 200, {
      ok: true,
      nodeId: NODE_ID,
      version: "0.2.0",
      isolation: process.env.DOCKER_HOST ? "docker" : "in-process",
    });
  }

  if (SECRET) {
    const auth = req.headers.authorization || "";
    if (auth !== `Bearer ${SECRET}`) return json(res, 401, { error: "unauthorized" });
  }

  if (req.method === "POST" && url.pathname === "/v1/sessions") {
    if (active >= MAX) return json(res, 429, { error: "concurrency limit" });
    const body = await readJson(req);
    const decision = gate(body);
    if (!decision.ok) return json(res, decision.status, { error: decision.error });
    const session = store.create({
      kit: body.kit?.id,
      command: body.command ?? "harness",
    });
    json(res, 202, { id: session.id, status: session.status });
    runSession(session, body, decision);
    return;
  }

  const match = url.pathname.match(/^\/v1\/sessions\/([^/]+)$/);
  if (req.method === "GET" && match) {
    const session = store.get(match[1]);
    if (!session) return json(res, 404, { error: "not found" });
    return json(res, 200, {
      id: session.id,
      status: session.status,
      kit: session.kit,
      command: session.command,
      createdAt: session.createdAt,
      finishedAt: session.finishedAt,
      exitCode: session.exitCode,
      error: session.error,
      logsTail: session.logs.slice(-200),
    });
  }

  json(res, 404, { error: "not found" });
}

async function runSession(session, body, decision) {
  active += 1;
  session.status = "running";
  session.startedAt = new Date().toISOString();
  store.append(session, `network=${decision.network ? "on" : "off"}`);
  try {
    const files = body.files ?? {};
    store.append(session, `workspace files=${Object.keys(files).length}`);
    store.append(session, `cmd ${session.command}`);
    store.finish(session, { ok: true, exitCode: 0 });
  } catch (err) {
    store.append(session, String(err));
    store.finish(session, { ok: false, exitCode: 1, error: String(err.message ?? err) });
  } finally {
    active -= 1;
  }
}

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(data) });
  res.end(data);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

if (process.argv[1] && process.argv[1].endsWith("server.js")) {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[runner] ${NODE_ID} :${PORT}`);
  });
}

export { server, store, gate };
