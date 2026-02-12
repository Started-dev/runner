import { v4 as uuidv4 } from "uuid";

export function createRunStore() {
  const runs = new Map(); // runId -> run

  function newRun() {
    const runId = uuidv4();
    const run = {
      runId,
      status: "queued",
      createdAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
      exitCode: null,
      command: null,
      logs: [],
      subscribers: new Set()
    };
    runs.set(runId, run);
    return run;
  }

  function get(runId) {
    return runs.get(runId);
  }

  function appendLog(run, line) {
    run.logs.push(line);
    if (run.logs.length > 5000) run.logs.shift();
    for (const res of run.subscribers) {
      try {
        res.write(`event: log\n`);
        res.write(`data: ${JSON.stringify({ line })}\n\n`);
      } catch {}
    }
  }

  function finish(run, exitCode) {
    run.status = "finished";
    run.exitCode = exitCode;
    run.finishedAt = new Date().toISOString();
    for (const res of run.subscribers) {
      try {
        res.write(`event: done\n`);
        res.write(`data: ${JSON.stringify({ exitCode })}\n\n`);
        res.end();
      } catch {}
    }
    run.subscribers.clear();
  }

  function subscribe(run, res) {
    run.subscribers.add(res);
    return () => run.subscribers.delete(res);
  }

  return { newRun, get, appendLog, finish, subscribe };
}
