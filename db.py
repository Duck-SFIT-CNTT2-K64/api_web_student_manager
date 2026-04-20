import os
from contextlib import contextmanager

import pyodbc


def _build_connection_string() -> str:
    driver = os.getenv("DB_DRIVER", "ODBC Driver 17 for SQL Server")
    server = os.getenv("DB_SERVER", "DUCKCYZZZ\\SQLEXPRESS")
    database = os.getenv("DB_NAME", "QLSV_TrungTamTinHoc")

    trusted_connection = os.getenv("DB_TRUSTED_CONNECTION", "yes").lower()
    user = os.getenv("DB_USER", "")
    password = os.getenv("DB_PASSWORD", "")
    encrypt = os.getenv("DB_ENCRYPT", "no").lower()
    trust_server_certificate = os.getenv("DB_TRUST_SERVER_CERTIFICATE", "yes").lower()

    parts = [
        f"DRIVER={{{driver}}}",
        f"SERVER={server}",
        f"DATABASE={database}",
    ]

    if trusted_connection in {"yes", "true", "1"}:
        parts.append("Trusted_Connection=yes")
    else:
        parts.append(f"UID={user}")
        parts.append(f"PWD={password}")

    parts.append("Encrypt=yes" if encrypt in {"yes", "true", "1"} else "Encrypt=no")
    parts.append(
        "TrustServerCertificate=yes"
        if trust_server_certificate in {"yes", "true", "1"}
        else "TrustServerCertificate=no"
    )

    return ";".join(parts) + ";"


@contextmanager
def get_db_connection():
    connection = pyodbc.connect(_build_connection_string())
    try:
        yield connection
    finally:
        connection.close()
