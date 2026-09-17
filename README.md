# Started runner

Isolated execution for Starts. This service is **not** an inference API.

It receives a workspace, runs the allowed command with network off, and returns logs. The CLI / engine still own the receipt. `wallet.sign` is never allowed.

```
POST /v1/sessions     Bearer
GET  /v1/sessions/:id Bearer
GET  /health
GET  /fingerprint
```

## Policy

- Network off unless the kit explicitly allows `net.unrestricted` (official kits do not)
- `wallet.sign` denied
- `confirmRun` kits require `{ "confirm": true }`
- Concurrency cap, timeout, closed filesystem under the workspace

## Local

```bash
docker build -t started-runner .
docker run --rm -p 8787:8787 \
  -e RUNNER_SHARED_SECRET=dev \
  -v /var/run/docker.sock:/var/run/docker.sock \
  started-runner
```

Without Docker the runner executes in-process (file checks only). That is for development. Production uses the image.

See [`Started-dev/started`](https://github.com/Started-dev/started) for the engine and CLI.
