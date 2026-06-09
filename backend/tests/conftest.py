import os
os.environ["REDIS_URL"] = "memory://"

import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import expression

@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "TEXT"

@compiles(UUID, "sqlite")
def compile_uuid_sqlite(type_, compiler, **kw):
    return "CHAR(36)"

@compiles(expression.Function, "sqlite")
def compile_function_sqlite(element, compiler, **kw):
    name = element.name.lower()
    if name in ("gen_random_uuid", "uuid_generate_v4"):
        return "(lower(hex(randomblob(16))))"
    if name == "pg_advisory_xact_lock":
        return "1"
    return compiler.visit_function(element, **kw)

from sqlalchemy.sql.elements import TextClause
@compiles(TextClause, "sqlite")
def compile_text_sqlite(element, compiler, **kw):
    text = element.text
    if "pg_advisory_xact_lock" in text:
        return "SELECT 1"
    return text

from main import app
from database import Base, get_db
from config import settings
from sqlalchemy.pool import StaticPool

db_url = "sqlite+aiosqlite:///:memory:"
engine = create_async_engine(
    db_url,
    echo=False,
    poolclass=StaticPool,
    connect_args={"check_same_thread": False}
)
TestingSessionLocal = async_sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

@pytest_asyncio.fixture
async def db_session():
    async with TestingSessionLocal() as session:
        yield session

@pytest_asyncio.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
