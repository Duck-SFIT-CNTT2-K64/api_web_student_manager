from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, Iterable, List


def _serialize_value(value: Any) -> Any:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return value


def row_to_dict(cursor, row) -> Dict[str, Any]:
    columns = [column[0] for column in cursor.description]
    return {columns[index]: _serialize_value(row[index]) for index in range(len(columns))}


def rows_to_list(cursor, rows: Iterable) -> List[Dict[str, Any]]:
    columns = [column[0] for column in cursor.description]
    result: List[Dict[str, Any]] = []

    for row in rows:
        item = {columns[index]: _serialize_value(row[index]) for index in range(len(columns))}
        result.append(item)

    return result
