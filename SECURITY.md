# Security policy

Pi packages run with the user's full system permissions. Review extension and skill changes carefully, avoid exposing credentials, and treat fetched web content as untrusted.

The `poc` skill uses Docker containers to reduce accidental host modification; it does not claim that containers safely contain actively malicious code, especially with host bind mounts. Never mount the Docker socket, host credential directories, or Pi session state into an untrusted lab.

The `web_fetch` tool blocks local and non-public network destinations and validates redirects, but it is not a browser or a sandbox.

Report vulnerabilities privately through GitHub Security Advisories for `NhanChau2409/pi-workbench`. Do not include active credentials or sensitive host data.
