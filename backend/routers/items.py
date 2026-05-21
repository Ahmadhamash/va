import uuid

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from middleware.auth_middleware import get_current_user
from models import Item, User
from schemas.item import ItemCreate, ItemOut, ItemUpdate
from services.file_service import save_upload

router = APIRouter(prefix="/items", tags=["items"])


async def _get_owned_item(item_id: uuid.UUID, user: User, db: AsyncSession) -> Item:
    result = await db.execute(
        select(Item).options(selectinload(Item.variants)).where(Item.id == item_id, Item.user_id == user.id)
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
        select(Item).options(selectinload(Item.variants)).where(Item.user_id == current_user.id).order_by(Item.created_at.desc())
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
        select(Item).options(selectinload(Item.variants)).where(
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
    
    # ─── التعديل الجديد هنا ───
    # قمنا بحذف item.variants = [] و db.refresh(item)
    # واستبدلناها بجلب المنتج بشكل صحيح مع الـ variants
    
    result = await db.execute(
        select(Item).options(selectinload(Item.variants)).where(Item.id == item.id)
    )
    return result.scalar_one()


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


@router.post("/{item_id}/image", response_model=ItemOut)
async def upload_item_image(
    item_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await _get_owned_item(item_id, current_user, db)
    rel_path, media_type = await save_upload(file, current_user.id)
    if media_type != "image":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only image files are allowed for products",
        )
    item.image_url = f"/uploads/{rel_path}"
    await db.commit()
    await db.refresh(item)
    return item


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


# ─── Variants ────────────────────────────────────────────────────────────────
from models import ItemVariant
from schemas.variant import VariantCreate, VariantOut, VariantUpdate


@router.get("/{item_id}/variants", response_model=list[VariantOut])
async def list_variants(
    item_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_item(item_id, current_user, db)
    result = await db.execute(
        select(ItemVariant).where(ItemVariant.item_id == item_id)
    )
    return list(result.scalars().all())


@router.post(
    "/{item_id}/variants",
    response_model=VariantOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_variant(
    item_id: uuid.UUID,
    payload: VariantCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_item(item_id, current_user, db)
    variant = ItemVariant(
        item_id=item_id,
        option_type=payload.option_type,
        option_value=payload.option_value,
        price_override=payload.price_override,
        available=payload.available,
        stock_quantity=payload.stock_quantity,
    )
    db.add(variant)
    await db.commit()
    await db.refresh(variant)
    return variant


@router.put("/{item_id}/variants/{variant_id}", response_model=VariantOut)
async def update_variant(
    item_id: uuid.UUID,
    variant_id: uuid.UUID,
    payload: VariantUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_item(item_id, current_user, db)
    result = await db.execute(
        select(ItemVariant).where(
            ItemVariant.id == variant_id, ItemVariant.item_id == item_id
        )
    )
    variant = result.scalar_one_or_none()
    if variant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found"
        )
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(variant, field, value)
    await db.commit()
    await db.refresh(variant)
    return variant


@router.delete(
    "/{item_id}/variants/{variant_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_variant(
    item_id: uuid.UUID,
    variant_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_item(item_id, current_user, db)
    result = await db.execute(
        select(ItemVariant).where(
            ItemVariant.id == variant_id, ItemVariant.item_id == item_id
        )
    )
    variant = result.scalar_one_or_none()
    if variant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found"
        )
    await db.delete(variant)
    await db.commit()
