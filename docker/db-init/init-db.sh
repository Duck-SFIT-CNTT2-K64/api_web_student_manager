#!/usr/bin/env bash
set -euo pipefail

DB_SERVER="${DB_SERVER:-db}"
DB_NAME="${DB_NAME:-QLSV_TrungTamTinHoc}"
DB_ADMIN_USER="${DB_ADMIN_USER:-sa}"
MSSQL_SA_PASSWORD="${MSSQL_SA_PASSWORD:-}"
SCHEMA_FILE="${SCHEMA_FILE:-/scripts/QLSV_TrungTamTinHoc.sql}"

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

echo "[db-init] Waiting for SQL Server at ${DB_SERVER}..."
until "${SQLCMD_BIN}" -S "${DB_SERVER}" -U "${DB_ADMIN_USER}" -P "${MSSQL_SA_PASSWORD}" -C -Q "SELECT 1" >/dev/null 2>&1; do
  sleep 2
done

echo "[db-init] SQL Server is ready."

IS_INITIALIZED="$("${SQLCMD_BIN}" -S "${DB_SERVER}" -U "${DB_ADMIN_USER}" -P "${MSSQL_SA_PASSWORD}" -C -h -1 -W -Q "SET NOCOUNT ON; SELECT CASE WHEN DB_ID(N'${DB_NAME}') IS NOT NULL AND EXISTS (SELECT 1 FROM [${DB_NAME}].sys.tables WHERE name = 'Roles') THEN 1 ELSE 0 END")"
IS_INITIALIZED="$(echo "${IS_INITIALIZED}" | tr -d '\r\n[:space:]')"

if [ "${IS_INITIALIZED}" = "1" ]; then
  echo "[db-init] Database ${DB_NAME} already initialized. Skip import."
  exit 0
fi

if [ ! -f "${SCHEMA_FILE}" ]; then
  echo "[db-init] Schema file not found: ${SCHEMA_FILE}"
  exit 1
fi

echo "[db-init] Importing schema/data from ${SCHEMA_FILE} ..."
"${SQLCMD_BIN}" -S "${DB_SERVER}" -U "${DB_ADMIN_USER}" -P "${MSSQL_SA_PASSWORD}" -C -d master -i "${SCHEMA_FILE}"

echo "[db-init] Database initialization completed."
