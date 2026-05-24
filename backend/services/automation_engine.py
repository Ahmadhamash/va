"""Automation Engine — trigger → condition → action pipeline.

Evaluates automation rules against incoming events (messages, handoffs,
verification results) and executes actions when conditions match.

Features:
- 10 trigger types (new_message, keyword_match, hallucination_risk, etc.)
- Condition evaluation with operators (equals, contains, greater_than, etc.)
- 7 action types (send_message, handoff, tag_customer, etc.)
- Dry-run mode for testing without side effects
- Loop prevention (max_executions_per_conversation, prevent_loops flag)
- Execution logging to AutomationRun + AutomationLog
- Variable substitution ({{customer_name}}, {{channel}}, etc.)
"""
from __future__ import annotations

import json
import logging
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models import (
    AutomationLog,
    AutomationRule,
    AutomationRun,
    ChatSession,
)

logger = logging.getLogger("automation_engine")


# ── Trigger Types ────────────────────────────────────────────────────────
TRIGGERS = {
    "new_message",
    "keyword_match",
    "intent_match",
    "product_not_found",
    "hallucination_risk",
    "low_confidence",
    "outside_working_hours",
    "customer_angry",
    "handoff_triggered",
    "session_idle",
}

# ── Action Types ─────────────────────────────────────────────────────────
ACTIONS = {
    "send_message",
    "handoff",
    "tag_customer",
    "set_variable",
    "send_notification",
    "pause_ai",
    "log_event",
}


class AutomationContext:
    """Context object passed to the engine with all relevant data."""

    def __init__(
        self,
        *,
        trigger: str,
        session_id: uuid.UUID | None = None,
        message_id: uuid.UUID | None = None,
        user_id: uuid.UUID | None = None,
        channel: str = "widget",
        customer_name: str = "",
        message_text: str = "",
        product_name: str = "",
        product_price: str = "",
        product_availability: str = "",
        verifier_risk_score: float = 0.0,
        verifier_verdict: str = "",
        session_message_count: int = 0,
        customer_tags: list[str] | None = None,
        current_time: datetime | None = None,
        extra: dict | None = None,
    ):
        self.trigger = trigger
        self.session_id = session_id
        self.message_id = message_id
        self.user_id = user_id
        self.channel = channel
        self.customer_name = customer_name
        self.message_text = message_text
        self.product_name = product_name
        self.product_price = product_price
        self.product_availability = product_availability
        self.verifier_risk_score = verifier_risk_score
        self.verifier_verdict = verifier_verdict
        self.session_message_count = session_message_count
        self.customer_tags = customer_tags or []
        self.current_time = current_time or datetime.now(timezone.utc)
        self.extra = extra or {}

    def get_variable(self, name: str) -> str:
        """Resolve a template variable like {{customer_name}}."""
        mapping = {
            "customer_name": self.customer_name,
            "channel": self.channel,
            "message_text": self.message_text,
            "session_id": str(self.session_id) if self.session_id else "",
            "product_name": self.product_name,
            "product_price": self.product_price,
            "product_availability": self.product_availability,
            "verifier_risk_score": str(self.verifier_risk_score),
            "verifier_verdict": self.verifier_verdict,
        }
        return mapping.get(name, self.extra.get(name, ""))

    def substitute_variables(self, text: str) -> str:
        """Replace {{variable}} placeholders in text."""
        def replacer(match):
            var_name = match.group(1).strip()
            return self.get_variable(var_name)
        return re.sub(r"\{\{(.+?)\}\}", replacer, text)


class AutomationEngine:
    """Evaluates automation rules and executes matching actions."""

    async def evaluate_rules(
        self,
        trigger: str,
        context: AutomationContext,
        user_id: uuid.UUID,
        db: AsyncSession,
        *,
        dry_run: bool = False,
    ) -> list[dict]:
        """Evaluate all active rules for a trigger.

        Args:
            trigger: The trigger event name
            context: AutomationContext with all relevant data
            user_id: The business owner's user ID
            db: Database session
            dry_run: If True, don't execute actions (just evaluate)

        Returns:
            List of execution results
        """
        if trigger not in TRIGGERS:
            logger.warning("Unknown trigger type: %s", trigger)
            return []

        # Fetch active rules for this trigger, ordered by priority
        stmt = (
            select(AutomationRule)
            .where(
                AutomationRule.user_id == user_id,
                AutomationRule.trigger_type == trigger,
                AutomationRule.is_active.is_(True),
            )
            .order_by(AutomationRule.priority.desc())
        )
        rules = list((await db.execute(stmt)).scalars().all())

        if not rules:
            return []

        results = []
        for rule in rules:
            start_ms = time.monotonic_ns()
            try:
                result = await self._evaluate_single_rule(
                    rule, context, db, dry_run=dry_run
                )
                elapsed_ms = int((time.monotonic_ns() - start_ms) / 1_000_000)
                result["execution_time_ms"] = elapsed_ms
                results.append(result)
            except Exception:
                elapsed_ms = int((time.monotonic_ns() - start_ms) / 1_000_000)
                logger.exception("Error evaluating rule %s", rule.id)
                results.append({
                    "rule_id": str(rule.id),
                    "rule_name": rule.name,
                    "trigger_matched": True,
                    "conditions_matched": False,
                    "actions_executed": [],
                    "status": "error",
                    "error": "Evaluation failed",
                    "execution_time_ms": elapsed_ms,
                })

        return results

    async def dry_run_rule(
        self,
        rule_id: uuid.UUID,
        context: AutomationContext,
        db: AsyncSession,
    ) -> dict:
        """Test a single rule without executing actions."""
        rule = await db.get(AutomationRule, rule_id)
        if rule is None:
            return {"error": "Rule not found", "status": "error"}

        return await self._evaluate_single_rule(rule, context, db, dry_run=True)

    async def _evaluate_single_rule(
        self,
        rule: AutomationRule,
        context: AutomationContext,
        db: AsyncSession,
        *,
        dry_run: bool = False,
    ) -> dict:
        """Evaluate a single rule against the context."""
        result = {
            "rule_id": str(rule.id),
            "rule_name": rule.name,
            "trigger_matched": True,
            "conditions_matched": False,
            "conditions_evaluation": [],
            "actions_executed": [],
            "status": "skipped",
            "dry_run": dry_run,
        }

        # Check trigger config (e.g., keywords for keyword_match)
        if not self._check_trigger(rule, context):
            result["trigger_matched"] = False
            result["status"] = "trigger_not_matched"
            if not dry_run:
                await self._log_run(rule, context, result, db)
            return result

        # Check loop prevention
        if rule.prevent_loops and context.session_id and not dry_run:
            exec_count = await self._get_execution_count(
                rule.id, context.session_id, db
            )
            if exec_count >= rule.max_executions_per_conversation:
                result["status"] = "loop_prevented"
                result["error"] = (
                    f"Max executions ({rule.max_executions_per_conversation}) "
                    f"reached for this conversation"
                )
                await self._log_run(rule, context, result, db)
                return result

        # Evaluate conditions
        conditions = rule.conditions or []
        conditions_eval = []
        all_matched = True
        for cond in conditions:
            matched = self._evaluate_condition(cond, context)
            conditions_eval.append({
                "type": cond.get("type"),
                "operator": cond.get("operator"),
                "value": cond.get("value"),
                "matched": matched,
            })
            if not matched:
                all_matched = False

        result["conditions_evaluation"] = conditions_eval
        result["conditions_matched"] = all_matched

        if not all_matched:
            result["status"] = "conditions_not_matched"
            if not dry_run:
                await self._log_run(rule, context, result, db)
            return result

        # Execute actions
        if dry_run:
            result["actions_executed"] = [
                {"type": a.get("type"), "config": a.get("config", {}), "status": "would_execute"}
                for a in (rule.actions or [])
            ]
            result["status"] = "would_execute"
        else:
            executed = []
            for action in rule.actions or []:
                action_result = await self._execute_action(
                    action, context, rule.user_id, db
                )
                executed.append(action_result)
            result["actions_executed"] = executed
            result["status"] = "executed"
            await self._log_run(rule, context, result, db)

        return result

    # ── Trigger Checking ─────────────────────────────────────────────────
    def _check_trigger(self, rule: AutomationRule, context: AutomationContext) -> bool:
        """Check if the trigger config matches the context."""
        config = rule.trigger_config or {}

        if rule.trigger_type == "keyword_match":
            keywords = config.get("keywords", [])
            if not keywords:
                return False
            text_lower = context.message_text.lower()
            match_mode = config.get("match_mode", "any")  # any | all
            if match_mode == "all":
                return all(kw.lower() in text_lower for kw in keywords)
            return any(kw.lower() in text_lower for kw in keywords)

        elif rule.trigger_type == "hallucination_risk":
            threshold = config.get("threshold", 0.6)
            return context.verifier_risk_score >= threshold

        elif rule.trigger_type == "low_confidence":
            safe_verdicts = {"SAFE_TO_SEND"}
            return context.verifier_verdict not in safe_verdicts

        elif rule.trigger_type == "outside_working_hours":
            start_hour = config.get("start_hour", 9)
            end_hour = config.get("end_hour", 17)
            current_hour = context.current_time.hour
            return current_hour < start_hour or current_hour >= end_hour

        elif rule.trigger_type == "session_idle":
            idle_minutes = config.get("idle_minutes", 30)
            # In practice, this trigger would be fired by a cron job
            # Here we just check if the config is present
            return True

        elif rule.trigger_type == "intent_match":
            intents = config.get("intents", [])
            detected_intent = context.extra.get("intent", "")
            return detected_intent in intents

        # For simple triggers (new_message, product_not_found, customer_angry,
        # handoff_triggered), just return True — the trigger name itself IS the match
        return True

    # ── Condition Evaluation ─────────────────────────────────────────────
    def _evaluate_condition(
        self, condition: dict, context: AutomationContext
    ) -> bool:
        """Evaluate a single condition against the context."""
        cond_type = condition.get("type", "")
        operator = condition.get("operator", "equals")
        value = condition.get("value")

        if cond_type == "channel":
            return self._compare(context.channel, operator, value)
        elif cond_type == "message_count":
            return self._compare(context.session_message_count, operator, value)
        elif cond_type == "customer_tag":
            if operator == "contains":
                return value in context.customer_tags
            elif operator == "not_contains":
                return value not in context.customer_tags
        elif cond_type == "time_of_day":
            if operator == "between" and isinstance(value, list) and len(value) == 2:
                h, m = context.current_time.hour, context.current_time.minute
                current = f"{h:02d}:{m:02d}"
                return value[0] <= current <= value[1]
        elif cond_type == "risk_score":
            return self._compare(context.verifier_risk_score, operator, value)
        elif cond_type == "product_availability":
            return self._compare(context.product_availability, operator, value)
        elif cond_type == "customer_name":
            return self._compare(context.customer_name, operator, value)

        logger.warning("Unknown condition type: %s", cond_type)
        return False

    def _compare(self, actual: Any, operator: str, expected: Any) -> bool:
        """Generic comparison helper."""
        try:
            if operator == "equals":
                return str(actual).lower() == str(expected).lower()
            elif operator == "not_equals":
                return str(actual).lower() != str(expected).lower()
            elif operator == "contains":
                return str(expected).lower() in str(actual).lower()
            elif operator == "not_contains":
                return str(expected).lower() not in str(actual).lower()
            elif operator == "greater_than":
                return float(actual) > float(expected)
            elif operator == "less_than":
                return float(actual) < float(expected)
            elif operator == "starts_with":
                return str(actual).lower().startswith(str(expected).lower())
            elif operator == "in":
                return str(actual).lower() in [str(v).lower() for v in expected]
        except (TypeError, ValueError):
            return False
        return False

    # ── Action Execution ─────────────────────────────────────────────────
    async def _execute_action(
        self,
        action: dict,
        context: AutomationContext,
        user_id: uuid.UUID,
        db: AsyncSession,
    ) -> dict:
        """Execute a single action."""
        action_type = action.get("type", "")
        config = action.get("config", {})
        result = {"type": action_type, "status": "success"}

        try:
            if action_type == "send_message":
                text = config.get("text", "")
                text = context.substitute_variables(text)
                result["message"] = text
                # The actual sending happens via the normal reply pipeline
                # We store the auto-reply message in the session
                if context.session_id:
                    from services.ai_chat import save_message
                    await save_message(
                        context.session_id, "assistant", text,
                        "text", None, db,
                    )

            elif action_type == "handoff":
                if context.session_id:
                    from services.handoff_service import create_handoff
                    reason = config.get("reason", "Automation triggered handoff")
                    priority = config.get("priority", "normal")
                    await create_handoff(
                        session_id=context.session_id,
                        user_id=user_id,
                        reason=reason,
                        db=db,
                        priority=priority,
                    )
                    result["handoff_created"] = True

            elif action_type == "tag_customer":
                tag = config.get("tag", "")
                if tag:
                    # Store tag in session metadata
                    if context.session_id:
                        session = await db.get(ChatSession, context.session_id)
                        if session and session.metadata_:
                            tags = session.metadata_.get("tags", [])
                            if tag not in tags:
                                tags.append(tag)
                                session.metadata_["tags"] = tags
                        elif session:
                            session.metadata_ = {"tags": [tag]}

            elif action_type == "set_variable":
                key = config.get("key", "")
                value = config.get("value", "")
                context.extra[key] = value
                result["variable_set"] = {key: value}

            elif action_type == "send_notification":
                # Log for now, real notification (email, Slack, etc.) TBD
                logger.info(
                    "Automation notification: channel=%s to=%s",
                    config.get("channel"), config.get("to"),
                )
                result["notification_queued"] = True

            elif action_type == "pause_ai":
                duration = config.get("duration_minutes", 30)
                if context.session_id:
                    session = await db.get(ChatSession, context.session_id)
                    if session:
                        session.is_escalated = True  # Pauses AI replies
                result["paused_minutes"] = duration

            elif action_type == "log_event":
                event = config.get("event", "automation_event")
                logger.info("Automation event: %s for session %s", event, context.session_id)
                result["event_logged"] = event

            else:
                result["status"] = "unknown_action"
                logger.warning("Unknown action type: %s", action_type)

        except Exception as e:
            result["status"] = "error"
            result["error"] = str(e)
            logger.exception("Failed to execute action %s", action_type)

        return result

    # ── Loop Prevention ──────────────────────────────────────────────────
    async def _get_execution_count(
        self,
        rule_id: uuid.UUID,
        session_id: uuid.UUID,
        db: AsyncSession,
    ) -> int:
        """Count how many times this rule has executed for this session."""
        stmt = select(func.count(AutomationRun.id)).where(
            AutomationRun.rule_id == rule_id,
            AutomationRun.session_id == session_id,
            AutomationRun.status == "success",
        )
        result = await db.execute(stmt)
        return result.scalar() or 0

    # ── Run Logging ──────────────────────────────────────────────────────
    async def _log_run(
        self,
        rule: AutomationRule,
        context: AutomationContext,
        result: dict,
        db: AsyncSession,
    ) -> None:
        """Log an automation run to the database."""
        try:
            run = AutomationRun(
                rule_id=rule.id,
                session_id=context.session_id,
                message_id=context.message_id,
                trigger_matched=result.get("trigger_matched", False),
                conditions_matched=result.get("conditions_matched", False),
                conditions_evaluation=result.get("conditions_evaluation"),
                actions_executed=result.get("actions_executed"),
                status=result.get("status", "unknown"),
                error=result.get("error"),
                execution_time_ms=result.get("execution_time_ms", 0),
            )
            db.add(run)
            await db.flush()

            # Log individual steps
            for action in result.get("actions_executed", []):
                log = AutomationLog(
                    run_id=run.id,
                    step=action.get("type", "unknown"),
                    detail=json.dumps(action, ensure_ascii=False),
                    level="info" if action.get("status") == "success" else "error",
                )
                db.add(log)

            await db.commit()
        except Exception:
            logger.exception("Failed to log automation run")


# ── Templates ────────────────────────────────────────────────────────────
AUTOMATION_TEMPLATES = [
    {
        "id": "welcome_whatsapp",
        "name": "رسالة ترحيب واتساب",
        "name_en": "WhatsApp Welcome Message",
        "description": "رسالة ترحيب تلقائية لكل عميل جديد على واتساب",
        "trigger_type": "new_message",
        "trigger_config": {},
        "conditions": [
            {"type": "channel", "operator": "equals", "value": "whatsapp"},
            {"type": "message_count", "operator": "equals", "value": 1},
        ],
        "actions": [
            {
                "type": "send_message",
                "config": {
                    "text": "هلا وغلا! 👋 منورنا {{customer_name}}. كيف بقدر أساعدك اليوم؟"
                },
            },
        ],
    },
    {
        "id": "outside_hours",
        "name": "رد خارج ساعات العمل",
        "name_en": "Outside Working Hours Auto-Reply",
        "description": "رد تلقائي خارج ساعات العمل مع وعد بالرد لاحقاً",
        "trigger_type": "outside_working_hours",
        "trigger_config": {"start_hour": 9, "end_hour": 17},
        "conditions": [],
        "actions": [
            {
                "type": "send_message",
                "config": {
                    "text": "شكراً لتواصلك! ✨ حالياً خارج ساعات العمل. رح نرد عليك أول ما نفتح بإذن الله. ساعات العمل: 9 صباحاً - 5 مساءً."
                },
            },
        ],
    },
    {
        "id": "angry_customer",
        "name": "تصعيد عميل غاضب",
        "name_en": "Angry Customer Escalation",
        "description": "تحويل المحادثة تلقائياً لفريق الدعم عند اكتشاف عميل غاضب",
        "trigger_type": "customer_angry",
        "trigger_config": {},
        "conditions": [],
        "actions": [
            {
                "type": "handoff",
                "config": {
                    "priority": "high",
                    "reason": "Customer sentiment detected as negative/angry",
                },
            },
            {
                "type": "send_message",
                "config": {
                    "text": "أنا بفهم إنك مش مبسوط وبعتذرلك. رح أحولك لزميلي ليقدر يساعدك بشكل أفضل 🙏"
                },
            },
        ],
    },
    {
        "id": "product_not_found_alert",
        "name": "تنبيه منتج غير موجود",
        "name_en": "Product Not Found Alert",
        "description": "تنبيه المدير عند سؤال العميل عن منتج غير موجود",
        "trigger_type": "product_not_found",
        "trigger_config": {},
        "conditions": [],
        "actions": [
            {
                "type": "send_notification",
                "config": {
                    "channel": "dashboard",
                    "to": "admin",
                    "message": "عميل سأل عن منتج غير موجود: {{product_name}}"
                },
            },
            {
                "type": "log_event",
                "config": {"event": "product_not_found"},
            },
        ],
    },
    {
        "id": "high_risk_alert",
        "name": "تنبيه إجابة عالية المخاطر",
        "name_en": "High-Risk Answer Alert",
        "description": "تنبيه عند اكتشاف إجابة ذكاء اصطناعي قد تكون غير دقيقة",
        "trigger_type": "hallucination_risk",
        "trigger_config": {"threshold": 0.7},
        "conditions": [],
        "actions": [
            {
                "type": "send_notification",
                "config": {
                    "channel": "dashboard",
                    "to": "admin",
                    "message": "⚠️ AI risk score {{verifier_risk_score}} for session {{session_id}}"
                },
            },
            {
                "type": "tag_customer",
                "config": {"tag": "needs-review"},
            },
        ],
    },
    {
        "id": "vip_detection",
        "name": "كشف عميل VIP",
        "name_en": "VIP Customer Detection",
        "description": "تعليم العميل كـ VIP عند تجاوز عدد رسائل محدد",
        "trigger_type": "new_message",
        "trigger_config": {},
        "conditions": [
            {"type": "message_count", "operator": "greater_than", "value": 20},
        ],
        "actions": [
            {
                "type": "tag_customer",
                "config": {"tag": "vip"},
            },
            {
                "type": "set_variable",
                "config": {"key": "customer_tier", "value": "vip"},
            },
        ],
    },
]


def get_templates() -> list[dict]:
    """Return the list of automation templates."""
    return AUTOMATION_TEMPLATES
