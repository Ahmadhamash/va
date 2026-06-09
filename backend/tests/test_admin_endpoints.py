import os
import pytest
import uuid

# Set storage overrides before imports to avoid Redis connection errors
os.environ["REDIS_URL"] = "memory://"
os.environ["DATABASE_URL"] = "postgresql+asyncpg://x:x@localhost/test"

from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import status
from httpx import AsyncClient, ASGITransport
from main import app
from database import get_db
from middleware.auth_middleware import get_current_admin
from models import User

@pytest.mark.asyncio
async def test_reset_test_store_success():
    # Mock admin user
    admin_user = User(
        id=uuid.uuid4(),
        username="admin",
        role="admin"
    )

    mock_user = MagicMock(spec=User)
    mock_user.id = uuid.uuid4()
    mock_user.username = "test_store"
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_user

    # Mock database session
    mock_db = MagicMock()
    mock_db.execute = AsyncMock(return_value=mock_result)
    mock_db.commit = AsyncMock()

    # Override dependencies
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_db] = lambda: mock_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        with patch("routers.admin.seed_store", new_callable=AsyncMock) as mock_seed:
            response = await ac.post("/api/admin/seed-test-store")
            assert response.status_code == 200
            assert response.json()["ok"] is True
            mock_seed.assert_called_once_with(mock_db)

    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_get_pricing_breakdown_success():
    admin_user = User(
        id=uuid.uuid4(),
        username="admin",
        role="admin"
    )

    mock_db = MagicMock()
    
    # 1. total_messages query scalar mock
    # 2. total_logs query scalar mock
    # 3. logs execute result mock
    mock_db.scalar = AsyncMock(side_effect=[10, 5])
    
    mock_settings = MagicMock()
    mock_settings.ai_model = "gpt-4o"
    mock_db.execute = AsyncMock(return_value=MagicMock(
        all=lambda: [
            (
                uuid.uuid4(),
                "test_store",
                "Test Store Business",
                "how much",
                "50 USD",
                "50 USD",
                {"items": []},
                {"model": "gpt-4o"}
            )
        ]
    ))
    
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_db] = lambda: mock_db

    with patch("routers.admin.get_settings_row", return_value=mock_settings):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            response = await ac.get("/api/admin/pricing-breakdown")
            assert response.status_code == 200
            data = response.json()
            assert "total_messages" in data
            assert "total_verification_logs" in data
            assert "total_estimated_cost" in data
            assert "by_model" in data
            assert "by_client" in data

    app.dependency_overrides.clear()
