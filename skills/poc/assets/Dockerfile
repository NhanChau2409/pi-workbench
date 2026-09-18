FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
      bash ca-certificates curl wget git jq ripgrep sudo \
      procps iproute2 less unzip \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --shell /bin/bash poc \
    && echo "poc ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/poc

USER poc
WORKDIR /workspace
CMD ["sleep", "infinity"]
