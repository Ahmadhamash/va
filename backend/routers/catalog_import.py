import csv
import io
import ipaddress
import json
import socket
from html.parser import HTMLParser
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
import httpx
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Item, User
from routers.auth import get_current_user

router = APIRouter(prefix="/catalog/csv", tags=["catalog", "csv"])


class ImportUrlRequest(BaseModel):
    url: str = Field(min_length=8, max_length=2048)


class ProductPageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.meta: dict[str, str] = {}
        self.json_ld: list[str] = []
        self._inside_json_ld = False
        self._script_parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = {k.lower(): v or "" for k, v in attrs}
        if tag.lower() == "meta":
            key = attr.get("property") or attr.get("name")
            content = attr.get("content")
            if key and content:
                self.meta[key.lower()] = content
        if tag.lower() == "script" and "ld+json" in attr.get("type", "").lower():
            self._inside_json_ld = True
            self._script_parts = []

    def handle_data(self, data: str) -> None:
        if self._inside_json_ld:
            self._script_parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "script" and self._inside_json_ld:
            self.json_ld.append("".join(self._script_parts).strip())
            self._inside_json_ld = False
            self._script_parts = []


def _validate_public_http_url(raw_url: str) -> str:
    parsed = urlparse(raw_url.strip())
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise HTTPException(status_code=400, detail="URL must be a public http(s) link")

    try:
        infos = socket.getaddrinfo(parsed.hostname, None)
    except socket.gaierror:
        raise HTTPException(status_code=400, detail="Could not resolve URL host")

    for info in infos:
        address = info[4][0]
        ip = ipaddress.ip_address(address)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast:
            raise HTTPException(status_code=400, detail="Private or local URLs are not allowed")
    return raw_url.strip()


def _jsonld_nodes(value):
    if isinstance(value, list):
        for item in value:
            yield from _jsonld_nodes(item)
        return
    if not isinstance(value, dict):
        return
    graph = value.get("@graph")
    if graph:
        yield from _jsonld_nodes(graph)
    node_type = value.get("@type")
    types = node_type if isinstance(node_type, list) else [node_type]
    if any(str(t).lower() == "product" for t in types if t):
        yield value


def _first_image(value) -> str | None:
    if isinstance(value, str):
        return value
    if isinstance(value, list) and value:
        return _first_image(value[0])
    if isinstance(value, dict):
        return value.get("url") or value.get("contentUrl")
    return None


def _candidate_from_product(product: dict, source_url: str) -> dict | None:
    name = product.get("name")
    if not name:
        return None
    offers = product.get("offers") or {}
    if isinstance(offers, list):
        offers = offers[0] if offers else {}
    brand = product.get("brand")
    category = product.get("category")
    if not category and isinstance(brand, dict):
        category = brand.get("name")
    return {
        "name": str(name).strip(),
        "description": str(product.get("description") or "").strip(),
        "category": str(category or "").strip(),
        "price": str(offers.get("price") or ""),
        "currency": str(offers.get("priceCurrency") or "USD"),
        "image_url": _first_image(product.get("image")),
        "source_url": source_url,
        "metadata": {"source": "json_ld", "raw_type": product.get("@type")},
    }


@router.post("/import-url")
async def import_from_url(
    body: ImportUrlRequest,
    current_user: User = Depends(get_current_user),
):
    url = _validate_public_http_url(body.url)
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            response = await client.get(
                url,
                headers={"User-Agent": "chatter-catalog-import/1.0"},
            )
            response.raise_for_status()
            content = response.text[:1_000_000]
    except httpx.HTTPError:
        raise HTTPException(status_code=400, detail="Could not fetch this URL")

    parser = ProductPageParser()
    parser.feed(content)

    candidates: list[dict] = []
    for script in parser.json_ld:
        try:
            parsed = json.loads(script)
        except json.JSONDecodeError:
            continue
        for node in _jsonld_nodes(parsed):
            candidate = _candidate_from_product(node, url)
            if candidate:
                candidates.append(candidate)

    if not candidates:
        og_name = parser.meta.get("og:title") or parser.meta.get("twitter:title")
        if og_name:
            candidates.append(
                {
                    "name": og_name,
                    "description": parser.meta.get("og:description") or parser.meta.get("description") or "",
                    "category": "",
                    "price": "",
                    "currency": "USD",
                    "image_url": parser.meta.get("og:image") or parser.meta.get("twitter:image"),
                    "source_url": url,
                    "metadata": {"source": "open_graph"},
                }
            )

    return {
        "candidates": candidates[:20],
        "review_required": True,
        "message": "Review and complete any missing fields before saving.",
    }

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
