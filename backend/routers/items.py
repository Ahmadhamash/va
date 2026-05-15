import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from middleware.auth_middleware import get_current_user
from models import Item, User
from schemas.item import ItemCreate, ItemOut, ItemUpdate

router = APIRouter(prefix="/items", tags=["items"])


async def _get_owned_item(item_id: uuid.UUID, user: User, db: AsyncSession) -> Item:
    result = await db.execute(
        select(Item).where(Item.id == item_id, Item.user_id == user.id)
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return item


@router.get("", response_model=list[ItemOut])
async def list_items(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Item).where(Item.user_id == current_user.id).order_by(Item.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/search", response_model=list[ItemOut])
async def search_items(
    q: str = Query(..., min_length=1, description="Search by name or category"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pattern = f"%{q}%"
    result = await db.execute(
        select(Item).where(
            Item.user_id == current_user.id,
            or_(
                Item.name.ilike(pattern),
                Item.category.ilike(pattern),
                Item.description.ilike(pattern),
            ),
        )
    )
    return list(result.scalars().all())


@router.post("", response_model=ItemOut, status_code=status.HTTP_201_CREATED)
async def create_item(
    payload: ItemCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = Item(
        user_id=current_user.id,
        name=payload.name,
        description=payload.description,
        category=payload.category,
        price=payload.price,
        currency=payload.currency,
        available=payload.available,
        image_url=payload.image_url,
        item_metadata=payload.item_metadata or {},
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.put("/{item_id}", response_model=ItemOut)
async def update_item(
    item_id: uuid.UUID,
    payload: ItemUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await _get_owned_item(item_id, current_user, db)
    data = payload.model_dump(exclude_unset=True, by_alias=False)
    if "item_metadata" in data and data["item_metadata"] is None:
        data.pop("item_metadata")
    for field, value in data.items():
        setattr(item, field, value)
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    item_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await _get_owned_item(item_id, current_user, db)
    await db.delete(item)
    await db.commit()


@router.patch("/{item_id}/toggle", response_model=ItemOut)
async def toggle_item(
    item_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await _get_owned_item(item_id, current_user, db)
    item.available = not item.available
    await db.commit()
    await db.refresh(item)
    return item
