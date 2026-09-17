export function gate({ kit, confirm }) {
  const deny = kit?.tools?.deny ?? [];
  if (!deny.includes("wallet.sign")) {
    return { ok: false, status: 400, error: "tools.deny must include wallet.sign" };
  }
  if (kit?.confirmRun && confirm !== true) {
    return { ok: false, status: 403, error: "confirm required" };
  }
  return { ok: true, network: false };
}
