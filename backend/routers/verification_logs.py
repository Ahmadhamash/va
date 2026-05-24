"""AI verification log router."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from middleware.auth_middleware import get_current_user
from models import AIVerificationLog, User

router = APIRouter(prefix="/verification-logs", tags=["verification-logs"])


def _serialize_log(log: AIVerificationLog) -> dict:
    return {
        "id": str(log.id),
        "message_id": str(log.message_id) if log.message_id else None,
        "session_id": str(log.session_id),
        "user_id": str(log.user_id),
        "customer_message": log.customer_message,
        "retrieved_data": log.retrieved_data or {},
        "draft_answer": log.draft_answer,
        "verifier_status": log.verifier_status,
        "risk_score": log.risk_score,
        "reasons": log.reasons or [],
        "flagged_claims": log.flagged_claims or [],
        "grounding_data_used": log.grounding_data_used or [],
        "final_action": log.final_action,
        "final_answer": log.final_answer,
        "created_at": log.created_at.isoformat() if log.created_at else None,
    }


def _base_scope(stmt, current_user: User):
    if current_user.role in ("admin", "support_agent"):
        return stmt
    return stmt.where(AIVerificationLog.user_id == current_user.id)


@router.get("/")
async def list_verification_logs(
    limit: int = Query(100, ge=1, le=500),
    verifier_status: str | None = None,
    session_id: uuid.UUID | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(AIVerificationLog)
    stmt = _base_scope(stmt, current_user)

    if verifier_status:
        stmt = stmt.where(AIVerificationLog.verifier_status == verifier_status)
    if session_id:
        stmt = stmt.where(AIVerificationLog.session_id == session_id)

    stmt = stmt.order_by(AIVerificationLog.created_at.desc()).limit(limit)
    logs = list((await db.execute(stmt)).scalars().all())

    stats_stmt = select(
        AIVerificationLog.verifier_status,
        func.count(AIVerificationLog.id),
    )
    stats_stmt = _base_scope(stats_stmt, current_user)
    stats_stmt = stats_stmt.group_by(AIVerificationLog.verifier_status)
    status_counts = {
        status: count for status, count in (await db.execute(stats_stmt)).all()
    }

    return {
        "logs": [_serialize_log(log) for log in logs],
        "stats": {
            "total": sum(status_counts.values()),
            "by_status": status_counts,
        },
    }
