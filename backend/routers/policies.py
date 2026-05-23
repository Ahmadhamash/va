import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from middleware.auth_middleware import get_current_user
from models import BusinessPolicy, User
from schemas.policy import PolicyCreate, PolicyOut, PolicyUpdate

router = APIRouter(prefix="/policies", tags=["policies"])


@router.get("", response_model=list[PolicyOut])
async def list_policies(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BusinessPolicy)
        .where(BusinessPolicy.user_id == current_user.id)
        .order_by(BusinessPolicy.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("", response_model=PolicyOut, status_code=status.HTTP_201_CREATED)
async def create_policy(
    payload: PolicyCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pol = BusinessPolicy(
        user_id=current_user.id,
        policy_type=payload.policy_type,
        title=payload.title,
        content=payload.content,
        is_active=payload.is_active,
    )
    db.add(pol)
    await db.commit()
    await db.refresh(pol)
    return pol


async def _get_owned(pid: uuid.UUID, user: User, db: AsyncSession) -> BusinessPolicy:
    result = await db.execute(
        select(BusinessPolicy).where(
            BusinessPolicy.id == pid, BusinessPolicy.user_id == user.id
        )
    )
    pol = result.scalar_one_or_none()
    if pol is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Policy not found")
    return pol


@router.put("/{policy_id}", response_model=PolicyOut)
async def update_policy(
    policy_id: uuid.UUID,
    payload: PolicyUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pol = await _get_owned(policy_id, current_user, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(pol, field, value)
    await db.commit()
    await db.refresh(pol)
    return pol


@router.delete("/{policy_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_policy(
    policy_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pol = await _get_owned(policy_id, current_user, db)
    await db.delete(pol)
    await db.commit()
