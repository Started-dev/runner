# Started.dev Runner (MVP)

This runner executes `run_command` actions for Started.dev by running commands inside a Docker container on a remote node.

## Endpoints

### Public
- GET `/health`
- GET `/fingerprint`

### Auth (Bearer token)
- POST `/runs`  -> start a run
- GET `/runs/:id` -> run status + logs
- GET `/runs/:id/stream` -> SSE stream of logs

Auth header:
`Authorization: Bearer <RUNNER_SHARED_SECRET>`

## Environment variables

- `PORT` (default 8080)
- `RUNNER_NODE_ID` (default runner-1)
- `RUNNER_SHARED_SECRET` (required for run endpoints)
- `RUN_IMAGE` (default node:20-alpine)
- `RUN_MAX_CONCURRENCY` (default 5)
- `RUN_TIMEOUT_MS` (default 600000)
- `WORKSPACE_ROOT` (default /workspaces)

## Running locally (requires Docker)

```bash
docker build -t started-runner:latest .
docker run --rm -p 8080:8080 \
  -e RUNNER_SHARED_SECRET=devsecret \
  -v /var/run/docker.sock:/var/run/docker.sock \
  started-runner:latest

  Health:

curl http://localhost:8080/health


Start a run:

curl -X POST http://localhost:8080/runs \
  -H "Authorization: Bearer devsecret" \
  -H "Content-Type: application/json" \
  -d '{"command":"node -v"}'


---

## 5) `docker-compose.example.yml`
```yaml
version: "3.9"

services:
  runner:
    build: .
    ports:
      - "8080:8080"
    environment:
      RUNNER_NODE_ID: "do-runner-1"
      RUNNER_SHARED_SECRET: "CHANGE_ME"
      RUN_IMAGE: "node:20-alpine"
      RUN_MAX_CONCURRENCY: "5"
      RUN_TIMEOUT_MS: "600000"
      WORKSPACE_ROOT: "/workspaces"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - runner_workspaces:/workspaces

volumes:
  runner_workspaces:
