import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from middleware.auth_middleware import get_current_user
from models import DeliveryRule, User
from schemas.delivery import DeliveryRuleCreate, DeliveryRuleOut, DeliveryRuleUpdate

router = APIRouter(prefix="/delivery-rules", tags=["delivery"])


@router.get("", response_model=list[DeliveryRuleOut])
async def list_rules(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DeliveryRule)
        .where(DeliveryRule.user_id == current_user.id)
        .order_by(DeliveryRule.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("", response_model=DeliveryRuleOut, status_code=status.HTTP_201_CREATED)
async def create_rule(
    payload: DeliveryRuleCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rule = DeliveryRule(
        user_id=current_user.id,
        zone_name=payload.zone_name,
        delivery_fee=payload.delivery_fee,
        currency=payload.currency,
        free_above=payload.free_above,
        estimated_days=payload.estimated_days,
        pickup_available=payload.pickup_available,
        notes=payload.notes,
        is_active=payload.is_active,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule


async def _get_owned_rule(
    rule_id: uuid.UUID, user: User, db: AsyncSession
) -> DeliveryRule:
    result = await db.execute(
        select(DeliveryRule).where(
            DeliveryRule.id == rule_id, DeliveryRule.user_id == user.id
        )
    )
    rule = result.scalar_one_or_none()
    if rule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Delivery rule not found"
        )
    return rule


@router.put("/{rule_id}", response_model=DeliveryRuleOut)
async def update_rule(
    rule_id: uuid.UUID,
    payload: DeliveryRuleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rule = await _get_owned_rule(rule_id, current_user, db)
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(rule, field, value)
    await db.commit()
    await db.refresh(rule)
    return rule


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rule(
    rule_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rule = await _get_owned_rule(rule_id, current_user, db)
    await db.delete(rule)
    await db.commit()
