#!/usr/bin/env bash
set -euo pipefail

DB_SERVER="${DB_SERVER:-db}"
DB_NAME="${DB_NAME:-QLSV_TrungTamTinHoc}"
DB_ADMIN_USER="${DB_ADMIN_USER:-sa}"
MSSQL_SA_PASSWORD="${MSSQL_SA_PASSWORD:-}"
SCHEMA_FILE="${SCHEMA_FILE:-/scripts/QLSV_TrungTamTinHoc.sql}"
BULK_SEED_FILE="${BULK_SEED_FILE:-/scripts/seed_bulk_data.sql}"
RUN_BULK_SEED="${RUN_BULK_SEED:-auto}"

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
    -i "${script_path}"
  echo "[db-init] <-- ${label} completed."
}

echo "[db-init] Waiting for SQL Server at ${DB_SERVER}..."
until "${SQLCMD_BIN}" -S "${DB_SERVER}" -U "${DB_ADMIN_USER}" -P "${MSSQL_SA_PASSWORD}" -C -Q "SELECT 1" >/dev/null 2>&1; do
  sleep 2
done

echo "[db-init] SQL Server is ready."

echo "[db-init] Waiting for database ${DB_NAME} to be ONLINE (if exists)..."
for i in {1..60}; do
  db_state="$("${SQLCMD_BIN}" -S "${DB_SERVER}" -U "${DB_ADMIN_USER}" -P "${MSSQL_SA_PASSWORD}" -C -h -1 -W -Q "SET NOCOUNT ON; SELECT COALESCE(state_desc,'MISSING') FROM sys.databases WHERE name = N'${DB_NAME}'" 2>/dev/null || true)"
  db_state="$(echo "${db_state}" | tr -d '\r\n[:space:]')"
  if [ -z "${db_state}" ] || [ "${db_state}" = "MISSING" ] || [ "${db_state}" = "ONLINE" ]; then
    break
  fi
  echo "[db-init] DB state=${db_state}. Sleeping..."
  sleep 2
done

echo "[db-init] Ensuring required columns exist..."
"${SQLCMD_BIN}" -S "${DB_SERVER}" -U "${DB_ADMIN_USER}" -P "${MSSQL_SA_PASSWORD}" -C -b -d master -Q "
IF DB_ID(N'${DB_NAME}') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'${DB_NAME}.dbo.Notifications', N'AttachmentUrl') IS NULL
  BEGIN
    PRINT N'Adding Notifications.AttachmentUrl...';
    ALTER TABLE [${DB_NAME}].dbo.Notifications ADD AttachmentUrl NVARCHAR(500) NULL;
  END

  IF COL_LENGTH(N'${DB_NAME}.dbo.Classes', N'Semester') IS NULL
  BEGIN
    PRINT N'Adding Classes.Semester...';
    ALTER TABLE [${DB_NAME}].dbo.Classes ADD Semester NVARCHAR(50) NULL;
  END
END
"

IS_INITIALIZED="$("${SQLCMD_BIN}" -S "${DB_SERVER}" -U "${DB_ADMIN_USER}" -P "${MSSQL_SA_PASSWORD}" -C -h -1 -W -Q "SET NOCOUNT ON; SELECT CASE WHEN DB_ID(N'${DB_NAME}') IS NOT NULL AND EXISTS (SELECT 1 FROM [${DB_NAME}].sys.tables WHERE name = 'Roles') THEN 1 ELSE 0 END")"
IS_INITIALIZED="$(echo "${IS_INITIALIZED}" | tr -d '\r\n[:space:]')"

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

should_run_seed=0
case "${RUN_BULK_SEED}" in
  never)
    echo "[db-init] RUN_BULK_SEED=never -> skip bulk seed."
    ;;
  always)
    should_run_seed=1
    ;;
  auto|*)
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

# Helper: run a SQL script through sqlcmd.
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
    -i "${script_path}"
  echo "[db-init] <-- ${label} completed."
}

echo "[db-init] Waiting for SQL Server at ${DB_SERVER}..."
until "${SQLCMD_BIN}" -S "${DB_SERVER}" -U "${DB_ADMIN_USER}" -P "${MSSQL_SA_PASSWORD}" -C -Q "SELECT 1" >/dev/null 2>&1; do
  sleep 2
done

echo "[db-init] SQL Server is ready."

# ---- New: Wait for DB to be ONLINE if it already exists ----
# Tránh lỗi Msg 904: Database cannot be autostarted during startup
echo "[db-init] Checking if database ${DB_NAME} exists and is ONLINE..."
while true; do
    # Lấy state_desc: ONLINE, RECOVERING, etc.
    DB_STATE=$("${SQLCMD_BIN}" -S "${DB_SERVER}" -U "${DB_ADMIN_USER}" -P "${MSSQL_SA_PASSWORD}" -C -h -1 -W -Q "SET NOCOUNT ON; SELECT state_desc FROM sys.databases WHERE name = N'${DB_NAME}'" || echo "NOT_FOUND")
    DB_STATE=$(echo "${DB_STATE}" | tr -d '\r\n[:space:]')
    
    if [ -z "${DB_STATE}" ] || [ "${DB_STATE}" = "NOT_FOUND" ]; then
        echo "[db-init] Database ${DB_NAME} does not exist yet."
        break
    fi
    
    if [ "${DB_STATE}" = "ONLINE" ]; then
        echo "[db-init] Database ${DB_NAME} is ONLINE."
        break
    fi
    
    echo "[db-init] Database ${DB_NAME} is in state: ${DB_STATE}. Waiting..."
    sleep 2
done

# Kiểm tra xem đã có bảng Roles chưa để quyết định có chạy schema script không.
# Bọc trong || true để tránh set -e ngắt script nếu DB chưa có table.
IS_INITIALIZED=0
CHECK_INIT=$("${SQLCMD_BIN}" -S "${DB_SERVER}" -U "${DB_ADMIN_USER}" -P "${MSSQL_SA_PASSWORD}" -C -h -1 -W -Q "SET NOCOUNT ON; IF DB_ID(N'${DB_NAME}') IS NOT NULL AND EXISTS (SELECT 1 FROM [${DB_NAME}].sys.tables WHERE name = 'Roles') SELECT 1 ELSE SELECT 0" || echo "0")
IS_INITIALIZED=$(echo "${CHECK_INIT}" | tr -d '\r\n[:space:]')
# Some restarts can leave user DBs in recovery for a bit even after SQL accepts connections.
# Avoid `Msg 904 ... cannot be autostarted during server shutdown or startup`.
echo "[db-init] Waiting for database ${DB_NAME} to be ONLINE (if exists)..."
for i in {1..60}; do
  db_state="$("${SQLCMD_BIN}" -S "${DB_SERVER}" -U "${DB_ADMIN_USER}" -P "${MSSQL_SA_PASSWORD}" -C -h -1 -W -Q "SET NOCOUNT ON; SELECT COALESCE(state_desc,'MISSING') FROM sys.databases WHERE name = N'${DB_NAME}'" 2>/dev/null || true)"
  db_state="$(echo "${db_state}" | tr -d '\r\n[:space:]')"
  if [ -z "${db_state}" ] || [ "${db_state}" = "MISSING" ] || [ "${db_state}" = "ONLINE" ]; then
    break
  fi
  echo "[db-init] DB state=${db_state}. Sleeping..."
  sleep 2
done

# ---- Step 0: lightweight migrations to match app expectations ----
# Keep these idempotent so db-init can run many times.
echo "[db-init] Ensuring required columns exist..."
"${SQLCMD_BIN}" -S "${DB_SERVER}" -U "${DB_ADMIN_USER}" -P "${MSSQL_SA_PASSWORD}" -C -b -d master -Q "
IF DB_ID(N'${DB_NAME}') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'${DB_NAME}.dbo.Notifications', N'AttachmentUrl') IS NULL
  BEGIN
    PRINT N'Adding Notifications.AttachmentUrl...';
    ALTER TABLE [${DB_NAME}].dbo.Notifications ADD AttachmentUrl NVARCHAR(500) NULL;
  END

  IF COL_LENGTH(N'${DB_NAME}.dbo.Classes', N'Semester') IS NULL
  BEGIN
    PRINT N'Adding Classes.Semester...';
    ALTER TABLE [${DB_NAME}].dbo.Classes ADD Semester NVARCHAR(50) NULL;
  END
END
"

IS_INITIALIZED="$("${SQLCMD_BIN}" -S "${DB_SERVER}" -U "${DB_ADMIN_USER}" -P "${MSSQL_SA_PASSWORD}" -C -h -1 -W -Q "SET NOCOUNT ON; SELECT CASE WHEN DB_ID(N'${DB_NAME}') IS NOT NULL AND EXISTS (SELECT 1 FROM [${DB_NAME}].sys.tables WHERE name = 'Roles') THEN 1 ELSE 0 END")"
IS_INITIALIZED="$(echo "${IS_INITIALIZED}" | tr -d '\r\n[:space:]')"

# ---- Step 1: schema ----
if [ "${IS_INITIALIZED}" = "1" ]; then
  echo "[db-init] Database ${DB_NAME} already initialized (Roles table found). Skip schema import."
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
