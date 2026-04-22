#!/usr/bin/env bash
set -euo pipefail

DB_SERVER="${DB_SERVER:-db}"
DB_NAME="${DB_NAME:-QLSV_TrungTamTinHoc}"
DB_ADMIN_USER="${DB_ADMIN_USER:-sa}"
MSSQL_SA_PASSWORD="${MSSQL_SA_PASSWORD:-}"
SCHEMA_FILE="${SCHEMA_FILE:-/scripts/QLSV_TrungTamTinHoc.sql}"
BULK_SEED_FILE="${BULK_SEED_FILE:-/scripts/seed_bulk_data.sql}"
RUN_BULK_SEED="${RUN_BULK_SEED:-auto}"   # auto | always | never

if [ -z "${MSSQL_SA_PASSWORD}" ]; then
  echo "[db-init] Missing MSSQL_SA_PASSWORD."
  exit 1
fi

SQLCMD_BIN="/opt/mssql-tools18/bin/sqlcmd"
if [ ! -x "${SQLCMD_BIN}" ]; then
  SQLCMD_BIN="/opt/mssql-tools/bin/sqlcmd"
fi

if [ ! -x "${SQLCMD_BIN}" ]; then
  echo "[db-init] sqlcmd not found in container."
  exit 1
fi

# Helper: run a SQL script through sqlcmd with UTF-8 support (-f 65001)
# -b     : exit non-zero on SQL errors so `set -e` will abort this script.
run_script() {
  local script_path="$1"
  local label="$2"
  echo "[db-init] --> ${label}: ${script_path}"
  "${SQLCMD_BIN}" \
    -S "${DB_SERVER}" \
    -U "${DB_ADMIN_USER}" \
    -P "${MSSQL_SA_PASSWORD}" \
    -C \
    -b \
    -d master \
    -f 65001 \
    -i "${script_path}"
  echo "[db-init] <-- ${label} completed."
}

echo "[db-init] Waiting for SQL Server at ${DB_SERVER}..."
until "${SQLCMD_BIN}" -S "${DB_SERVER}" -U "${DB_ADMIN_USER}" -P "${MSSQL_SA_PASSWORD}" -C -Q "SELECT 1" >/dev/null 2>&1; do
  sleep 2
done

echo "[db-init] SQL Server is ready."

IS_INITIALIZED="$("${SQLCMD_BIN}" -S "${DB_SERVER}" -U "${DB_ADMIN_USER}" -P "${MSSQL_SA_PASSWORD}" -C -h -1 -W -Q "SET NOCOUNT ON; SELECT CASE WHEN DB_ID(N'${DB_NAME}') IS NOT NULL AND EXISTS (SELECT 1 FROM [${DB_NAME}].sys.tables WHERE name = 'Roles') THEN 1 ELSE 0 END")"
IS_INITIALIZED="$(echo "${IS_INITIALIZED}" | tr -d '\r\n[:space:]')"

# ---- Step 1: schema ----
if [ "${IS_INITIALIZED}" = "1" ]; then
  echo "[db-init] Database ${DB_NAME} already initialized. Skip schema import."
else
  if [ ! -f "${SCHEMA_FILE}" ]; then
    echo "[db-init] Schema file not found: ${SCHEMA_FILE}"
    exit 1
  fi
  echo "[db-init] Importing schema from ${SCHEMA_FILE} ..."
  run_script "${SCHEMA_FILE}" "Schema import"
fi

# ---- Step 2: bulk demo seed (idempotent) ----
should_run_seed=0
case "${RUN_BULK_SEED}" in
  never)
    echo "[db-init] RUN_BULK_SEED=never -> skip bulk seed."
    ;;
  always)
    should_run_seed=1
    ;;
  auto|*)
    # Auto mode: only run if bulk file exists. Since it is idempotent
    # we run it on every container start to keep demo data up to date.
    if [ -f "${BULK_SEED_FILE}" ]; then
      should_run_seed=1
    else
      echo "[db-init] Bulk seed file not found: ${BULK_SEED_FILE} (auto skip)."
    fi
    ;;
esac

if [ "${should_run_seed}" = "1" ]; then
  if [ ! -f "${BULK_SEED_FILE}" ]; then
    echo "[db-init] Bulk seed file not found: ${BULK_SEED_FILE}"
    exit 1
  fi
  echo "[db-init] Applying bulk seed from ${BULK_SEED_FILE} ..."
  run_script "${BULK_SEED_FILE}" "Bulk seed"
fi

echo "[db-init] Database initialization completed."
