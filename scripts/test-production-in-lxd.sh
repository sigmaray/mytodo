#!/usr/bin/env bash
set -Eeuo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly CONTAINER_NAME="${LXD_CONTAINER_NAME:-mytodo-lxd-test-$$}"
readonly LXD_IMAGE="${LXD_IMAGE:-ubuntu:24.04}"
readonly WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/mytodo-lxd-test.XXXXXX")"

CONTAINER_CREATED=false

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM

  if [[ "${CONTAINER_CREATED}" == true ]]; then
    printf 'Removing LXD container %s...\n' "${CONTAINER_NAME}"
    if ! lxc delete --force "${CONTAINER_NAME}"; then
      printf 'Failed to remove LXD container %s. Remove it manually.\n' "${CONTAINER_NAME}" >&2
      exit_code=1
    fi
  fi

  rm -rf -- "${WORK_DIR}"
  exit "${exit_code}"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

for command_name in lxc tar git; do
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

export DEBIAN_FRONTEND=noninteractive

printf 'Installing Docker, Compose, and test utilities...\n'
apt-get update
apt-get install -y --no-install-recommends ca-certificates curl docker.io docker-compose-v2 jq openssl tar
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

install -d /opt/mytodo /var/lib/mytodo-lxd-test/postgres /var/lib/mytodo-lxd-test/attachments
tar -xzf /tmp/mytodo-project.tar.gz -C /opt/mytodo
rm -f /tmp/mytodo-project.tar.gz

cd /opt/mytodo
cat >.env <<EOF
MYTODO_DB_USER=todoist
MYTODO_DB_PASSWORD=$(openssl rand -hex 24)
MYTODO_DB_NAME=todoist_lxd_test
MYTODO_DOMAIN=localhost
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
      --resolve localhost:18443:127.0.0.1 \
      https://localhost:18443/auth/status --output "${status_file}" 2>/dev/null && \
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
  --resolve localhost:18443:127.0.0.1 \
  https://localhost:18443/ --output "${page_file}"
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
printf 'Stopping the stack through Task...\n'
task prod:docker:with-infra:down
GUEST_SCRIPT

# Archive the working tree so local edits are included, while excluding local
# credentials, generated dependencies, build output, and host-only tooling.
git -C "${REPO_ROOT}" ls-files -z --cached --others --exclude-standard >"${WORK_DIR}/all-paths"
: >"${WORK_DIR}/safe-paths"
while IFS= read -r -d '' path; do
  case "${path}" in
    .env.example|*/.env.example)
      ;;
    .env|.env.*|*/.env|*/.env.*|.todoist-admin-password|*/.todoist-admin-password)
      continue
      ;;
  esac

  case "${path}" in
    .git|.git/*|node_modules|node_modules/*|*/node_modules|*/node_modules/*|.pnpm-store|.pnpm-store/*|*/.pnpm-store|*/.pnpm-store/*|bin/*|v-postgres|v-postgres/*|v-attachments|v-attachments/*|dist|dist/*|*/dist|*/dist/*|test-results|test-results/*|playwright-report|playwright-report/*)
      continue
      ;;
  esac

  printf '%s\0' "${path}" >>"${WORK_DIR}/safe-paths"
done <"${WORK_DIR}/all-paths"

tar -czf "${WORK_DIR}/mytodo-project.tar.gz" -C "${REPO_ROOT}" --null -T "${WORK_DIR}/safe-paths"
lxc file push "${WORK_DIR}/mytodo-project.tar.gz" "${CONTAINER_NAME}/tmp/mytodo-project.tar.gz"
lxc file push "${WORK_DIR}/guest-test.sh" "${CONTAINER_NAME}/tmp/mytodo-guest-test.sh"
lxc exec "${CONTAINER_NAME}" -- bash /tmp/mytodo-guest-test.sh

printf 'LXD production test completed successfully.\n'
