import express from "express";
import os from "os";
import { requireBearer } from "./auth.js";
import { createRunStore } from "./runs.js";
import { sseHeaders } from "./sse.js";
import { createDocker, dockerVersion, runInContainer } from "./docker.js";

const app = express();
app.use(express.json({ limit: "2mb" }));

const PORT = Number(process.env.PORT || 8080);
const NODE_ID = process.env.RUNNER_NODE_ID || os.hostname();
const SECRET = process.env.RUNNER_SHARED_SECRET || "";
const RUN_IMAGE = process.env.RUN_IMAGE || "node:20-alpine";
const MAX = Number(process.env.RUN_MAX_CONCURRENCY || 5);
const TIMEOUT_MS = Number(process.env.RUN_TIMEOUT_MS || 600000);

const docker = createDocker();
const store = createRunStore();

let active = 0;

app.use(requireBearer(SECRET));

app.get("/health", (_req, res) => {
  res.json({ ok: true, nodeId: NODE_ID, ts: Date.now() });
});

app.get("/fingerprint", async (_req, res) => {
  const info = await dockerVersion(docker);
  res.json({
    ok: true,
    nodeId: NODE_ID,
    version: "0.1.0",
    runImage: RUN_IMAGE,
    maxConcurrency: MAX,
    docker: info
  });
});

app.post("/runs", async (req, res) => {
  if (active >= MAX) return res.status(429).json({ error: "Concurrency limit reached" });

  const { command, image, timeoutMs } = req.body || {};
  if (!command || typeof command !== "string") {
    return res.status(400).json({ error: "command is required" });
  }

  const run = store.newRun();
  run.command = command;
  run.status = "running";
  run.startedAt = new Date().toISOString();
  active += 1;

  res.json({ runId: run.runId });

  try {
    const exitCode = await runInContainer({
      docker,
      image: image || RUN_IMAGE,
      command,
      timeoutMs: typeof timeoutMs === "number" ? timeoutMs : TIMEOUT_MS,
      onLog: (line) => store.appendLog(run, line)
    });
    store.finish(run, exitCode);
  } catch (e) {
    store.appendLog(run, `\n[runner error] ${String(e)}\n`);
    store.finish(run, 1);
  } finally {
    active -= 1;
  }
});

app.get("/runs/:id", (req, res) => {
  const run = store.get(req.params.id);
  if (!run) return res.status(404).json({ error: "not found" });
  res.json({
    runId: run.runId,
    status: run.status,
    createdAt: run.createdAt,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    exitCode: run.exitCode,
    command: run.command,
    logsTail: run.logs.slice(-200)
  });
});

app.get("/runs/:id/stream", (req, res) => {
  const run = store.get(req.params.id);
  if (!run) return res.status(404).end();

  sseHeaders(res);

  // send last logs first
  for (const line of run.logs.slice(-200)) {
    res.write(`event: log\n`);
    res.write(`data: ${JSON.stringify({ line })}\n\n`);
  }

  // if already finished, immediately close after sending status
  if (run.status === "finished") {
    res.write(`event: done\n`);
    res.write(`data: ${JSON.stringify({ exitCode: run.exitCode })}\n\n`);
    return res.end();
  }

  const unsub = store.subscribe(run, res);
  req.on("close", () => {
    unsub();
    try { res.end(); } catch {}
  });
});

app.listen(PORT, () => {
  console.log(`[runner] listening on :${PORT} nodeId=${NODE_ID}`);
});
