import assert from "node:assert/strict";
import { test } from "node:test";
import { gate } from "./policy.js";

const kit = {
  id: "local-agent-worker",
  confirmRun: true,
  tools: { allow: ["fs"], deny: ["wallet.sign", "net.unrestricted"] },
};

test("closed by default", () => {
  const d = gate({ kit: { ...kit, confirmRun: false } });
  assert.equal(d.ok, true);
  assert.equal(d.network, false);
});

test("confirmRun requires confirm", () => {
  const denied = gate({ kit, confirm: false });
  assert.equal(denied.ok, false);
  assert.equal(denied.status, 403);
  const ok = gate({ kit, confirm: true });
  assert.equal(ok.ok, true);
});

test("unsigned spend is rejected", () => {
  const d = gate({ kit: { ...kit, tools: { allow: ["fs"], deny: [] } } });
  assert.equal(d.ok, false);
});
