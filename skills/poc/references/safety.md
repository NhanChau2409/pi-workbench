# Safety rules

A container is useful isolation against accidental host modification, not a perfect boundary for malicious code.

## Require explicit approval

- bind address other than `127.0.0.1`;
- read-write mount of an existing checkout;
- host home, root, SSH, cloud, Kubernetes, Docker, or Pi state paths;
- privileged mode, host networking, extra capabilities, or device mounts;
- deleting a worktree, branch, or persistent data;
- applying a container-tested installation directly to a host;
- publishing or deploying an artifact.

Never mount `/var/run/docker.sock` into a POC unless the user understands that it effectively grants host Docker control.

## Secrets

Prefer a narrowly scoped, ignored env file. Record only its path in metadata. Do not print values in commands, logs, summaries, or manifests. Never bake credentials into image layers.

## Cleanup

Require both labels:

```text
dev.poc.managed=true
dev.poc.name=NAME
```

Never use unrestricted `docker system prune`. Never delete shared upstream images. Never claim a pre-existing volume as POC-owned.

## Host application

Ubuntu installation commands are not automatically valid on macOS or another Linux distribution. Materialize a reviewed target-specific script, package, container image, or configuration-management role. Ask before executing it on the host.
