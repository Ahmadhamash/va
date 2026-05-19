import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from middleware.auth_middleware import get_current_user
from models import Offer, Package, User
from schemas.offer import (
    OfferCreate, OfferOut, OfferUpdate,
    PackageCreate, PackageOut, PackageUpdate,
)

router = APIRouter(tags=["offers"])


# ─── Offers ──────────────────────────────────────────────────────────────────
@router.get("/offers", response_model=list[OfferOut])
async def list_offers(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Offer)
        .where(Offer.user_id == current_user.id)
        .order_by(Offer.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("/offers", response_model=OfferOut, status_code=status.HTTP_201_CREATED)
async def create_offer(
    payload: OfferCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    offer = Offer(user_id=current_user.id, **payload.model_dump())
    db.add(offer)
    await db.commit()
    await db.refresh(offer)
    return offer


@router.put("/offers/{offer_id}", response_model=OfferOut)
async def update_offer(
    offer_id: uuid.UUID,
    payload: OfferUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Offer).where(Offer.id == offer_id, Offer.user_id == current_user.id)
    )
    offer = result.scalar_one_or_none()
    if offer is None:
        raise HTTPException(status_code=404, detail="Offer not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(offer, field, value)
    await db.commit()
    await db.refresh(offer)
    return offer


@router.delete("/offers/{offer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_offer(
    offer_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Offer).where(Offer.id == offer_id, Offer.user_id == current_user.id)
    )
    offer = result.scalar_one_or_none()
    if offer is None:
        raise HTTPException(status_code=404, detail="Offer not found")
    await db.delete(offer)
    await db.commit()


# ─── Packages ────────────────────────────────────────────────────────────────
@router.get("/packages", response_model=list[PackageOut])
async def list_packages(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Package)
        .where(Package.user_id == current_user.id)
        .order_by(Package.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("/packages", response_model=PackageOut, status_code=status.HTTP_201_CREATED)
async def create_package(
    payload: PackageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pkg = Package(user_id=current_user.id, **payload.model_dump())
    db.add(pkg)
    await db.commit()
    await db.refresh(pkg)
    return pkg


@router.put("/packages/{pkg_id}", response_model=PackageOut)
async def update_package(
    pkg_id: uuid.UUID,
    payload: PackageUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Package).where(Package.id == pkg_id, Package.user_id == current_user.id)
    )
    pkg = result.scalar_one_or_none()
    if pkg is None:
        raise HTTPException(status_code=404, detail="Package not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(pkg, field, value)
    await db.commit()
    await db.refresh(pkg)
    return pkg


@router.delete("/packages/{pkg_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_package(
    pkg_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Package).where(Package.id == pkg_id, Package.user_id == current_user.id)
    )
    pkg = result.scalar_one_or_none()
    if pkg is None:
        raise HTTPException(status_code=404, detail="Package not found")
    await db.delete(pkg)
    await db.commit()
