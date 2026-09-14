# Security policy

`pi-lab` uses Docker containers to reduce accidental host modification. It does not claim that containers safely contain actively malicious code, especially with host bind mounts.

Never mount the Docker socket, host credential directories, or Pi session state into an untrusted lab. Prefer a disposable VM or policy-controlled environment for hostile workloads.

Report vulnerabilities privately through GitHub Security Advisories for `NhanChau2409/pi-lab`. Do not include active credentials or sensitive host data.
