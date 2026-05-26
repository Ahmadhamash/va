import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from database import get_db
from middleware.auth_middleware import get_current_user
from models import User, SubscriptionTier, UserSubscription
from schemas.billing import SubscriptionTierOut, UserSubscriptionWithTierOut

router = APIRouter(prefix="/billing", tags=["billing"])

@router.get("/tiers", response_model=List[SubscriptionTierOut])
async def list_tiers(db: AsyncSession = Depends(get_db)):
    """List all available subscription tiers."""
    result = await db.execute(
        select(SubscriptionTier).where(SubscriptionTier.is_active)
    )
    return list(result.scalars().all())

@router.get("/subscription", response_model=UserSubscriptionWithTierOut)
async def get_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the user's current subscription."""
    result = await db.execute(
        select(UserSubscription)
        .options(selectinload(UserSubscription.tier))
        .where(UserSubscription.user_id == current_user.id, UserSubscription.status == "active")
    )
    subscription = result.scalar_one_or_none()
    
    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active subscription found",
        )
    return subscription

@router.post("/upgrade", response_model=UserSubscriptionWithTierOut)
async def upgrade_subscription(
    tier_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Dummy endpoint to upgrade a user's subscription tier (without Stripe integration yet)."""
    # Check if tier exists
    result = await db.execute(
        select(SubscriptionTier).where(SubscriptionTier.id == tier_id, SubscriptionTier.is_active)
    )
    tier = result.scalar_one_or_none()
    if not tier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subscription tier not found",
        )

    # Check if user already has a subscription record
    existing_result = await db.execute(
        select(UserSubscription).where(UserSubscription.user_id == current_user.id)
    )
    existing_sub = existing_result.scalar_one_or_none()
    
    if existing_sub:
        # Update existing record to avoid UniqueConstraint violation
        existing_sub.tier_id = tier_id
        existing_sub.status = "active"
        existing_sub.start_date = func.now()
        existing_sub.end_date = None
        new_sub = existing_sub
    else:
        # Create new subscription
        new_sub = UserSubscription(
            user_id=current_user.id,
            tier_id=tier_id,
            status="active"
        )
        db.add(new_sub)
    
    await db.commit()
    await db.refresh(new_sub)
    
    # Load tier for response
    result_with_tier = await db.execute(
        select(UserSubscription)
        .options(selectinload(UserSubscription.tier))
        .where(UserSubscription.id == new_sub.id)
    )
    
    return result_with_tier.scalar_one()

