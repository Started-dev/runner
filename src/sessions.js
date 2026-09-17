import { randomBytes } from "node:crypto";

export function createStore() {
  const sessions = new Map();
  return {
    create(init) {
      const id = `ses_${randomBytes(6).toString("hex")}`;
      const session = {
        id,
        status: "queued",
        createdAt: new Date().toISOString(),
        logs: [],
        ...init,
      };
      sessions.set(id, session);
      return session;
    },
    get(id) {
      return sessions.get(id);
    },
    append(session, line) {
      session.logs.push(line);
    },
    finish(session, { ok, exitCode, error }) {
      session.status = ok ? "ok" : "failed";
      session.exitCode = exitCode;
      session.error = error;
      session.finishedAt = new Date().toISOString();
    },
  };
}
