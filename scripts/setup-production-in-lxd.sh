#!/usr/bin/env bash
set -Eeuo pipefail
PS4='+ [lxd-host] '
set -x

readonly CONTAINER_NAME="${LXD_CONTAINER_NAME:-mytodo-lxd-test-$$}"
readonly LXD_IMAGE="${LXD_IMAGE:-ubuntu:24.04}"
readonly WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/mytodo-lxd-test.XXXXXX")"
readonly REMOVE_CONTAINER="${LXD_REMOVE_CONTAINER:-false}"

CONTAINER_CREATED=false

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM

  if [[ "${CONTAINER_CREATED}" == true ]]; then
    if [[ "${REMOVE_CONTAINER}" == true ]]; then
      printf 'Removing LXD container %s...\n' "${CONTAINER_NAME}"
      if ! lxc delete --force "${CONTAINER_NAME}"; then
        printf 'Failed to remove LXD container %s. Remove it manually.\n' "${CONTAINER_NAME}" >&2
        exit_code=1
      fi
    else
      printf 'Leaving LXD container %s running. Set LXD_REMOVE_CONTAINER=true to remove it at exit.\n' "${CONTAINER_NAME}"
    fi
  fi

  rm -rf -- "${WORK_DIR}"
  exit "${exit_code}"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

for command_name in lxc; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    printf 'Required command not found: %s\n' "${command_name}" >&2
    exit 1
  fi
done

if ! lxc info >/dev/null 2>&1; then
  printf 'LXD is unavailable. Initialize and start LXD, then retry.\n' >&2
  exit 1
fi

if lxc info "${CONTAINER_NAME}" >/dev/null 2>&1; then
  printf 'LXD container already exists: %s\n' "${CONTAINER_NAME}" >&2
  exit 1
fi

printf 'Creating LXD container %s from %s...\n' "${CONTAINER_NAME}" "${LXD_IMAGE}"
lxc launch "${LXD_IMAGE}" "${CONTAINER_NAME}" \
  --config security.nesting=true \
  --config security.syscalls.intercept.mknod=true \
  --config security.syscalls.intercept.setxattr=true
CONTAINER_CREATED=true

cat >"${WORK_DIR}/guest-test.sh" <<'GUEST_SCRIPT'
#!/usr/bin/env bash
set -Eeuo pipefail
PS4='+ [lxd-guest] '
set -x

export DEBIAN_FRONTEND=noninteractive

printf 'Installing Git, Docker, Compose, Task completion support, and test utilities...\n'
apt-get update
apt-get install -y --no-install-recommends bash-completion ca-certificates curl docker.io docker-compose-v2 git iproute2 jq openssl tar
systemctl enable --now docker
docker info >/dev/null
docker compose version

case "$(dpkg --print-architecture)" in
  amd64) task_arch=amd64 ;;
  arm64) task_arch=arm64 ;;
  *)
    printf 'Unsupported container architecture: %s\n' "$(dpkg --print-architecture)" >&2
    exit 1
    ;;
esac

task_version=3.54.0
curl --fail --location --silent --show-error \
  "https://github.com/go-task/task/releases/download/v${task_version}/task_linux_${task_arch}.tar.gz" \
  --output /tmp/task.tar.gz
tar -xzf /tmp/task.tar.gz -C /usr/local/bin task
rm -f /tmp/task.tar.gz
task --version
install -d /etc/bash_completion.d
task --completion bash >/etc/bash_completion.d/task
chmod 644 /etc/bash_completion.d/task

git clone --depth 1 https://github.com/sigmaray/mytodo.git /opt/mytodo
install -d /var/lib/mytodo-lxd-test/postgres /var/lib/mytodo-lxd-test/attachments

browser_mode=${LXD_BROWSER_MODE:-true}
if [[ "${browser_mode}" == true ]]; then
  container_ip=$(ip -4 -o addr show dev eth0 | awk '{split($4, address, "/"); print address[1]; exit}')
  if [[ -z "${container_ip}" ]]; then
    printf 'Could not determine the LXD container IP address.\n' >&2
    exit 1
  fi
  app_url="http://${container_ip}:18080"
  app_domain="http://${container_ip}"
  cookie_secure=false
  curl_resolve=(--resolve "${container_ip}:18080:127.0.0.1")
else
  app_url=https://localhost:18443
  app_domain=localhost
  cookie_secure=true
  curl_resolve=(--resolve localhost:18443:127.0.0.1)
fi

cd /opt/mytodo
cat >.env <<EOF
MYTODO_DB_USER=todoist
MYTODO_DB_PASSWORD=$(openssl rand -hex 24)
MYTODO_DB_NAME=todoist_lxd_test
MYTODO_DOMAIN=${app_domain}
MYTODO_COOKIE_SECURE=${cookie_secure}
MYTODO_HTTP_PORT=18080
MYTODO_HTTPS_PORT=18443
MYTODO_POSTGRES_VOLUME=/var/lib/mytodo-lxd-test/postgres
MYTODO_ATTACHMENTS_ENABLED=false
MYTODO_ATTACHMENTS_DIR=/var/lib/mytodo/attachments
MYTODO_ATTACHMENTS_VOLUME=/var/lib/mytodo-lxd-test/attachments
MYTODO_PROJECT_ARCHIVING_ENABLED=false
COMPOSE_PROJECT_NAME=mytodo-lxd-test
EOF
chmod 600 .env

printf 'Building and starting the production stack through Task...\n'
task prod:docker:with-infra:up

compose=(docker compose --env-file .env -f docker-compose.with-infra.yml)
status_file=/tmp/mytodo-lxd-test-auth-status.json
page_file=/tmp/mytodo-lxd-test-page.html
ready=false

printf 'Waiting for PostgreSQL, API, frontend, and Caddy...\n'
for attempt in $(seq 1 60); do
  if "${compose[@]}" exec -T postgres pg_isready -U todoist -d todoist_lxd_test >/dev/null 2>&1 && \
    curl --fail --silent --show-error --insecure --max-time 10 \
      "${curl_resolve[@]}" \
      "${app_url}/auth/status" --output "${status_file}" 2>/dev/null && \
    jq -e '.accessMode == "password" and has("authenticated")' "${status_file}" >/dev/null; then
    ready=true
    break
  fi
  sleep 2
done

if [[ "${ready}" != true ]]; then
  printf 'Production stack did not become healthy. Compose logs follow.\n' >&2
  "${compose[@]}" logs >&2 || true
  exit 1
fi

curl --fail --silent --show-error --insecure --max-time 10 \
  "${curl_resolve[@]}" \
  "${app_url}/" --output "${page_file}"
if ! grep -q '<div id="root"></div>' "${page_file}"; then
  printf 'Frontend HTML did not contain the application root.\n' >&2
  exit 1
fi

running_services=$("${compose[@]}" ps --services --status running | sort)
for service in postgres todoist-api todoist-web caddy; do
  if ! grep -Fxq "${service}" <<<"${running_services}"; then
    printf 'Expected Compose service is not running: %s\n' "${service}" >&2
    "${compose[@]}" ps >&2 || true
    exit 1
  fi
done

printf 'Production stack checks passed: PostgreSQL ready, API status valid, frontend served through Caddy, all four services running.\n'
if [[ "${browser_mode}" == true ]]; then
  printf '\nOpen the project in a browser: %s/\n' "${app_url}"
  printf 'The project is served from LXD container %s.\n' "${LXD_CONTAINER_NAME:-mytodo-prod-browser}"
  printf 'Stop and remove it later with: task prod:lxd:down LXD_CONTAINER_NAME=%s\n' "${LXD_CONTAINER_NAME:-mytodo-prod-browser}"
else
  printf 'Stopping the stack through Task...\n'
  task prod:docker:with-infra:down
fi
GUEST_SCRIPT

lxc file push "${WORK_DIR}/guest-test.sh" "${CONTAINER_NAME}/root/mytodo-guest-test.sh"
lxc exec "${CONTAINER_NAME}" -- test -s /root/mytodo-guest-test.sh
lxc exec "${CONTAINER_NAME}" -- env \
  "LXD_BROWSER_MODE=${LXD_BROWSER_MODE:-true}" \
  "LXD_CONTAINER_NAME=${CONTAINER_NAME}" \
  bash /root/mytodo-guest-test.sh

printf 'LXD production test completed successfully.\n'
