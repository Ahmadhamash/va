import csv
import io
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Item, User
from routers.auth import get_current_user

router = APIRouter(prefix="/catalog/csv", tags=["catalog", "csv"])

@router.get("/export")
async def export_catalog(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Item).where(Item.user_id == current_user.id)
    items = list((await db.execute(stmt)).scalars().all())

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["name", "description", "category", "price", "currency", "available", "image_url"])
    for item in items:
        writer.writerow([
            item.name,
            item.description or "",
            item.category or "",
            item.price,
            item.currency,
            str(item.available),
            item.image_url or ""
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=catalog_export.csv"}
    )

@router.post("/import")
async def import_catalog(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    content = await file.read()
    try:
        text = content.decode('utf-8')
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Invalid file encoding. Please use UTF-8.")

    reader = csv.DictReader(io.StringIO(text))
    expected_fields = {"name", "description", "category", "price"}
    if not reader.fieldnames or not expected_fields.issubset(set(reader.fieldnames)):
        raise HTTPException(status_code=400, detail=f"Missing required columns. Expected at least: {expected_fields}")

    items_to_add = []
    for row in reader:
        if not row.get("name"):
            continue # skip empty rows
        
        available_str = str(row.get("available", "true")).strip().lower()
        available = available_str in ("true", "1", "yes", "t", "y")
        
        try:
            price = float(row.get("price"))
        except (ValueError, TypeError):
            price = 0.0

        new_item = Item(
            user_id=current_user.id,
            name=row.get("name").strip(),
            description=row.get("description", "").strip(),
            category=row.get("category", "").strip(),
            price=price,
            currency=row.get("currency", "USD").strip() or "USD",
            available=available,
            image_url=row.get("image_url", "").strip() or None
        )
        items_to_add.append(new_item)

    if items_to_add:
        db.add_all(items_to_add)
        await db.commit()

    return {"message": f"Successfully imported {len(items_to_add)} items."}
