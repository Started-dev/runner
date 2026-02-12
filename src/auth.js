export function requireBearer(secret) {
  return function auth(req, res, next) {
    // Allow health without auth
    if (req.path === "/health" || req.path === "/fingerprint") return next();

    const header = req.headers["authorization"] || "";
    if (!secret) return res.status(500).json({ error: "RUNNER_SHARED_SECRET not set" });

    if (header !== `Bearer ${secret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  };
}
