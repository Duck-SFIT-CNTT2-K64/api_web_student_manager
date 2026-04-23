from __future__ import annotations

from dataclasses import dataclass
from datetime import date as _date
from typing import Any, Dict, List, Optional
import os
import time

from google import genai
from google.genai import types

from db import get_db_connection
from models.student_model import (
    get_student_profile_by_user_id,
    get_student_schedule_by_user_id,
    get_student_finance_by_user_id,
    get_student_scores_by_user_id,
)


def _normalize_date(d: str) -> str:
    try:
        return _date.fromisoformat(str(d)).isoformat()
    except Exception:
        raise ValueError("date must be in YYYY-MM-DD format.")


def _get_student_user_scope(user_id: int) -> Dict[str, Any] | None:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT s.StudentId, s.StudentCode
            FROM Students s
            WHERE s.UserId = ?
            """,
            user_id,
        )
        row = cursor.fetchone()
        if not row:
            return None
        return {"StudentId": int(row[0]), "StudentCode": str(row[1])}


@dataclass
class StudentAssistantAgent:
    model_name: str
    client: Any
    base_url: str

    def reply(
        self,
        *,
        user_id: int,
        role_name: str,
        message: str,
        history: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        role = (role_name or "").strip().lower()
        scope = _get_student_user_scope(user_id)

        # Allow non-students to use assistant in a limited way.
        if role != "student" or scope is None:
            system_instruction = (
                "You are CLASSES369 Student Assistant. "
                "The current user is not a student (or has no student profile). "
                "Respond politely and explain that student-specific data tools require a student account."
            )
            return _call_llm(
                client=self.client,
                model=self.model_name,
                base_url=self.base_url,
                system_instruction=system_instruction,
                history=history,
                user_message=message,
            )

        # Tool routing (deterministic) + LLM for natural language.
        return _reply_student(
            client=self.client,
            model=self.model_name,
            base_url=self.base_url,
            user_id=user_id,
            student_code=scope["StudentCode"],
            message=message,
            history=history,
        )


@dataclass
class FallbackStudentAssistantAgent:
    agents_by_model: Dict[str, StudentAssistantAgent]
    model_order: List[str]
    last_model_used: str | None = None

    def reply(
        self,
        *,
        user_id: int,
        role_name: str,
        message: str,
        history: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        last_exc: Exception | None = None
        for idx, model in enumerate(self.model_order):
            agent = self.agents_by_model.get(model)
            if not agent:
                continue
            try:
                self.last_model_used = agent.model_name
                return agent.reply(
                    user_id=user_id,
                    role_name=role_name,
                    message=message,
                    history=history,
                )
            except Exception as exc:
                last_exc = exc
                self.last_model_used = agent.model_name
                if _is_rate_limit_error(exc) and idx < len(self.model_order) - 1:
                    # tiny backoff before trying next model
                    time.sleep(0.25)
                    continue
                raise
        if last_exc:
            raise last_exc
        return "Assistant is not configured."


def _history_to_prompt(
    history: Optional[List[Dict[str, str]]],
    *,
    system_instruction: str,
    user_message: str,
) -> str:
    """
    Reliability note:
    With ShopAIKey proxy, responses sometimes contain empty `text/parts` when using GenerateContentConfig.
    For demo stability, we send a plain-text prompt (no config) and inline system instruction + history.
    """
    lines: List[str] = []
    if system_instruction:
        lines.append("[SYSTEM]")
        lines.append(system_instruction.strip())
        lines.append("")

    if history:
        lines.append("[CHAT HISTORY]")
        for h in history[-10:]:
            r = (h.get("role") or "").lower()
            t = (h.get("text") or "").strip()
            if not t:
                continue
            who = "USER" if r == "user" else "ASSISTANT"
            lines.append(f"{who}: {t}")
        lines.append("")

    lines.append("[USER]")
    lines.append(user_message.strip())
    lines.append("")
    lines.append("[ASSISTANT]")
    return "\n".join(lines)


def _call_llm(
    *,
    client: Any,
    model: str,
    base_url: str,
    system_instruction: str,
    history: Optional[List[Dict[str, str]]],
    user_message: str,
) -> str:
    prompt = _history_to_prompt(history, system_instruction=system_instruction, user_message=user_message)
    resp = client.models.generate_content(model=model, contents=prompt)
    text = getattr(resp, "text", None)
    if text:
        return str(text)
    return "Xin lỗi, mình chưa trả lời được lúc này."


def _reply_student(
    *,
    client: Any,
    model: str,
    base_url: str,
    user_id: int,
    student_code: str,
    message: str,
    history: Optional[List[Dict[str, str]]],
) -> str:
    m = (message or "").strip()
    low = m.lower()

    # Very small "agentic" router: call tools when asked.
    # Profile intent: keep keywords specific (avoid matching generic "của tôi").
    if any(k in low for k in ["hồ sơ", "profile", "thông tin sinh viên", "thông tin tài khoản"]):
        prof = get_student_profile_by_user_id(int(user_id)) or {}
        if not prof:
            return "Mình không tìm thấy hồ sơ sinh viên của bạn."
        return (
            "Hồ sơ của bạn:\n"
            f"- Họ tên: {prof.get('FullName')}\n"
            f"- Mã SV: {prof.get('StudentCode')}\n"
            f"- Email: {prof.get('Email') or '—'}\n"
            f"- Trạng thái: {prof.get('StatusName') or prof.get('Status') or '—'}"
        )

    if any(k in low for k in ["công nợ", "học phí", "tuition", "nợ"]):
        fin = get_student_finance_by_user_id(int(user_id)) or {}
        return _format_tuition(fin)

    if any(k in low for k in ["điểm", "grades", "grade"]):
        # If user provides a course code, try match; otherwise show summary top N
        scores = get_student_scores_by_user_id(int(user_id)) or []
        if not scores:
            return "Hiện chưa có dữ liệu điểm của bạn."
        # naive extraction: last token looks like course code (e.g., DEVOPS101)
        tokens = [t.strip(" ,.;:()[]{}").upper() for t in m.split()]
        course_code = next((t for t in tokens if len(t) >= 4 and any(c.isdigit() for c in t)), "")
        if course_code:
            matched = [s for s in scores if str(s.get("CourseCode") or "").upper() == course_code]
            if not matched:
                return f"Mình không tìm thấy điểm cho môn `{course_code}`."
            return _format_grades(matched, course_code=course_code)
        return _format_grades(scores, course_code=None)

    if any(k in low for k in ["lịch", "schedule", "học hôm nay", "hôm nay", "ngày"]):
        # try extract YYYY-MM-DD
        d = _extract_date(low)
        if not d and "hôm nay" in low:
            d = _date.today().isoformat()
        if not d:
            return "Bạn muốn xem lịch học ngày nào? (YYYY-MM-DD hoặc nói 'hôm nay')"
        d = _normalize_date(d)
        items = get_student_schedule_by_user_id(int(user_id)) or []
        filtered = []
        for x in items:
            sd = str(x.get("SessionDate") or x.get("Date") or x.get("date") or "")
            if sd[:10] == d:
                filtered.append(x)
        return _format_schedule(filtered, date=d)

    # Otherwise: LLM answers conversationally, still grounded by context.
    system_instruction = (
        "Bạn là Trợ lý sinh viên của CLASSES369. "
        "Trả lời ngắn gọn, rõ ràng, ưu tiên hướng dẫn thao tác trong hệ thống. "
        f"Ngữ cảnh: student_code={student_code}."
    )
    return _call_llm(
        client=client,
        model=model,
        base_url=base_url,
        system_instruction=system_instruction,
        history=history,
        user_message=message,
    )


def _pretty_json(obj: Any) -> str:
    import json

    try:
        return json.dumps(obj, ensure_ascii=False, indent=2)
    except Exception:
        return str(obj)


def _fmt_vnd(x: Any) -> str:
    try:
        n = float(x or 0)
    except Exception:
        return "—"
    s = f"{n:,.0f}".replace(",", ".")
    return f"{s} VND"


def _format_tuition(fin: Any) -> str:
    """
    Expected from get_student_finance_by_user_id:
    usually a list of rows with TotalFee/AmountPaid/Debt/DueDate/Status.
    """
    items = fin if isinstance(fin, list) else (fin.get("Tuitions") if isinstance(fin, dict) else None)
    if not items:
        return "Hiện tại mình chưa thấy dữ liệu học phí của bạn."

    total_debt = 0.0
    lines = ["Thông tin học phí của bạn:"]
    for it in items:
        cls = (it.get("ClassCode") or "").strip()
        name = (it.get("ClassName") or "").strip()
        status = (it.get("Status") or "—").strip()
        due = str(it.get("DueDate") or "—")[:10]
        debt = float(it.get("Debt") or 0)
        total_debt += debt

        lines.append(f"- {cls} — {name}")
        lines.append(f"  • Tổng: {_fmt_vnd(it.get('TotalFee'))} | Đã đóng: {_fmt_vnd(it.get('AmountPaid'))} | Còn nợ: {_fmt_vnd(debt)}")
        lines.append(f"  • Hạn: {due} | Trạng thái: {status}")

    lines.append("")
    lines.append(f"Tổng công nợ hiện tại: {_fmt_vnd(total_debt)}")
    lines.append("Bạn muốn xem chi tiết học phí của lớp nào? (gửi mã lớp, ví dụ: SEC.K01.T7)")
    return "\n".join(lines)


def _format_schedule(items: List[Dict[str, Any]], *, date: str) -> str:
    if not items:
        return f"Ngày {date} bạn không có lịch học."
    lines = [f"Lịch học ngày {date}:"]
    for x in items:
        cls = (x.get("ClassCode") or x.get("Class") or "—")
        course = (x.get("CourseName") or x.get("Course") or "—")
        room = (x.get("RoomName") or x.get("Room") or "—")
        start = str(x.get("StartTime") or x.get("Start") or "")
        end = str(x.get("EndTime") or x.get("End") or "")
        time_str = (start and end and f"{start}-{end}") or (x.get("Time") or "—")
        lines.append(f"- {time_str} | {cls} | {course} | Room: {room}")
    return "\n".join(lines)


def _format_grades(items: List[Dict[str, Any]], *, course_code: str | None) -> str:
    if not items:
        return "Hiện chưa có dữ liệu điểm của bạn."

    if course_code:
        title = f"Điểm môn {course_code}:"
        rows = items[:8]
    else:
        title = "Một số điểm gần đây:"
        rows = items[:6]

    lines = [title]
    for s in rows:
        cc = (s.get("CourseCode") or "—")
        cn = (s.get("CourseName") or "")
        st = (s.get("ScoreTypeName") or s.get("Type") or "—")
        val = s.get("ScoreValue")
        lines.append(f"- {cc} {('— ' + cn) if cn else ''} | {st}: {val}")

    if not course_code:
        lines.append("")
        lines.append("Bạn muốn tra theo môn nào? (ví dụ: DEVOPS101)")
    return "\n".join(lines)


def _extract_date(text: str) -> str | None:
    import re

    m = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", text)
    if m:
        return m.group(1)
    return None


def _is_rate_limit_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    # Common signals across Google SDK / genai
    needles = [
        "429",
        "resource_exhausted",
        "rate limit",
        "quota",
        "exceeded",
        "too many requests",
    ]
    if any(n in msg for n in needles):
        return True
    # Some exceptions have status_code attribute
    status = getattr(exc, "status_code", None)
    if status == 429:
        return True
    return False


def _parse_model_order() -> List[str]:
    # Env-driven model order; safe defaults for demo
    # Example: ASSISTANT_MODEL_ORDER="gemini-2.5-pro,gemini-2.5-flash,gemini-2.0-flash"
    raw = os.getenv("ASSISTANT_MODEL_ORDER", "").strip()
    if raw:
        items = [x.strip() for x in raw.split(",") if x.strip()]
        if items:
            return items
    # Default: Pro first (stability for demo), then Flash variants.
    return ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"]


def _make_agent_for_model(model: str) -> StudentAssistantAgent:
    api_key = os.getenv("SHOPAIKEY_API_KEY") or os.getenv("GOOGLE_API_KEY") or ""
    base_url = os.getenv("SHOPAIKEY_BASE_URL", "https://api.shopaikey.com").strip() or "https://api.shopaikey.com"
    http_options = types.HttpOptions(api_version="v1beta", base_url=base_url)
    client = genai.Client(api_key=api_key, http_options=http_options)
    return StudentAssistantAgent(model_name=model, client=client, base_url=base_url)


def build_student_assistant_agent() -> Any:
    model_order = _parse_model_order()
    agents_by_model: Dict[str, StudentAssistantAgent] = {}
    for m in model_order:
        agents_by_model[m] = _make_agent_for_model(m)

    # If only one model, keep old behavior shape
    if len(model_order) == 1:
        return agents_by_model[model_order[0]]

    return FallbackStudentAssistantAgent(agents_by_model=agents_by_model, model_order=model_order)

