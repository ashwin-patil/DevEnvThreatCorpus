FROM mcr.microsoft.com/devcontainers/python:1-3.12-bookworm@sha256:7876580dc67fd460fd962f004cbeb480027e9bbc0657096f1087db11f9eaff39

USER root
COPY scripts/.node-version /tmp/workbench-node-version
COPY requirements-governance.txt /tmp/requirements-governance.txt
RUN set -eu; \
    version="$(cat /tmp/workbench-node-version)"; \
    case "$(dpkg --print-architecture)" in \
      amd64) arch=x64 ;; \
      arm64) arch=arm64 ;; \
      *) echo "Unsupported Node architecture" >&2; exit 1 ;; \
    esac; \
    archive="node-v${version}-linux-${arch}.tar.xz"; \
    cd /tmp; \
    curl --fail --show-error --silent --location --proto '=https' --proto-redir '=https' \
      "https://nodejs.org/dist/v${version}/${archive}" --output "$archive"; \
    curl --fail --show-error --silent --location --proto '=https' --proto-redir '=https' \
      "https://nodejs.org/dist/v${version}/SHASUMS256.txt" --output SHASUMS256.txt; \
    grep "  ${archive}$" SHASUMS256.txt | sha256sum --check --strict -; \
    tar -xJf "$archive" --directory /usr/local --strip-components=1; \
    test "$(node --version)" = "v${version}"; \
    python -c 'import sys; assert sys.version_info[:2] == (3, 12)'; \
    python -m pip install --no-cache-dir --requirement /tmp/requirements-governance.txt; \
    python -m pip check; \
    rm "$archive" SHASUMS256.txt /tmp/workbench-node-version /tmp/requirements-governance.txt
