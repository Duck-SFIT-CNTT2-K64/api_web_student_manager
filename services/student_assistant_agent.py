from __future__ import annotations

from dataclasses import dataclass
from datetime import date as _date
from typing import Any, Dict, List, Optional

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.prebuilt import create_react_agent

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
    agent: Any

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
            sys = SystemMessage(
                content=(
                    "You are CLASSES369 Student Assistant. "
                    "The current user is not a student (or has no student profile). "
                    "Respond politely and explain that student-specific data tools require a student account."
                )
            )
            out = self.agent.invoke({"messages": [sys, HumanMessage(content=message)]})
            return _extract_last_ai(out)

        student_ctx = (
            f"Context: current_user_id={user_id}, role=Student, student_code={scope['StudentCode']}.\n"
            "If the user asks about schedules, tuition, or grades, use the provided tools.\n"
            "If a tool requires a date, enforce YYYY-MM-DD."
        )
        sys = SystemMessage(
            content=(
                "Bạn là 'Trợ lý sinh viên' của CLASSES369.\n"
                "Chỉ dùng tool khi cần dữ liệu: get_student_profile, get_class_schedule, "
                "check_tuition_balance, get_grades.\n"
                "Trả lời ngắn gọn, rõ ràng, đúng ngữ cảnh.\n"
                "Nếu thiếu tham số (ngày / course), hỏi lại đúng 1 câu.\n\n"
                + student_ctx
            )
        )

        msgs: List[Any] = [sys]
        if history:
            for h in history[-12:]:
                r = (h.get("role") or "").lower()
                t = h.get("text") or ""
                if r == "user":
                    msgs.append(HumanMessage(content=t))
                elif r == "assistant":
                    msgs.append(AIMessage(content=t))
        msgs.append(HumanMessage(content=message))

        out = self.agent.invoke({"messages": msgs, "user_id": user_id})
        return _extract_last_ai(out)


def _extract_last_ai(out: Any) -> str:
    messages = (out or {}).get("messages") or []
    for m in reversed(messages):
        if isinstance(m, AIMessage):
            return str(m.content or "")
    return "Xin lỗi, mình chưa trả lời được lúc này."


# ========= Tools (LLM callable) =========
# NOTE: 


def _runtime_user_id() -> int:
    raise RuntimeError("Tool requires user_id argument.")


@tool
def get_student_profile(user_id: int) -> Dict[str, Any]:
    """Lấy thông tin sinh viên hiện tại."""
    return get_student_profile_by_user_id(int(user_id)) or {"error": "Student profile not found."}


@tool
def get_class_schedule(user_id: int, date: str) -> Dict[str, Any]:
    """Truy xuất lịch học theo ngày (YYYY-MM-DD) của sinh viên hiện tại."""
    d = _normalize_date(date)
    items = get_student_schedule_by_user_id(int(user_id)) or []
    filtered = []
    for x in items:
        sd = str(x.get("SessionDate") or x.get("Date") or x.get("date") or "")
        if sd[:10] == d:
            filtered.append(x)
    return {"date": d, "items": filtered}


@tool
def check_tuition_balance(user_id: int) -> Dict[str, Any]:
    """Kiểm tra công nợ học phí của sinh viên hiện tại."""
    data = get_student_finance_by_user_id(int(user_id)) or {}
    # best-effort normalization
    return {"finance": data}


@tool
def get_grades(user_id: int, course_id: str) -> Dict[str, Any]:
    """Tra cứu điểm theo course_id (CourseCode hoặc CourseId) của sinh viên hiện tại."""
    course_key = str(course_id or "").strip().lower()
    scores = get_student_scores_by_user_id(int(user_id)) or []
    matched = []
    for s in scores:
        cc = str(s.get("CourseCode") or "").strip().lower()
        cid = str(s.get("CourseId") or "").strip().lower()
        if course_key and (course_key == cc or course_key == cid):
            matched.append(s)
    return {"course_id": course_id, "items": matched, "found": bool(matched)}


def build_student_assistant_agent() -> StudentAssistantAgent:
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        temperature=0.3,
    )
    tools = [get_student_profile, get_class_schedule, check_tuition_balance, get_grades]
    agent = create_react_agent(llm, tools)
    return StudentAssistantAgent(agent=agent)

