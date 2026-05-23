"""Automation rules REST API router.

Endpoints for creating, updating, deleting, and testing automation rules.
Includes a template gallery with pre-built Arabic-first rules.
"""
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from middleware.auth_middleware import get_current_user
from models import AutomationRule, AutomationRun, User
from services.automation_engine import (
    AutomationContext,
    AutomationEngine,
    TRIGGERS,
    ACTIONS,
    get_templates,
)

logger = logging.getLogger("automation_router")
router = APIRouter(prefix="/automation", tags=["automation"])


# ── Schemas ──────────────────────────────────────────────────────────────
class RuleCreate(BaseModel):
    name: str
    description: str | None = None
    trigger_type: str
    trigger_config: dict | None = None
    conditions: list | None = None
    actions: list | None = None
    is_active: bool = True
    priority: int = 0
    prevent_loops: bool = True
    max_executions_per_conversation: int = 3
    template_id: str | None = None


class RuleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    trigger_type: str | None = None
    trigger_config: dict | None = None
    conditions: list | None = None
    actions: list | None = None
    is_active: bool | None = None
    priority: int | None = None
    prevent_loops: bool | None = None
    max_executions_per_conversation: int | None = None


class DryRunInput(BaseModel):
    trigger: str = "new_message"
    channel: str = "widget"
    customer_name: str = "أحمد"
    message_text: str = "كم سعر هالمنتج؟"
    product_name: str = ""
    product_price: str = ""
    product_availability: str = ""
    verifier_risk_score: float = 0.0
    verifier_verdict: str = "SAFE_TO_SEND"
    session_message_count: int = 1


# ── Endpoints ────────────────────────────────────────────────────────────
@router.get("/rules")
async def list_rules(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all automation rules for the current business."""
    stmt = (
        select(AutomationRule)
        .where(AutomationRule.user_id == current_user.id)
        .order_by(AutomationRule.priority.desc(), AutomationRule.created_at.desc())
    )
    rules = list((await db.execute(stmt)).scalars().all())
    return [
        {
            "id": str(r.id),
            "name": r.name,
            "description": r.description,
            "trigger_type": r.trigger_type,
            "trigger_config": r.trigger_config or {},
            "conditions": r.conditions or [],
            "actions": r.actions or [],
            "is_active": r.is_active,
            "priority": r.priority,
            "prevent_loops": r.prevent_loops,
            "max_executions_per_conversation": r.max_executions_per_conversation,
            "template_id": r.template_id,
            "version": r.version,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        }
        for r in rules
    ]


@router.post("/rules")
async def create_rule(
    body: RuleCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new automation rule."""
    if body.trigger_type not in TRIGGERS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid trigger_type. Must be one of: {', '.join(sorted(TRIGGERS))}",
        )

    # Validate actions
    if body.actions:
        for action in body.actions:
            if action.get("type") not in ACTIONS:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid action type '{action.get('type')}'. Must be one of: {', '.join(sorted(ACTIONS))}",
                )

    rule = AutomationRule(
        user_id=current_user.id,
        name=body.name,
        description=body.description,
        trigger_type=body.trigger_type,
        trigger_config=body.trigger_config or {},
        conditions=body.conditions or [],
        actions=body.actions or [],
        is_active=body.is_active,
        priority=body.priority,
        prevent_loops=body.prevent_loops,
        max_executions_per_conversation=body.max_executions_per_conversation,
        template_id=body.template_id,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)

    return {"id": str(rule.id), "status": "created"}


@router.put("/rules/{rule_id}")
async def update_rule(
    rule_id: uuid.UUID,
    body: RuleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing automation rule."""
    rule = await db.get(AutomationRule, rule_id)
    if rule is None or rule.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Rule not found")

    if body.trigger_type is not None:
        if body.trigger_type not in TRIGGERS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid trigger_type: {body.trigger_type}",
            )
        rule.trigger_type = body.trigger_type
    if body.name is not None:
        rule.name = body.name
    if body.description is not None:
        rule.description = body.description
    if body.trigger_config is not None:
        rule.trigger_config = body.trigger_config
    if body.conditions is not None:
        rule.conditions = body.conditions
    if body.actions is not None:
        rule.actions = body.actions
    if body.is_active is not None:
        rule.is_active = body.is_active
    if body.priority is not None:
        rule.priority = body.priority
    if body.prevent_loops is not None:
        rule.prevent_loops = body.prevent_loops
    if body.max_executions_per_conversation is not None:
        rule.max_executions_per_conversation = body.max_executions_per_conversation

    rule.version += 1
    await db.commit()

    return {"id": str(rule.id), "status": "updated", "version": rule.version}


@router.delete("/rules/{rule_id}")
async def delete_rule(
    rule_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an automation rule."""
    rule = await db.get(AutomationRule, rule_id)
    if rule is None or rule.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Rule not found")

    await db.delete(rule)
    await db.commit()
    return {"status": "deleted"}


@router.post("/rules/{rule_id}/toggle")
async def toggle_rule(
    rule_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Toggle a rule's active status."""
    rule = await db.get(AutomationRule, rule_id)
    if rule is None or rule.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Rule not found")

    rule.is_active = not rule.is_active
    await db.commit()
    return {"id": str(rule.id), "is_active": rule.is_active}


@router.post("/rules/{rule_id}/dry-run")
async def dry_run(
    rule_id: uuid.UUID,
    body: DryRunInput,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Test a rule without executing actions."""
    rule = await db.get(AutomationRule, rule_id)
    if rule is None or rule.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Rule not found")

    context = AutomationContext(
        trigger=body.trigger,
        channel=body.channel,
        customer_name=body.customer_name,
        message_text=body.message_text,
        product_name=body.product_name,
        product_price=body.product_price,
        product_availability=body.product_availability,
        verifier_risk_score=body.verifier_risk_score,
        verifier_verdict=body.verifier_verdict,
        session_message_count=body.session_message_count,
    )

    engine = AutomationEngine()
    result = await engine.dry_run_rule(rule_id, context, db)
    return result


@router.get("/runs")
async def list_runs(
    rule_id: uuid.UUID | None = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List recent automation run logs."""
    stmt = (
        select(AutomationRun)
        .join(AutomationRule, AutomationRun.rule_id == AutomationRule.id)
        .where(AutomationRule.user_id == current_user.id)
    )
    if rule_id:
        stmt = stmt.where(AutomationRun.rule_id == rule_id)
    stmt = stmt.order_by(AutomationRun.created_at.desc()).limit(limit)

    runs = list((await db.execute(stmt)).scalars().all())
    return [
        {
            "id": str(r.id),
            "rule_id": str(r.rule_id),
            "session_id": str(r.session_id) if r.session_id else None,
            "trigger_matched": r.trigger_matched,
            "conditions_matched": r.conditions_matched,
            "actions_executed": r.actions_executed,
            "status": r.status,
            "error": r.error,
            "execution_time_ms": r.execution_time_ms,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in runs
    ]


@router.get("/templates")
async def list_templates(
    current_user: User = Depends(get_current_user),
):
    """List pre-built automation templates."""
    return get_templates()


@router.post("/rules/from-template/{template_id}")
async def create_from_template(
    template_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new rule from a pre-built template."""
    templates = get_templates()
    template = next((t for t in templates if t["id"] == template_id), None)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")

    rule = AutomationRule(
        user_id=current_user.id,
        name=template["name"],
        description=template.get("description"),
        trigger_type=template["trigger_type"],
        trigger_config=template.get("trigger_config", {}),
        conditions=template.get("conditions", []),
        actions=template.get("actions", []),
        template_id=template_id,
        is_active=False,  # Templates start disabled so user can review
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)

    return {"id": str(rule.id), "status": "created_from_template", "is_active": False}


@router.get("/triggers")
async def list_triggers(
    current_user: User = Depends(get_current_user),
):
    """List available trigger types."""
    return sorted(TRIGGERS)


@router.get("/actions")
async def list_actions(
    current_user: User = Depends(get_current_user),
):
    """List available action types."""
    return sorted(ACTIONS)
