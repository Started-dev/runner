import Docker from "dockerode";

export function createDocker() {
  return new Docker({ socketPath: "/var/run/docker.sock" });
}

export async function dockerVersion(docker) {
  try {
    return await docker.version();
  } catch (e) {
    return { error: String(e) };
  }
}

export async function runInContainer({
  docker,
  image,
  command,
  timeoutMs,
  onLog
}) {
  // Pull image if needed
  await pullIfMissing(docker, image);

  // We run "sh -lc <command>" to allow normal shell commands.
  const container = await docker.createContainer({
    Image: image,
    Cmd: ["sh", "-lc", command],
    Tty: false,
    AttachStdout: true,
    AttachStderr: true,
    HostConfig: {
      AutoRemove: true,
      NetworkMode: "bridge"
    }
  });

  const stream = await container.attach({ stream: true, stdout: true, stderr: true });

  stream.on("data", (chunk) => {
    const line = chunk.toString("utf8");
    onLog(line);
  });

  await container.start();

  const timeout = setTimeout(async () => {
    try { await container.kill(); } catch {}
  }, timeoutMs);

  const result = await container.wait();
  clearTimeout(timeout);

  const exitCode = typeof result?.StatusCode === "number" ? result.StatusCode : 1;
  return exitCode;
}

async function pullIfMissing(docker, image) {
  try {
    await docker.getImage(image).inspect();
    return;
  } catch {}

  await new Promise((resolve, reject) => {
    docker.pull(image, (err, stream) => {
      if (err) return reject(err);
      docker.modem.followProgress(stream, (e) => (e ? reject(e) : resolve()));
    });
  });
}
